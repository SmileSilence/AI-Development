/**
 * dsh-plugin-manager — 插件管理服务层：命令执行 / 安装 / 删除（修复版）/ 报告，
 * 以及 Typert 远程服务 pluginsViewer 与 dpm_* Agent 工具注册。
 *
 * 修复点（相对旧版）：
 *   - removePlugin 成功后重扫校验：dependencies 与 dsh.profile.bundles 残留
 *     自动 editManifestRemove 兜底，返回 removed-with-issues；
 *   - EPERM（跨盘/占用）识别并返回结构化提示；
 *   - install/remove 不再写操作历史（决策 D1）。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import {
  Anomaly, CATEGORY_ORDER, PluginEntry, ScanResult, classify, detectDuplicates,
  mergeLoaderEntries, profileDir, scanDuplicates, scanProfile,
} from "./scan.js";
import { disablePlugin, editManifestRemove, enablePlugin, pluginEnabledState, rowIdForPlugin } from "./patch.js";

// ── 包名/命令 ─────────────────────────────────────────────────

/** 从 spec 提取包名。 */
export function extractPackageName(spec: string): string {
  spec = String(spec || "").trim();
  if (spec.startsWith("github:") || spec.startsWith("git+")) {
    const colon = spec.indexOf(":");
    const pathPart = colon >= 0 ? spec.slice(colon + 1) : spec;
    const repo = pathPart.split("#")[0].replace(/\/+$/, "").split("/").pop() ?? spec;
    return repo.replace(/\.git$/, "");
  }
  if (spec.startsWith("link:") || spec.startsWith("file:")) {
    const colon = spec.indexOf(":");
    const pathPart = colon >= 0 ? spec.slice(colon + 1) : spec;
    return pathPart.split(/[\\/]/).pop() || spec;
  }
  const at = spec.lastIndexOf("@");
  if (at > 0 && !spec.slice(at + 1).includes("/")) return spec.slice(0, at);
  return spec;
}

/** 构造重新调用当前 dsh 进程的 argv；无法重入时返回 null（调用方回退 pnpm）。 */
function dshArgv(): { file: string; args: string[]; cwd: string } | null {
  const entry = process.argv[1];
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry);
    return { file: process.execPath, args: [...process.execArgv, abs], cwd: dirname(abs) };
  }
  return null;
}

/** cmd.exe 转义。 */
const CMD_METACHARS = /[\s"&|<>^()%!]/;
function quoteCmdArg(arg: string): string {
  return CMD_METACHARS.test(arg) ? '"' + arg.replace(/"/g, '""') + '"' : arg;
}

/** 跨平台 spawn：Windows 用 cmd /d /s /c 包装。 */
function spawnCommand(file: string, args: string[], cwd: string | undefined, env: NodeJS.ProcessEnv) {
  if (process.platform === "win32") {
    const commandLine = [file, ...args].map(quoteCmdArg).join(" ");
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", '"' + commandLine + '"'], {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsVerbatimArguments: true,
    });
  }
  return spawnSync(file, args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * 执行一次 dsh plugin 命令；dsh 不可用时回退 pnpm --dir。
 * @returns { exitCode, stdout, stderr, tool }
 */
export function runPlugin(profile: string, pluginArgs: string[]) {
  const dir = profileDir(profile);
  const env = { ...process.env, CI: "true" };
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ name: "dsh-profile-" + profile, private: true, dependencies: {} }, null, 2) + "\n", "utf8");
  }
  const reentry = dshArgv();
  if (reentry !== null) {
    const result = spawnCommand(reentry.file, [...reentry.args, "plugin", "--profile", profile, ...pluginArgs], reentry.cwd, env);
    if (result.error === undefined) {
      return { exitCode: result.status ?? 1, stdout: String(result.stdout ?? ""), stderr: String(result.stderr ?? ""), tool: "dsh" };
    }
  }
  const fallback = spawnCommand("pnpm", ["--dir", dir, ...pluginArgs], dir, env);
  if (fallback.error !== undefined) {
    return { exitCode: 127, stdout: "", stderr: String(fallback.error.message ?? fallback.error), tool: "pnpm" };
  }
  return { exitCode: fallback.status ?? 1, stdout: String(fallback.stdout ?? ""), stderr: String(fallback.stderr ?? ""), tool: "pnpm" };
}

// ── 安装（无历史） ────────────────────────────────────────────

function finishInstall({ profile, spec, category, categoryOverride, description, toRemove, nameHint }: {
  profile: string; spec: string; category: string; categoryOverride: string | null;
  description: string | null; toRemove: PluginEntry[]; nameHint: string;
}) {
  const result = runPlugin(profile, ["add", spec]);
  if (result.exitCode !== 0) {
    return {
      ok: false,
      action: "install-failed",
      message: "安装失败（退出码 " + result.exitCode + "）。git 源插件被 pnpm 阻止构建时，请将报错中提到的包名加入 " + join(profileDir(profile), "pnpm-workspace.yaml") + " 的 allowBuilds 后重试",
      exitCode: result.exitCode,
      stderr: result.stderr.slice(-2000),
    };
  }
  for (const plugin of toRemove) {
    const r = runPlugin(profile, ["remove", plugin.name]);
    if (r.exitCode !== 0) {
      return { ok: false, action: "remove-same-category-failed", message: "删除 " + plugin.name + " 失败（退出码 " + r.exitCode + "），请手动处理" };
    }
  }
  const refreshed = scanProfile(profile);
  const installedMeta: { name: string; spec: string; command: string }[] = [];
  const removedMeta: { name: string; spec: string | null; command: string }[] = [];
  const normSpec = (s: string) => String(s).replace(/^git\+https?:\/\/github\.com\//, "github:").replace(/\.git$/, "");
  for (const p of refreshed.plugins) {
    const sameSpec = p.spec === spec || normSpec(p.spec ?? "") === normSpec(spec);
    const sameName = nameHint !== "" && (p.name === nameHint || p.name.split("/").pop() === nameHint);
    if (sameSpec || sameName) {
      installedMeta.push({ name: p.name, spec, command: "dsh plugin --profile " + profile + " add " + spec });
    }
  }
  for (const p of toRemove) {
    removedMeta.push({ name: p.name, spec: p.spec, command: "dsh plugin --profile " + profile + " remove " + p.name });
  }
  return {
    ok: true,
    action: "installed",
    message: "安装完成：" + spec + (toRemove.length > 0 ? "，已删除同类：" + toRemove.map((p) => p.name).join(", ") : ""),
    category,
    installed: installedMeta,
    removed: removedMeta,
    note: "请重启 DSH（Web GUI）使插件生效",
  };
}

/**
 * 安装插件（决策 D1：不写历史）。
 * keep：auto=全自动（同名/功能被完全包含则跳过）；new=替换全部同类；
 * existing=保留已装取消安装；all=保留全部仅安装；null=返回决策清单。
 */
export function installPlugin({ profile, spec, categoryOverride = null, description = null, keep = null }: {
  profile: string; spec: string; categoryOverride?: string | null; description?: string | null; keep?: string | null;
}) {
  const scan = scanProfile(profile);
  const nameHint = extractPackageName(spec);
  const category = categoryOverride || classify(nameHint);
  const candidate = { name: nameHint, category, description };
  const dup = detectDuplicates(profile, candidate);
  const auto = keep === "auto";
  const decisions: any[] = [];

  if (dup.sameName != null) {
    if (auto) {
      return { ok: true, action: "skipped-same-name", message: "已安装同名插件「" + dup.sameName.name + "」（" + dup.sameName.spec + "），全自动模式下跳过安装", duplicate: dup.sameName };
    }
    decisions.push({
      kind: "same-name",
      message: "已安装同名插件「" + dup.sameName.name + "」v" + (dup.sameName.version ?? "?") + "（spec: " + dup.sameName.spec + "）。继续安装将覆盖其依赖声明。",
      plugin: { name: dup.sameName.name, version: dup.sameName.version, spec: dup.sameName.spec },
    });
  }

  if (dup.fullyCoveredBy.length > 0) {
    if (auto) {
      return {
        ok: true,
        action: "skipped-fully-covered",
        message: "「" + nameHint + "」的全部功能已被以下已启用插件包含，全自动模式下跳过安装：" + dup.fullyCoveredBy.map((p) => p.name).join(", "),
        coveredBy: dup.fullyCoveredBy.map((p) => p.name),
      };
    }
    decisions.push({
      kind: "fully-covered",
      message: "「" + nameHint + "」的全部功能已被以下已启用插件完全包含，功能重叠：" + dup.fullyCoveredBy.map((p) => p.name).join(", "),
      coveredBy: dup.fullyCoveredBy.map((p) => ({ name: p.name, version: p.version, description: p.description })),
    });
  }

  if (dup.sameCategory.length > 0 && dup.fullyCoveredBy.length === 0) {
    if (auto) {
      keep = "all";
    } else if (keep === "new") {
      return finishInstall({ profile, spec, category, categoryOverride, description, toRemove: dup.sameCategory, nameHint });
    } else if (keep === "existing") {
      return { ok: true, action: "cancelled-same-category", message: "保留已装插件，取消本次安装（同类 " + dup.sameCategory.length + " 个）", category, sameCategory: dup.sameCategory };
    } else if (keep !== "all") {
      decisions.push({
        kind: "same-category",
        message: "检测到 " + dup.sameCategory.length + " 个同类插件（类别「" + category + "」），需要决定保留/删除",
        category,
        sameCategory: dup.sameCategory.map((p) => ({ name: p.name, version: p.version, description: p.description, installed: p.installed })),
      });
    }
  }

  if (decisions.length > 0) {
    return {
      ok: false,
      requiresDecision: true,
      decisions,
      hint: "请让用户决定（同名/功能重复/同类），或用 keep=auto/new/existing/all 重新调用 dpm_install",
    };
  }

  return finishInstall({ profile, spec, category, categoryOverride, description, toRemove: [], nameHint });
}

// ── 删除（修复版，无历史） ────────────────────────────────────

/**
 * 删除插件。修复：命令成功后重扫校验 dependencies 与 dsh.profile.bundles
 * 残留并自动清理（editManifestRemove 兜底）；EPERM 识别为结构化错误。
 */
export function removePlugin({ profile, name }: { profile: string; name: string }) {
  const scan = scanProfile(profile);
  const plugin = scan.plugins.find((p) => p.name === name);
  if (plugin === undefined) {
    return { ok: false, action: "not-found", message: "未在 dependencies 中找到插件「" + name + "」，请先确认包名" };
  }

  let cmdStr: string;
  if (plugin.installed) {
    const result = runPlugin(profile, ["remove", name]);
    if (result.exitCode !== 0) {
      const eperm = /EPERM|EACCES/.test(result.stderr) || /EPERM|EACCES/.test(result.stdout);
      if (eperm) {
        return {
          ok: false,
          action: "remove-eperm",
          message: "删除失败：EPERM（文件被占用或跨盘移动受限）",
          hint: "请关闭占用该目录的程序后重试；跨盘场景可手动解包：将 node_modules 中残留目录移走后再执行本操作",
          exitCode: result.exitCode,
          stderr: result.stderr.slice(-2000),
        };
      }
      return { ok: false, action: "remove-failed", message: "删除失败（退出码 " + result.exitCode + "）", exitCode: result.exitCode, stderr: result.stderr.slice(-2000) };
    }
    cmdStr = "dsh plugin --profile " + profile + " remove " + name;
  } else {
    editManifestRemove(profile, name);
    cmdStr = "（无命令，直接编辑 package.json）";
  }

  // 卸载后校验：dependencies 与 dsh.profile.bundles 不得残留。
  const issues: string[] = [];
  const manifestPath = join(profileDir(profile), "package.json");
  let manifest: any = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch { /* 忽略 */ }
  const stillInDeps = manifest?.dependencies !== undefined && name in manifest.dependencies;
  const stillInBundles = manifest?.dsh?.profile?.bundles !== undefined && Array.isArray(manifest.dsh.profile.bundles) && manifest.dsh.profile.bundles.includes(name);
  if (stillInDeps || stillInBundles) {
    editManifestRemove(profile, name);
    const parts: string[] = [];
    if (stillInDeps) parts.push("dependencies 声明残留");
    if (stillInBundles) parts.push("dsh.profile.bundles 残留");
    issues.push(parts.join("、") + "，已自动清理（editManifestRemove）");
  }

  return {
    ok: true,
    action: issues.length > 0 ? "removed-with-issues" : "removed",
    message: "已删除：" + name + (issues.length > 0 ? "（" + issues.join("；") + "）" : ""),
    plugin: { name, category: plugin.category, spec: plugin.spec },
    ...(issues.length > 0 ? { issues } : {}),
  };
}

// ── 报告（无历史） ────────────────────────────────────────────

function escapeCell(text: string | null | undefined): string {
  if (!text) return "—";
  return String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function anchor(text: string): string {
  return String(text).toLowerCase().replace(/ /g, "-");
}

function nowStr(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/** 生成 Markdown 清单（决策 D1：不含操作历史段）。 */
/** 异常项处理动作：cleanup=清理悬挂声明；remove=卸载插件；retry/manual=返回提示。 */
export function anomalyAction({ profile, plugin, kind }: { profile: string; plugin: string; kind: string }) {
  if (kind === "cleanup") {
    const changed = editManifestRemove(profile, plugin);
    return {
      ok: true,
      action: changed ? "cleaned" : "nothing-to-clean",
      message: changed ? "已清理「" + plugin + "」的 dependencies 与 dsh.profile.bundles 残留声明" : "「" + plugin + "」没有需要清理的声明",
    };
  }
  if (kind === "remove") {
    return removePlugin({ profile, name: plugin });
  }
  if (kind === "retry") {
    return {
      ok: false,
      action: "retry-manual",
      message: "重试需先重新启用或重装「" + plugin + "」；若反复失败请查看网关日志",
      hint: "在插件清单中对该插件执行启用操作后再观察",
    };
  }
  return { ok: false, action: "manual", message: "该项需手动处理：请检查 profile 配置后重试" };
}

export function generateReport(profile: string): string {
  const scan = scanProfile(profile);
  const lines: string[] = [];
  lines.push("# DeepSeek Harness 插件清单（非自带）");
  lines.push("");
  lines.push("> 生成时间：" + nowStr());
  lines.push("> 管理项目：dsh-plugin-manager");
  lines.push("> Profile：" + profile + "（" + profileDir(profile) + "）");
  lines.push("");

  const installedCount = scan.plugins.filter((p) => p.installed).length;
  const enabledCount = scan.plugins.filter((p) => p.enabled).length;
  const categoriesUsed = new Set(scan.plugins.map((p) => p.category));
  lines.push("## 概览");
  lines.push("");
  lines.push("| 统计项 | 数值 |");
  lines.push("|---|---|");
  lines.push("| 非自带插件总数 | " + scan.plugins.length + " |");
  lines.push("| 已安装 | " + installedCount + " |");
  lines.push("| 已启用（加入 bundle 层） | " + enabledCount + " |");
  lines.push("| 类别数 | " + categoriesUsed.size + " |");
  lines.push("| 异常项 | " + scan.anomalies.length + " |");
  lines.push("");
  lines.push("> 自带插件（dsh-root、dsh-base、dsh-web-app 等）不纳入本清单。");
  lines.push("");

  lines.push("## 分类索引");
  lines.push("");
  for (const category of CATEGORY_ORDER) {
    const members = scan.plugins.filter((p) => p.category === category);
    if (members.length === 0) continue;
    const installedIn = members.filter((p) => p.installed).length;
    lines.push("- [" + category + "](#" + anchor(category) + ")：" + members.length + " 个（已安装 " + installedIn + "）");
  }
  lines.push("");

  for (const category of CATEGORY_ORDER) {
    const members = scan.plugins.filter((p) => p.category === category);
    if (members.length === 0) continue;
    lines.push("## " + category);
    lines.push("");
    lines.push("| 插件名 | 版本 | 来源 | 状态 | 安装命令 | 描述 |");
    lines.push("|---|---|---|---|---|---|");
    const sorted = [...members].sort((a, b) => (a.installed === b.installed ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : a.installed ? -1 : 1));
    for (const p of sorted) {
      const status = !p.installed ? "❌ 声明未安装" : p.enabled ? "✅ 已启用" : "⚠️ 已安装未启用";
      const installSpec = p.source === "github" || p.source === "git" ? p.spec : p.name;
      lines.push("| " + escapeCell(p.name) + " | " + escapeCell(p.version) + " | " + p.source + " | " + status + " | dsh plugin --profile " + profile + " add " + installSpec + " | " + escapeCell(p.description) + " |");
    }
    lines.push("");
  }

  if (scan.anomalies.length > 0) {
    lines.push("## 异常与提示");
    lines.push("");
    for (const anomaly of scan.anomalies) lines.push("- " + anomaly.message);
    lines.push("");
  }

  lines.push("");
  lines.push("---");
  lines.push("*由 dsh-plugin-manager 自动生成，请勿手工编辑。*");
  lines.push("");
  return lines.join("\n");
}

// ── Typert 远程服务 pluginsViewer ────────────────────────────

const pluginSchema = z.object({
  name: z.string(),
  spec: z.string().nullable(),
  category: z.string(),
  installed: z.boolean(),
  enabled: z.boolean(),
  version: z.string().nullable(),
  description: z.string().nullable(),
  source: z.string(),
  managed: z.boolean(),
  loaderEntry: z.object({ entryId: z.string().nullable(), fiberPhase: z.string().nullable() }).nullable().optional(),
  enabledState: z.object({ enabled: z.boolean(), disabledByPatch: z.boolean() }).optional(),
});

const anomalySchema = z.object({
  kind: z.enum(["missing-profile-manifest", "dangling-dependency", "loader-failed-entry", "patch-write-failure", "invalid-spec"]),
  plugin: z.string().optional(),
  message: z.string(),
  hint: z.string().optional(),
  action: z.enum(["cleanup", "remove", "retry", "manual"]).optional(),
});

const listResultSchema = z.object({
  profile: z.string(),
  profileDir: z.string(),
  plugins: z.array(pluginSchema),
  anomalies: z.array(anomalySchema),
});

const decisionSchema = z.object({
  kind: z.enum(["same-name", "fully-covered", "same-category"]),
  message: z.string(),
  plugin: z.object({ name: z.string(), version: z.string().nullable(), spec: z.string() }).optional(),
  category: z.string().optional(),
  coveredBy: z.array(z.object({ name: z.string(), version: z.string().nullable(), description: z.string().nullable() })).optional(),
  sameCategory: z.array(z.object({ name: z.string(), version: z.string().nullable(), description: z.string().nullable(), installed: z.boolean() })).optional(),
});

const installResultSchema = z.object({
  ok: z.boolean(),
  action: z.string().optional(),
  message: z.string().optional(),
  requiresDecision: z.boolean().optional(),
  hint: z.string().optional(),
  decisions: z.array(decisionSchema).optional(),
  category: z.string().optional(),
  installed: z.array(z.object({ name: z.string(), spec: z.string(), command: z.string() })).optional(),
  removed: z.array(z.object({ name: z.string(), spec: z.string().nullable(), command: z.string() })).optional(),
  note: z.string().optional(),
  exitCode: z.number().optional(),
  stderr: z.string().optional(),
  coveredBy: z.array(z.string()).optional(),
});

const opResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  already: z.boolean().optional(),
  action: z.string().optional(),
  rowId: z.string().optional(),
  blockedByDuplicate: z.boolean().optional(),
  coveredBy: z.array(z.string()).optional(),
  hint: z.string().optional(),
  exitCode: z.number().optional(),
  stderr: z.string().optional(),
  issues: z.array(z.string()).optional(),
  plugin: z.object({ name: z.string(), category: z.string(), spec: z.string().nullable() }).optional(),
});

const duplicatesResultSchema = z.object({
  scanned: z.number(),
  groups: z.array(z.object({
    kind: z.enum(["fully-covered", "overlap"]),
    sharedWords: z.array(z.string()),
    covered: z.object({ name: z.string(), version: z.string().nullable(), category: z.string().nullable(), enabled: z.boolean(), description: z.string().nullable() }).optional(),
    covering: z.object({ name: z.string(), version: z.string().nullable(), category: z.string().nullable(), enabled: z.boolean(), description: z.string().nullable() }).optional(),
    plugins: z.array(z.object({ name: z.string(), version: z.string().nullable(), category: z.string().nullable(), enabled: z.boolean(), description: z.string().nullable() })).optional(),
  })),
});

const installPayloadSchema = z.object({
  spec: z.string().min(1),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  keep: z.string().nullable().optional(),
});

const opPayloadSchema = z.object({
  name: z.string().min(1),
  yes: z.boolean().optional(),
  force: z.boolean().optional(),
});

const anomalyActionPayloadSchema = z.object({
  plugin: z.string().min(1),
  kind: z.enum(["cleanup", "remove", "retry", "manual"]),
});

/** 注册到 API 网关的类型化 wire 描述符。 */
export const PLUGINS_MANIFEST = {
  package: "dsh-plugin-manager",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "dsh-plugin-manager#pluginsViewer/list",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "list",
      invocation: { kind: "direct" },
      parameters: [],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginListResult", schema: listResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/installPlugin",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "installPlugin",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginInstallPayload", schema: installPayloadSchema } },
      ],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginInstallResult", schema: installResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/enable",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "enable",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpPayload", schema: opPayloadSchema } },
      ],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpResult", schema: opResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/disable",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "disable",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpPayload", schema: opPayloadSchema } },
      ],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpResult", schema: opResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/removePlugin",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "removePlugin",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpPayload", schema: opPayloadSchema } },
      ],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpResult", schema: opResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/report",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "report",
      invocation: { kind: "direct" },
      parameters: [],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginReportResult", schema: z.object({ markdown: z.string() }) },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/duplicates",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "duplicates",
      invocation: { kind: "direct" },
      parameters: [],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginDuplicatesResult", schema: duplicatesResultSchema },
    },
    {
      id: "dsh-plugin-manager#pluginsViewer/anomalyAction",
      service: "pluginsViewer",
      namespace: "pluginsViewer",
      method: "anomalyAction",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "dsh-plugin-manager#AnomalyActionPayload", schema: anomalyActionPayloadSchema } },
      ],
      result: { mode: "strict", typeSymbol: "dsh-plugin-manager#PluginOpResult", schema: opResultSchema },
    },
  ],
  model: { services: [], events: [], objects: [] },
};

/**
 * 远程服务实例。构造它即注册 "pluginsViewer" cordis 服务。
 */
export class PluginsViewerGateway extends TypertRemoteService {
  constructor(ctx: any, private profile: string) {
    super(ctx, "pluginsViewer");
  }

  /** Loader 实际加载条目（可选能力：无 loader 注入时返回空数组）。 */
  private readLoaderEntries(): any[] {
    const loader = (this.ctx as any).get("loader");
    if (loader === undefined || typeof loader.entries !== "function") return [];
    try {
      const FIBER_PHASE: Record<number, string | null> = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };
      const entries: any[] = [];
      for (const entry of loader.entries()) {
        if (entry.options?.group) continue;
        entries.push({
          entryId: String(entry.id ?? ""),
          moduleName: entry.options?.name ?? null,
          enabled: !entry.disabled,
          fiberPhase: entry.fiber === undefined || entry.fiber === null ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
        });
      }
      return entries;
    } catch {
      return [];
    }
  }

  /** 目录：合并 Loader 条目 + 结构化异常（含 loader-failed-entry）。 */
  async list() {
    const scan = scanProfile(this.profile);
    const merged = mergeLoaderEntries(this.profile, scan, this.readLoaderEntries());
    const plugins = merged.map((p) => {
      const state = pluginEnabledState(this.profile, p.name);
      return state.exists ? { ...p, enabledState: { enabled: state.enabled, disabledByPatch: state.disabledByPatch } } : p;
    });
    const anomalies: Anomaly[] = [...scan.anomalies];
    for (const p of merged) {
      if (p.loaderEntry?.fiberPhase === "failed") {
        anomalies.push({
          kind: "loader-failed-entry",
          plugin: p.name,
          message: "插件「" + p.name + "」被 Loader 加载失败（fiber 状态 failed）",
          hint: "可尝试重新启用（dpm_enable）或删除后重装；若反复失败请查看网关日志",
          action: "retry",
        });
      }
    }
    return {
      profile: this.profile,
      profileDir: profileDir(this.profile),
      plugins,
      anomalies,
    };
  }

  async installPlugin(payload: any) {
    const result = installPlugin({
      profile: this.profile,
      spec: payload.spec,
      categoryOverride: payload.category ?? null,
      description: payload.description ?? null,
      keep: payload.keep ?? null,
    });
    return result;
  }

  async enable(payload: any) {
    const { name, force } = payload;
    const state = pluginEnabledState(this.profile, name);
    if (!state.exists) return { ok: false, message: "插件「" + name + "」未安装或未在 dependencies 中声明" };
    if (state.enabled) return { ok: true, message: "插件「" + name + "」已在启用状态", already: true };
    const scan = scanProfile(this.profile);
    const candidate = scan.plugins.find((p) => p.name === name);
    if (candidate !== undefined && force !== true) {
      const dup = detectDuplicates(this.profile, { name, category: candidate.category });
      if (dup.fullyCoveredBy.length > 0) {
        return {
          ok: false,
          blockedByDuplicate: true,
          message: "「" + name + "」的全部功能已被以下已启用插件完全包含，功能重复：" + dup.fullyCoveredBy.map((p) => p.name).join(", ") + "。请先停用（dpm_disable）或卸载（dpm_remove）重复插件，或传 force=true 强制启用",
          coveredBy: dup.fullyCoveredBy.map((p) => p.name),
        };
      }
    }
    return enablePlugin(this.profile, name);
  }

  async disable(payload: any) {
    const { name } = payload;
    const state = pluginEnabledState(this.profile, name);
    if (!state.exists) return { ok: false, message: "插件「" + name + "」未安装或未在 dependencies 中声明" };
    if (!state.enabled) return { ok: true, message: "插件「" + name + "」已在停用状态", already: true };
    return disablePlugin(this.profile, name);
  }

  async removePlugin(payload: any) {
    const { name, yes } = payload;
    if (yes !== true) {
      return { ok: false, requiresConfirm: true, message: "删除「" + name + "」是不可逆操作，请先确认后再以 yes=true 重试" };
    }
    return removePlugin({ profile: this.profile, name });
  }

  async report() {
    return { markdown: generateReport(this.profile) };
  }

  async duplicates() {
    return { ok: true, ...scanDuplicates(this.profile) };
  }

  /** 异常项处理动作：cleanup=清理悬挂声明；remove=卸载插件；retry/manual=返回提示。 */
  async anomalyAction(payload: any) {
    const { plugin, kind } = payload;
    if (kind === "cleanup") {
      const changed = editManifestRemove(this.profile, plugin);
      return {
        ok: true,
        action: changed ? "cleaned" : "nothing-to-clean",
        message: changed ? "已清理「" + plugin + "」的 dependencies 与 dsh.profile.bundles 残留声明" : "「" + plugin + "」没有需要清理的声明",
      };
    }
    if (kind === "remove") {
      return removePlugin({ profile: this.profile, name: plugin });
    }
    if (kind === "retry") {
      return {
        ok: false,
        action: "retry-manual",
        message: "重试需先重新启用或重装「" + plugin + "」；若反复失败请查看网关日志",
        hint: "在插件清单中对该插件执行启用操作（dpm_enable）后再观察",
      };
    }
    return { ok: false, action: "manual", message: "该项需手动处理：请检查 profile 配置后重试" };
  }
}
