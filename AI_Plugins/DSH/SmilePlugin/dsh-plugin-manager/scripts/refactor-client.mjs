// 一次性改造脚本：dsh-plugin-manager → smilexx-skill-mcp-manager
// 1) 删除插件管理 UI：cssPlugin、p 类名对象、NS_PLUGINS 字典、pluginsViewer 描述符、PluginsSection 组件
// 2) apply() 改注册 settings.section ×2（技能 order 16 / MCP order 16.5）
// 3) 全局换名 dsh-plugin-manager → smilexx-skill-mcp-manager
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../src/client.ts", import.meta.url));
let src = readFileSync(file, "utf8");
const orig = src;

function cut(from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error("anchor not found (start): " + label);
  const j = src.indexOf(to, i + from.length);
  if (j < 0) throw new Error("anchor not found (end): " + label);
  const removed = src.slice(i, j + to.length);
  src = src.slice(0, i) + src.slice(j + to.length);
  console.log(`removed ${label}: ${removed.split("\n").length} lines`);
}

// 1a. cssPlugin 常量（含前导注释行若无）——从 "const cssPlugin = " 到行尾
{
  const i = src.indexOf("const cssPlugin = ");
  if (i < 0) throw new Error("cssPlugin not found");
  const lineEnd = src.indexOf("\n", i);
  src = src.slice(0, i) + src.slice(lineEnd + 1);
  console.log("removed cssPlugin constant");
}

// 1b. css 拼接去掉 + cssPlugin
{
  const oldCss = "const css = cssChrome + cssCards + cssAdd + cssScope + cssMigrate + cssGroupDelete + cssCategory + cssTree + cssIcon + cssIconMcp + cssPlugin;";
  if (!src.includes(oldCss)) throw new Error("css concat not found");
  src = src.replace(oldCss, "const css = cssChrome + cssCards + cssAdd + cssScope + cssMigrate + cssGroupDelete + cssCategory + cssTree + cssIcon + cssIconMcp;");
  console.log("css concat updated");
}

// 1c. p 类名对象（插件面板类名）
cut("// 插件面板类名（与 cssPlugin 对应）", "};", "p classnames object");

// 1d. NS_PLUGINS / zhPlugins / enPlugins 字典块
cut("// ── 插件面板文案 ──", "};", "NS_PLUGINS dicts");

// 1e. pluginsViewer 描述符（CONTRIBUTION 内 7 个 invocation）
{
  const anchorStart = '{\n\t\t\t\t\tid: "dsh-plugin-manager#pluginsViewer/list"';
  const idx = src.indexOf(anchorStart);
  if (idx < 0) throw new Error("pluginsViewer descriptors not found");
  // 回退到前一个逗号（mcpManager/reload 条目结尾的 ,）
  const comma = src.lastIndexOf(",", idx);
  if (comma < 0) throw new Error("comma before pluginsViewer not found");
  const anchorEnd = 'result: codec("dsh-plugin-manager#PluginOpResult")';
  const endAnchor = src.indexOf(anchorEnd);
  if (endAnchor < 0) throw new Error("pluginsViewer end anchor not found");
  const close = src.indexOf("}", endAnchor);
  const removed = src.slice(comma, close + 1);
  src = src.slice(0, comma) + src.slice(close + 1);
  console.log(`removed pluginsViewer descriptors: ${removed.split("\n").length} lines`);
}

// 1f. PluginsSection 组件（含内部 renderListTab/renderDuplicatesTab/renderInstallDialog）
{
  const startAnchor = "\t\tfunction PluginsSection(props) {";
  const endAnchor = "\t\t// ── cordis 插件体";
  const i = src.indexOf(startAnchor);
  if (i < 0) throw new Error("PluginsSection start not found");
  const j = src.indexOf(endAnchor, i);
  if (j < 0) throw new Error("PluginsSection end not found");
  const removed = src.slice(i, j);
  src = src.slice(0, i) + src.slice(j);
  console.log(`removed PluginsSection component: ${removed.split("\n").length} lines`);
}

// 2a. apply(): 删除 NS_PLUGINS 字典注册
{
  const line = '\t\t\tctx.effect(() => ctx.locale.register(NS_PLUGINS, { zh: zhPlugins, en: enPlugins }), "dsh-plugin-manager: plugin dictionaries");\n';
  if (!src.includes(line)) throw new Error("NS_PLUGINS register not found");
  src = src.replace(line, "");
  console.log("removed NS_PLUGINS register");
}

// 2b. 删除 pt 绑定
{
  const line = "\t\t\tconst pt = ctx.locale.bind(NS_PLUGINS);\n";
  if (!src.includes(line)) throw new Error("pt bind not found");
  src = src.replace(line, "");
  console.log("removed pt bind");
}

// 2c. 删除 callPlugin
{
  const block = `\t\t\tconst callPlugin = async (method, ...args) => {
\t\t\t\tawait mount;
\t\t\t\tconst remote = ctx.get("remote.pluginsViewer");
\t\t\t\tconst result = await remote[method](...args);
\t\t\t\tif (!result.ok) throw new Error("pluginsViewer." + method + " failed: " + result.error.code + ": " + result.error.message);
\t\t\t\treturn result.value;
\t\t\t};
`;
  if (!src.includes(block)) throw new Error("callPlugin not found");
  src = src.replace(block, "");
  console.log("removed callPlugin");
}

// 2d. 删除 pluginSectionFace（含 skills/mcp 包装），替换为两个 settings.section 注册
{
  const blockStart = "\t\t\tconst pluginSectionFace = () => ({";
  const blockEnd = "\t\t\t});\n";
  const i = src.indexOf(blockStart);
  if (i < 0) throw new Error("pluginSectionFace start not found");
  const j = src.indexOf(blockEnd, i + blockStart.length);
  if (j < 0) throw new Error("pluginSectionFace end not found");
  src = src.slice(0, i) + src.slice(j + blockEnd.length);
  console.log("removed pluginSectionFace");
}

// 2e. 替换 settings.plugins.tab 注入为 settings.section ×2（基座注册模式）
{
  const oldBlock = `\t\t\t\t\t\t// 插件管理：注册为原生「插件」模块的一个 Tab（settings.plugins.tab，
\t\t\t// order 20，位于已配置/已安装之后）。
\t\t\tctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
\t\t\t\tname: "settings.plugins.tab",
\t\t\t\tid: "dsh-plugin-manager",
\t\t\t\torder: 20,
\t\t\t\tlabel: () => pt("nav"),
\t\t\t\tlocale: NS_PLUGINS,
\t\t\t\tinject: pluginSectionFace
\t\t\t}, PluginsSection));`;
  if (!src.includes(oldBlock)) {
    // 若缩进不同，尝试宽松匹配
    const alt = src.indexOf('ctx.slots.inject("settings.plugins.tab"');
    if (alt < 0) throw new Error("settings.plugins.tab inject not found");
    const close = src.indexOf("}, PluginsSection));", alt);
    if (close < 0) throw new Error("settings.plugins.tab close not found");
    src = src.slice(0, alt) + src.slice(close + "}, PluginsSection));".length);
    console.log("removed old settings.plugins.tab inject (loose)");
  } else {
    src = src.replace(oldBlock, "");
    console.log("removed old settings.plugins.tab inject");
  }
  const newBlock = `\t\t\t// 注册「技能」设置栏（order 16：位于「插件」15 与「agent 预设」20 之间）。
\t\t\tctx.slots.inject("settings.section", () => ctx.slots.register({
\t\t\t\tname: "settings.section",
\t\t\t\tid: "skills",
\t\t\t\torder: 16,
\t\t\t\tlabel: () => t("nav"),
\t\t\t\tlocale: NS,
\t\t\t\tinject: sectionFace
\t\t\t}, SkillsSection));
\t\t\t// MCP：order 16.5，位于「技能」(16) 下方。
\t\t\tctx.slots.inject("settings.section", () => ctx.slots.register({
\t\t\t\tname: "settings.section",
\t\t\t\tid: "mcp",
\t\t\t\torder: 16.5,
\t\t\t\tlabel: () => mt("nav"),
\t\t\t\tlocale: MCP_NS,
\t\t\t\tinject: mcpSectionFace
\t\t\t}, (props) => jsx(McpSection, { ...props, t: mt })));
`;
  src = src.replace("\t\t}", newBlock + "\t\t}"); // apply() 收尾大括号前插入
  console.log("inserted settings.section x2");
}

// 3. 全局换名（剩余所有 dsh-plugin-manager 引用）
{
  const count = (src.match(/dsh-plugin-manager/g) || []).length;
  src = src.replace(/dsh-plugin-manager/g, "smilexx-skill-mcp-manager");
  console.log(`renamed ${count} remaining occurrences`);
}

if (src === orig) throw new Error("no changes were made");
writeFileSync(file, src, "utf8");
console.log("client.ts refactor complete");
