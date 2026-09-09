/**
 * dsh-plugin-manager — 启用/停用（写 profile 的 user patch 层，HMR 热生效）。
 *
 * 移植自旧版 lib/core.js，并按重构计划修复：
 *   - 行 id 不再拒绝特殊字符：写入时用 YAML 安全引用（双引号标量），
 *     读取/移除时同时匹配带引号与不带引号两种写法（rowId 转义修复）。
 *   - enablePlugin 的 already 分支修复：只有「补丁块被移除」或「从未被停用」
 *     才算已启用；发现停用标记但无法定位块（外部修改/写法不一致）时返回
 *     结构化错误而不是误报已启用。
 *   - 卸载后清理 dsh.profile.bundles 与 dependencies 残留（editManifestRemove）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { profileDir, scanProfile } from "./scan.js";

/** profile 的 user patch 层路径（cordis.patch.yml）。 */
export function userPatchPath(profile: string): string {
  return join(profileDir(profile), "cordis.patch.yml");
}

/** YAML 标量 id：普通字符原样，特殊字符用 JSON 双引号转义。 */
function yamlId(rowId: string): string {
  return /^[A-Za-z0-9_.-]+$/.test(rowId) ? rowId : JSON.stringify(rowId);
}

/** 读取一个带引号或不带引号的 YAML 标量。 */
function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      try {
        return JSON.parse(value);
      } catch {
        return value.slice(1, -1);
      }
    }
  }
  return value;
}

/**
 * 读取 user patch 层当前状态：
 * { disables: [disabled:true 的 row id], forced: [disabled:false 的 row id] }
 */
export function readUserPatchState(profile: string): { disables: string[]; forced: string[] } {
  const disables: string[] = [];
  const forced: string[] = [];
  let text = "";
  try {
    text = readFileSync(userPatchPath(profile), "utf8");
  } catch { /* 无 patch 文件 */ }
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const disableRow = /^- id: (.+?)\s*$/.exec(line);
    if (disableRow === null) continue;
    const next = lines[index + 1] ?? "";
    if (/^ {2}disabled: true\s*$/.test(next)) disables.push(unquote(disableRow[1]));
    else if (/^ {2}disabled: false\s*$/.test(next)) forced.push(unquote(disableRow[1]));
  }
  return { disables, forced };
}

/** 解析一个插件 bundle patch 中 insert 的 row id（用于 patch 定位）。 */
function bundleInsertedRowIds(profile: string, name: string): string[] {
  const ids: string[] = [];
  const meta = readInstalledPackageMeta(profile, name);
  if (meta === null) return [];
  const declared = meta.dsh?.bundle?.patch;
  if (typeof declared === "string" && declared !== "") {
    let patchText = "";
    const pkgJsonPath = findPackageJson(profile, name);
    if (pkgJsonPath !== null) {
      try {
        patchText = readFileSync(join(dirname(pkgJsonPath), declared), "utf8");
      } catch { /* 忽略 */ }
    }
    for (const line of patchText.split(/\r?\n/)) {
      const m = /^ {4}- id: ([A-Za-z0-9_.-]+)/.exec(line.replace(/#.*$/, ""));
      if (m !== null) ids.push(m[1]);
    }
  }
  return ids;
}

function findPackageJson(profile: string, name: string): string | null {
  const nm = join(profileDir(profile), "node_modules");
  const candidate = name.startsWith("@")
    ? join(nm, ...name.split("/"), "package.json")
    : join(nm, name, "package.json");
  return existsSync(candidate) ? candidate : null;
}

function readInstalledPackageMeta(profile: string, name: string): any {
  const pkgJsonPath = findPackageJson(profile, name);
  if (pkgJsonPath === null) return null;
  try {
    return JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  } catch {
    return null;
  }
}

/** 一个插件在 patch 层对应的 row id：bundle patch 的 insert id，回退为包名。 */
export function rowIdForPlugin(profile: string, name: string): string {
  const inserted = bundleInsertedRowIds(profile, name);
  return inserted.length > 0 ? inserted[0] : name;
}

/** 追加一个 patch 条目到 user patch 层（处理空文件与 `[]` 占位符）。 */
function appendPatchEntry(patchPath: string, block: string): void {
  let text = "";
  try {
    text = readFileSync(patchPath, "utf8");
  } catch { /* 创建 */ }
  const core = text.trim();
  if (core === "") {
    writeFileSync(patchPath, block);
    return;
  }
  const withoutComments = text.replace(/^[ \t]*#.*$/gmu, "").trim();
  if (withoutComments === "" || withoutComments === "[]" || withoutComments === "[ ]") {
    const commented = text.replace(/^[ \t]*\[[ \t]*\][ \t]*(?:#.*)?(?:\r?\n|$)/mu, "# []\n");
    const next = commented.endsWith("\n") ? commented : commented + "\n";
    writeFileSync(patchPath, next + block);
    return;
  }
  const next = text.endsWith("\n") ? text : text + "\n";
  writeFileSync(patchPath, next + block);
}

/** 移除 empty-list 占位符注释，或在文件仅剩注释时恢复 `[]`。 */
function restorePlaceholder(text: string): string {
  if (text.replace(/^[ \t]*#.*$/gmu, "").trim() !== "") return text;
  const uncommented = text.replace(/^[ \t]*#[ \t]*\[[ \t]*\][ \t]*(?:\r?\n|$)/mu, "[]\n");
  if (uncommented !== text) return uncommented;
  return text === "" || text.endsWith("\n") ? text + "[]\n" : text + "\n[]\n";
}

/** 匹配 patch 块的正则：id 带引号或不带引号均可。 */
function blockRegex(rowId: string): RegExp {
  const plain = rowId.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
  const q = String.fromCharCode(34);
  const unquoted = "^- id: " + plain + "[ \t]*\r?\n[ \t]{2}disabled: true[ \t]*\r?\n";
  const quoted = "^- id: " + q + plain + q + "[ \t]*\r?\n[ \t]{2}disabled: true[ \t]*\r?\n";
  return new RegExp("(?:" + unquoted + "|" + quoted + ")", "mu");
}

/**
 * 停用一个插件：向 user patch 层写 `- id: X` + `disabled: true`（幂等，HMR 热生效）。
 * rowId 含特殊字符时自动 YAML 引用写入（不再拒绝）。
 */
export function disablePlugin(profile: string, name: string) {
  const rowId = rowIdForPlugin(profile, name);
  const state = readUserPatchState(profile);
  if (state.disables.includes(rowId)) {
    return { ok: true, message: "插件「" + name + "」已处于停用状态", already: true };
  }
  appendPatchEntry(userPatchPath(profile), "- id: " + yamlId(rowId) + "\n  disabled: true\n");
  return { ok: true, message: "已停用「" + name + "」（HMR 生效，无需重启）", rowId };
}

/**
 * 启用一个插件：移除 user patch 层中对应的 `disabled: true` 块（幂等）。
 * already 判定修复：补丁块被移除或从未被停用才算已启用；出现停用标记但
 * 定位不到块时返回结构化错误，避免误报「已在启用状态」。
 */
export function enablePlugin(profile: string, name: string) {
  const rowId = rowIdForPlugin(profile, name);
  const state = readUserPatchState(profile);
  const path = userPatchPath(profile);
  const re = blockRegex(rowId);
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch { /* 无文件 */ }
  if (re.test(text)) {
    writeFileSync(path, restorePlaceholder(text.replace(re, "")));
    return { ok: true, message: "已启用「" + name + "」（HMR 生效，无需重启）", rowId };
  }
  if (state.disables.includes(rowId)) {
    return {
      ok: false,
      action: "patch-mismatch",
      message: "发现「" + name + "」的停用标记但未能定位到可移除的补丁块（补丁可能被外部修改或写法不一致）",
      hint: "请手动检查 " + path + " 中该 id 的 disabled 标记",
      rowId,
    };
  }
  return { ok: true, message: "插件「" + name + "」本就在启用状态（无需补丁）", already: true };
}

/** 获取插件的启用状态（考虑 user patch 层的停用标记）。 */
export function pluginEnabledState(profile: string, name: string) {
  const scan = scanProfile(profile);
  const plugin = scan.plugins.find((p) => p.name === name);
  if (plugin === undefined) return { exists: false };
  const rowId = rowIdForPlugin(profile, name);
  const state = readUserPatchState(profile);
  const disabledByPatch = state.disables.includes(rowId);
  const enabled = plugin.enabled && !disabledByPatch;
  return { exists: true, rowId, enabled, disabledByPatch, bundleEnabled: plugin.enabled };
}

/** 直接编辑 package.json：移除悬挂声明插件的依赖与 bundle 项。 */
export function editManifestRemove(profile: string, name: string): boolean {
  const manifestPath = join(profileDir(profile), "package.json");
  let manifest: any = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return false;
  }
  let changed = false;
  const deps = manifest.dependencies || {};
  if (name in deps) {
    delete deps[name];
    manifest.dependencies = deps;
    changed = true;
  }
  if (manifest.dsh?.profile?.bundles !== undefined && Array.isArray(manifest.dsh.profile.bundles) && manifest.dsh.profile.bundles.includes(name)) {
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter((b: string) => b !== name);
    changed = true;
  }
  if (changed) {
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }
  return changed;
}
