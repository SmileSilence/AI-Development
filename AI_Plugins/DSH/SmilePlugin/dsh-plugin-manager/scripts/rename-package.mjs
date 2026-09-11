// 一次性综合改造脚本（UTF-8 安全）：dsh-plugin-manager → smilexx-skill-mcp-manager
// 处理：index.ts（删 plugin 模块 + 改名）、mcp/wire.ts、patch-editor.ts、cli-skill.ts、
//       skill-files.ts、scope.ts、groups.ts、mcp/*.ts、global-shim.ts、cli-mcp.ts
// 保护：patch-editor.ts 的受管块标记 "dsh-skill-mcp-panel:mcp"（既有数据兼容，不替换）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function read(rel) {
  return readFileSync(root + rel, "utf8").replace(/\r\n/g, "\n");
}
function write(rel, text) {
  // 统一 LF 行尾（与已改造文件一致）
  writeFileSync(root + rel, text.replace(/\r\n/g, "\n"), "utf8");
}

// ── index.ts：结构化删除 plugin 模块引用 + 改名 ──────────────────────────
{
  let s = read("src/index.ts");

  // 1. 删除 plugin imports（三行精确匹配）
  const pluginImports = [
    'import { PLUGINS_MANIFEST, PluginsViewerGateway } from "./plugin/service.js";\n',
    'import { registerPluginTools } from "./plugin/tools.js";\n',
    'import { argvProfile } from "./plugin/scan.js";\n'
  ];
  for (const imp of pluginImports) {
    if (!s.includes(imp)) throw new Error("index.ts import not found: " + imp.trim());
    s = s.replace(imp, "");
  }

  // 2. name + 头部注释
  s = s.replace('export const name = "dsh-plugin-manager";', 'export const name = "smilexx-skill-mcp-manager";');
  s = s.replace(" * dsh-plugin-manager —— 宿主半区。", " * smilexx-skill-mcp-manager —— 宿主半区。");

  // 3. PANEL_MANIFEST 去掉 PLUGINS_MANIFEST
  const oldPanel = "  invocations: [...MANIFEST.invocations, ...MCP_MANIFEST.invocations, ...PLUGINS_MANIFEST.invocations]";
  if (!s.includes(oldPanel)) throw new Error("index.ts PANEL_MANIFEST not found");
  s = s.replace(oldPanel, "  invocations: [...MANIFEST.invocations, ...MCP_MANIFEST.invocations]");

  // 4. apply()：删除 profile/PluginsViewerGateway/registerPluginTools
  const oldApply = `export function apply(ctx: any, config: any = {}) {
  ensureGlobalShim(ctx.logger);
  new SkillsViewerGateway(ctx);
  new McpManagerGateway(ctx);
  const profile = typeof config?.profile === "string" && config.profile !== "" ? config.profile : argvProfile();
  new PluginsViewerGateway(ctx, profile);
  ctx.effect(() => ctx.typert.register(PANEL_MANIFEST), "dsh-plugin-manager: typert manifest");
  ctx.skills.registerProvider((control) => new NestedSkillProvider(NESTED_SKILL_RANK, control.signal, control.invalidate));
  registerPluginTools(ctx, profile);
}`;
  const newApply = `export function apply(ctx: any, config: any = {}) {
  ensureGlobalShim(ctx.logger);
  new SkillsViewerGateway(ctx);
  new McpManagerGateway(ctx);
  ctx.effect(() => ctx.typert.register(PANEL_MANIFEST), "smilexx-skill-mcp-manager: typert manifest");
  ctx.skills.registerProvider((control) => new NestedSkillProvider(NESTED_SKILL_RANK, control.signal, control.invalidate));
}`;
  if (!s.includes(oldApply)) throw new Error("index.ts apply() not found");
  s = s.replace(oldApply, newApply);

  // 5. 全局改名（typeSymbol/package 前缀）
  const n = (s.match(/dsh-plugin-manager/g) || []).length;
  s = s.replace(/dsh-plugin-manager/g, "smilexx-skill-mcp-manager");

  write("src/index.ts", s);
  console.log(`index.ts: imports removed, name changed, apply simplified, ${n} symbols renamed`);
}

// ── mcp/wire.ts：改名 ──────────────────────────────────────────────────────
{
  let s = read("src/mcp/wire.ts");
  const n = (s.match(/dsh-plugin-manager/g) || []).length;
  s = s.replace(/dsh-plugin-manager/g, "smilexx-skill-mcp-manager");
  write("src/mcp/wire.ts", s);
  console.log(`mcp/wire.ts: ${n} symbols renamed`);
}

// ── 其余源文件：注释/日志中的项目名（dsh-plugin-manager 与 dsh-skill-mcp-panel）──
// 保护受管块标记：dsh-skill-mcp-panel:mcp 不替换（patch-editor.ts 数据兼容）
{
  const files = [
    "src/patch-editor.ts",
    "src/cli-skill.ts",
    "src/cli-mcp.ts",
    "src/skill-files.ts",
    "src/scope.ts",
    "src/groups.ts",
    "src/provider.ts",
    "src/global-shim.ts",
    "src/mcp/gateway.ts",
    "src/mcp/model.ts",
    "src/mcp/probe.ts",
    "src/mcp/status.ts"
  ];
  for (const rel of files) {
    let s = read(rel);
    const old = s;
    // dsh-plugin-manager → 新名（global-shim 日志前缀等）
    s = s.replace(/dsh-plugin-manager/g, "smilexx-skill-mcp-manager");
    // dsh-skill-mcp-panel → 新名，但排除后随 :mcp 的受管块标记
    s = s.replace(/dsh-skill-mcp-panel(?!:mcp)/g, "smilexx-skill-mcp-manager");
    if (s !== old) {
      write(rel, s);
      console.log(`${rel}: renamed`);
    } else {
      console.log(`${rel}: unchanged`);
    }
  }
}

// ── 校验 ──────────────────────────────────────────────────────────────────
{
  const mustKeep = read("src/patch-editor.ts");
  if (!mustKeep.includes('"# >>> dsh-skill-mcp-panel:mcp:begin"')) throw new Error("managed block begin marker lost!");
  if (!mustKeep.includes('"# <<< dsh-skill-mcp-panel:mcp:end"')) throw new Error("managed block end marker lost!");
  console.log("managed block markers preserved");
  for (const rel of ["src/index.ts", "src/mcp/wire.ts", "src/patch-editor.ts", "src/cli-skill.ts", "src/scope.ts", "src/skill-files.ts", "src/groups.ts", "src/mcp/gateway.ts", "src/mcp/model.ts", "src/mcp/probe.ts", "src/mcp/status.ts", "src/global-shim.ts", "src/cli-mcp.ts", "src/provider.ts"]) {
    const s = read(rel);
    if (/[\u4e00-\u9fff]/.test(s) === false) console.warn(`  warn: no CJK in ${rel}`);
    const leftover = (s.match(/dsh-plugin-manager|dsh-skill-mcp-panel(?!:mcp)/g) || []);
    if (leftover.length > 0) console.warn(`  leftover in ${rel}: ${leftover.join(",")}`);
  }
  console.log("all source renames complete");
}
