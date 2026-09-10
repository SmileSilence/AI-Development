/**
 * dsh-plugin-manager — 插件扫描 / 分类 / 功能指纹与重复检测（纯逻辑，无 ctx）。
 *
 * 移植自旧版 dsh-plugin-manager v0.1.14 的 lib/core.js（DeepSeekPluginManager），
 * 并按重构计划修复：
 *   - 异常项由纯字符串改为结构化 { kind, plugin?, message, hint?, action? }
 *     （kinds：missing-profile-manifest / dangling-dependency / loader-failed-entry /
 *      patch-write-failure / invalid-spec）。
 *   - 不携带旧版的操作历史与回滚功能。
 * 全部读环境函数只读取必要字段并构造自有 JSON（smilexx-dsh-plugin-creator 四种表示规范）。
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── 常量（与旧版 src/config.py 对齐）─────────────────────────────

/** 类别 → 名称关键词（小写匹配，按顺序首个命中生效）。 */
export const CATEGORY_RULES: [string, string[]][] = [
  ["插件管理", ["market", "manager", "management", "find-plugin", "plugin-console", "console", "store", "shop", "marketplace"]],
  ["界面增强", ["sidebar", "skin", "theme", "web-ui", "ui-all", "ui-", "panel", "aionui", "pet"]],
  ["AI 能力", ["sight", "vision", "image", "describe", "photo", "vlm"]],
  ["MCP 集成", ["mcp"]],
  ["效率工具", ["task-board", "board", "at-file", "git-graph", "drag-and-drop", "todo", "file", "ssh"]],
  ["远程/终端", ["remote", "terminal", "desktop"]],
];

/** 手动归类黑名单关键词：明确归「其他」。 */
const OTHER_KEYWORDS = ["web-ui-settings", "skin-center", "compat"];

/** 类别顺序（报告分组顺序）。 */
export const CATEGORY_ORDER = ["插件管理", "界面增强", "AI 能力", "MCP 集成", "效率工具", "远程/终端", "其他"];

/** 功能指纹特征词表：插件描述/关键词中常见的功能特征（小写）。 */
const FEATURE_WORDS = [
  "market", "marketplace", "plugin", "console", "store", "shop", "find", "inventory", "manager", "management", "hub",
  "sidebar", "skin", "theme", "panel", "ui", "web", "layout", "pet", "avatar", "aionui", "widget",
  "vision", "vlm", "image", "photo", "describe", "sight", "multimodal", "picture",
  "mcp", "model", "context", "protocol", "server",
  "task", "board", "todo", "file", "at-file", "git", "graph", "drag", "drop", "ssh", "search", "schedule", "calendar",
  "remote", "terminal", "desktop", "browser",
  "tool", "code", "bash", "shell", "python", "http", "fetch", "workflow", "agent", "subagent",
];

/** 自带插件识别。 */
const BUILTIN_ROOT_PACKAGES = new Set(["@deepseek-ai/dsh-root"]);
export const TEMPLATE_BUNDLES = new Set(["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]);
const LINK_SPEC_MARKERS = ["link:", "file:"];
const CHECKOUT_MARKERS = ["deepseek-harness"];

/** 插件描述中文覆盖：package.json 为英文原文时，扫描后自动替换为中文。 */
const DESCRIPTION_OVERRIDES: Record<string, string> = {
  dshmarket: "DSH 可视化插件市场——浏览、搜索、一键安装社区插件",
  "dsh-sight": "为纯文本模型补上视觉能力——内置 vision 工具（含廉价/免费 VLM 预设）、多图批量分析、粘贴图片提示、带热重载的 Web 设置页",
  "dsh-better-sidebar": "类 VSCode 右侧边栏（资源管理器 / 编辑器 / 终端 / Git / 浏览器），按会话隔离；对外暴露服务供其他插件注册侧边栏标签页与文件查看器",
  "dsh-at-file": "类 Codex @路径 引用——在对话中搜索工作区文件路径，而不注入文件内容",
  "dsh-files": "双面插件——输入框文件上传按钮（会话隔离存储、定时清理、SHA-256 去重）+ read_document 工具（支持文本/PDF/DOCX/XLSX，自动编码检测与 LRU 缓存）",
  "dsh-chat-import": "导入 Claude Code / Codex / ChatGPT / Cursor / Gemini 等 13 种对话历史记录，转换为可续聊的 DSH 会话",
  "dsh-context": "上下文洞察与管理插件——提供上下文仪表盘和 context 命令，帮助理解对话上下文的构成与演变过程",
  "dsh-turn-rewind": "基于持久化变更账本（Change Ledger）的对话/工作区按轮回退",
  "dsh-deepseek-balance": "侧边栏底部显示 DeepSeek 账户余额，支持配置热重载与可编辑设置卡片（需先设置 DEEPSEEK_API_KEY 环境变量）",
  "dsh-paste-input": "WebUI 文件输入增强——Ctrl+V 粘贴（带首次使用告知弹窗）与拖拽/选择文件，发送时自动复制进会话工作区临时目录",
  "dsh-office": "Office 文档工具（xlsx / pdf / pptx / docx）——可生成、读取、编辑电子表格、PDF、演示文稿与 Word 文档",
  "dsh-genui": "GenUI——在助手回复中内联渲染交互式 UI（通过 dsh-ui 栅栏），支持布局、图表、表单、测验、Mermaid 流程图、3D 场景，带事件循环回传模型",
  "dsh-client-ui-task-board": "DSH Web GUI 任务看板——支持真实会话执行、Host 定时调度、可选跨平台闲置休眠保护，无需修改 DSH 源码即可挂载",
  "dsh-plugin-setting-mcp": "从设置页管理 MCP 服务器——支持添加、编辑、删除 MCP 配置",
};

// ── 类型 ─────────────────────────────────────────────────────

export interface PluginEntry {
  name: string;
  spec: string | null;
  category: string;
  installed: boolean;
  enabled: boolean;
  version: string | null;
  description: string | null;
  source: string;
  managed: boolean;
  loaderEntry?: { entryId: string | null; fiberPhase: string | null } | null;
}

export type AnomalyKind =
  | "missing-profile-manifest"
  | "dangling-dependency"
  | "loader-failed-entry"
  | "patch-write-failure"
  | "invalid-spec";

export interface Anomaly {
  kind: AnomalyKind;
  plugin?: string;
  message: string;
  hint?: string;
  action?: "cleanup" | "remove" | "retry" | "manual";
}

export interface ScanResult {
  plugins: PluginEntry[];
  templateBundles: string[];
  anomalies: Anomaly[];
}

export interface Capability {
  name: string;
  category: string;
  featureWords: string[];
  hasClient: boolean;
  hasBundle: boolean;
}

// ── 路径解析 ─────────────────────────────────────────────────

/** 默认 DSH home：$DSH_HOME 或 ~/.dsh。 */
export function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

/** profile 目录：<DSH_HOME>/profiles/<profile>。 */
export function profileDir(profile: string): string {
  return join(dshHome(), "profiles", profile);
}

/** 当前进程启动的 profile（--profile 参数），默认 web。 */
export function argvProfile(): string {
  const argv = process.argv;
  const flag = argv.indexOf("--profile");
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith("-")) return argv[flag + 1];
  return "web";
}

// ── 分类 ─────────────────────────────────────────────────────

/** 按插件名自动归类。 */
export function classify(name: string): string {
  const lower = String(name || "").toLowerCase();
  for (const keyword of OTHER_KEYWORDS) {
    if (lower.includes(keyword)) return "其他";
  }
  for (const [category, keywords] of CATEGORY_RULES) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  return "其他";
}

// ── 扫描 ─────────────────────────────────────────────────────

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** 定位包在 profile node_modules 中的 package.json（处理 scoped 包）。 */
function findPackageJson(profile: string, name: string): string | null {
  const nm = join(profileDir(profile), "node_modules");
  const candidate = name.startsWith("@")
    ? join(nm, ...name.split("/"), "package.json")
    : join(nm, name, "package.json");
  return existsSync(candidate) ? candidate : null;
}

/** 根据依赖 spec 推断来源。 */
function inferSource(spec: string): string {
  spec = String(spec || "");
  if (spec.startsWith("github:")) return "github";
  if (spec.startsWith("link:") || spec.startsWith("file:")) return "local";
  if (spec.includes(".git")) return "git";
  return "npm";
}

/** 按名称查找中文描述覆盖：支持带 scope 的包名自动去 scope 匹配。 */
function lookupDescription(name: string): string | null {
  if (DESCRIPTION_OVERRIDES[name]) return DESCRIPTION_OVERRIDES[name];
  const unscoped = name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name;
  return DESCRIPTION_OVERRIDES[unscoped] || null;
}

/**
 * 扫描 profile：返回非自带插件清单、模版 bundle 与结构化异常项。
 * 异常 kind 见 AnomalyKind；每个异常带 hint（可读提示）与可选 action。
 */
export function scanProfile(profile: string): ScanResult {
  const dir = profileDir(profile);
  const manifest = readJson(join(dir, "package.json"));
  if (!manifest || Object.keys(manifest).length === 0) {
    return {
      plugins: [],
      templateBundles: [],
      anomalies: [{
        kind: "missing-profile-manifest",
        message: "未找到 " + join(dir, "package.json") + "，请确认 profile 已初始化",
        hint: "执行一次 dsh plugin 操作或手动创建最小 package.json 后重试",
        action: "manual",
      }],
    };
  }

  const dependencies: Record<string, string> = manifest.dependencies || {};
  const bundles: string[] = [...(manifest.dsh?.profile?.bundles || [])];
  const templateBundles = bundles.filter((b) => TEMPLATE_BUNDLES.has(b));
  const plugins: PluginEntry[] = [];
  const anomalies: Anomaly[] = [];

  for (const [name, spec] of Object.entries(dependencies)) {
    if (BUILTIN_ROOT_PACKAGES.has(name)) continue;
    const specStr = String(spec);
    // 指向 deepseek-harness checkout 的 link 依赖（dsh-root 等自带）
    if (LINK_SPEC_MARKERS.some((marker) => specStr.includes(marker)) && CHECKOUT_MARKERS.some((marker) => specStr.includes(marker))) continue;

    if (specStr.trim() === "") {
      anomalies.push({
        kind: "invalid-spec",
        plugin: name,
        message: "插件「" + name + "」的依赖声明 spec 为空，无法解析",
        hint: "请检查 profile package.json 中该依赖的声明",
        action: "manual",
      });
    }

    const pkgJsonPath = findPackageJson(profile, name);
    const installed = pkgJsonPath !== null;
    let version: string | null = null;
    let description: string | null = null;
    if (pkgJsonPath !== null) {
      const meta = readJson(pkgJsonPath);
      version = meta.version ?? null;
      description = meta.description ?? null;
    }
    const cnDesc = lookupDescription(name);
    if (cnDesc !== null) description = cnDesc;

    const enabled = bundles.includes(name);
    plugins.push({
      name,
      spec: String(spec),
      category: classify(name),
      installed,
      enabled,
      version,
      description,
      source: inferSource(String(spec)),
      managed: true,
    });

    if (!installed) {
      anomalies.push({
        kind: "dangling-dependency",
        plugin: name,
        message: "插件「" + name + "」已在 dependencies 中声明（" + spec + "）但 node_modules 中未找到，疑似安装失败残留",
        hint: "可执行清理动作移除声明与 dsh.profile.bundles 残留",
        action: "cleanup",
      });
    } else if (!enabled && pluginSourceLocal(specStr) === false) {
      anomalies.push({
        kind: "patch-write-failure",
        plugin: name,
        message: "插件「" + name + "」已安装但未加入 dsh.profile.bundles，插件不会加载",
        hint: "执行一次安装/删除操作触发 reconcile 后会自动加入；或手动检查 profile package.json",
        action: "manual",
      });
    }
  }

  return { plugins, templateBundles, anomalies };
}

function pluginSourceLocal(spec: string): boolean {
  return spec.startsWith("link:") || spec.startsWith("file:");
}

// ── Loader 条目合并（原生「插件」模块 inventory 口径）────────────

/** 已知系统模版 bundle 的友好展示文案。 */
const TEMPLATE_BUNDLE_LABELS: Record<string, string> = {
  "@deepseek-ai/dsh-base": "DSH 基础框架（自带模版 bundle，不可管理）",
  "@deepseek-ai/dsh-web-app": "DSH Web 应用框架（自带模版 bundle，不可管理）",
};

export interface LoaderEntryLike {
  entryId?: unknown;
  moduleName?: unknown;
  enabled?: unknown;
  fiberPhase?: unknown;
}

/**
 * 合并 Cordis Loader 实际加载的插件条目，与原生「插件」模块的 inventory 口径一致：
 * - 管理范围内（profile dependencies 声明）的插件：附上 loaderEntry 信息；
 * - 范围外条目（模版 bundle / 聚合包的子插件）：以只读补充条目展示（managed: false）。
 */
export function mergeLoaderEntries(profile: string, scan: ScanResult, loaderEntries: LoaderEntryLike[] = []): PluginEntry[] {
  const plugins: PluginEntry[] = scan.plugins.map((p) => ({ ...p, managed: true }));
  const byName = new Map(plugins.map((p) => [p.name, p]));
  for (const entry of loaderEntries) {
    if (entry === null || typeof entry !== "object") continue;
    const name = entry.moduleName;
    if (typeof name !== "string" || name === "") continue;
    const loaderEntry = { entryId: entry.entryId == null ? null : String(entry.entryId), fiberPhase: entry.fiberPhase == null ? null : String(entry.fiberPhase) };
    const target = byName.get(name);
    if (target !== undefined) {
      target.loaderEntry = loaderEntry;
      continue;
    }
    const knownTemplate = Object.prototype.hasOwnProperty.call(TEMPLATE_BUNDLE_LABELS, name);
    const meta = readInstalledPackageMeta(profile, name);
    byName.set(name, {
      name,
      spec: null,
      category: "系统/附带",
      installed: true,
      enabled: entry.enabled === true,
      version: meta?.version ?? null,
      description: knownTemplate ? TEMPLATE_BUNDLE_LABELS[name] : (meta?.description ?? null),
      source: knownTemplate ? "template" : "bundle",
      managed: false,
      loaderEntry,
    });
  }
  return [...byName.values()];
}

/** 读取一个已安装包在 profile node_modules 中的 package.json 元数据。 */
function readInstalledPackageMeta(profile: string, name: string): any {
  const pkgJsonPath = findPackageJson(profile, name);
  if (pkgJsonPath === null) return null;
  return readJson(pkgJsonPath);
}

// ── 功能指纹与重复检测 ───────────────────────────────────────

/** 从字符串提取小写功能特征词（英文单词 + 数字；连字符词同时拆分出子词）。 */
function extractTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of String(text || "").toLowerCase().matchAll(/[a-z][a-z0-9-]{1,}/g)) {
    const token = match[0];
    if (token.length >= 2 && !["dsh", "deepseek", "harness", "plugin"].includes(token)) tokens.add(token);
    if (token.includes("-")) {
      for (const part of token.split("-")) {
        if (part.length >= 2 && !["dsh", "deepseek", "harness", "plugin"].includes(part)) tokens.add(part);
      }
    }
  }
  return tokens;
}

/**
 * 计算一个插件的功能指纹（capability）。对未安装候选以包名分词 + description。
 */
export function capabilityOf(profile: string, plugin: { name: string; category?: string; description?: string | null }): Capability {
  const meta = readInstalledPackageMeta(profile, plugin.name);
  const words = new Set<string>();
  for (const part of String(plugin.name || "").toLowerCase().split(/[/@-]/)) {
    if (part.length >= 2 && !["dsh", "deepseek", "ai", "dev", "omdsh", "linxin", "opendsh", "plugin"].includes(part)) words.add(part);
  }
  if (meta) {
    if (typeof meta.description === "string") {
      for (const token of extractTokens(meta.description)) words.add(token);
    }
    if (Array.isArray(meta.keywords)) {
      for (const keyword of meta.keywords) {
        for (const token of extractTokens(keyword)) words.add(token);
      }
    }
  } else if (typeof plugin.description === "string" && plugin.description !== "") {
    for (const token of extractTokens(plugin.description)) words.add(token);
  }
  const featureWords = [...words].filter((word) => FEATURE_WORDS.includes(word));
  return {
    name: plugin.name,
    category: plugin.category ?? classify(plugin.name),
    featureWords,
    hasClient: meta?.dsh?.client !== undefined,
    hasBundle: meta?.dsh?.bundle !== undefined,
  };
}

/** 弱特征词：跨类别通用词，功能包含判定中不要求被覆盖。 */
const WEAK_FEATURE_WORDS = new Set([
  "model", "web", "tool", "plugin", "server", "panel", "ui", "code", "agent", "search", "file", "browser",
]);

/**
 * 判断候选插件 candidate 的功能是否被已装插件 owner 完全包含。
 * 完全包含 = owner 覆盖 candidate 的全部强特征词，且形态（client/bundle）不弱于 candidate。
 */
export function isFullyCovered(profile: string, candidate: { name: string; category?: string; description?: string | null }, owner: { name: string }): boolean {
  const cand = capabilityOf(profile, candidate);
  const own = capabilityOf(profile, owner);
  const strongWords = cand.featureWords.filter((word) => !WEAK_FEATURE_WORDS.has(word));
  if (strongWords.length < 2) return false;
  for (const word of strongWords) {
    if (!own.featureWords.includes(word)) return false;
  }
  if (cand.hasClient && !own.hasClient) return false;
  if (cand.hasBundle && !own.hasBundle) return false;
  return true;
}

/**
 * 检测插件安装前的功能重复情况。
 * @returns { sameName, fullyCoveredBy, sameCategory }
 */
export function detectDuplicates(profile: string, candidate: { name: string; category?: string; description?: string | null }) {
  const scan = scanProfile(profile);
  const installedEnabled = scan.plugins.filter((p) => p.installed && p.enabled);
  const result: { sameName: PluginEntry | null; fullyCoveredBy: PluginEntry[]; sameCategory: PluginEntry[] } = {
    sameName: null,
    fullyCoveredBy: [],
    sameCategory: [],
  };
  const sameName = scan.plugins.find((p) => p.name === candidate.name);
  if (sameName !== undefined) result.sameName = sameName;
  for (const owner of installedEnabled) {
    if (owner.name === candidate.name) continue;
    if (isFullyCovered(profile, candidate, owner)) {
      result.fullyCoveredBy.push(owner);
    } else if (owner.category === candidate.category) {
      result.sameCategory.push(owner);
    }
  }
  return result;
}

/**
 * 扫描当前已安装插件之间的功能重复（两两比较，管理范围内 installed 插件）。
 * 返回 { scanned, groups }。
 */
export function scanDuplicates(profile: string) {
  const scan = scanProfile(profile);
  const installed = scan.plugins.filter((p) => p.installed);
  const caps = new Map(installed.map((p) => [p.name, capabilityOf(profile, p)]));
  const summarize = (p: PluginEntry) => ({
    name: p.name, version: p.version ?? null, category: p.category ?? null,
    enabled: p.enabled, description: p.description ?? null,
  });
  const groups: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < installed.length; i++) {
    for (let j = i + 1; j < installed.length; j++) {
      const a = installed[i];
      const b = installed[j];
      const pairKey = [a.name, b.name].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const capA = caps.get(a.name)!;
      const capB = caps.get(b.name)!;
      const strongA = capA.featureWords.filter((word) => !WEAK_FEATURE_WORDS.has(word));
      const strongB = capB.featureWords.filter((word) => !WEAK_FEATURE_WORDS.has(word));
      const shared = [...new Set(strongA.filter((word) => strongB.includes(word)))];
      if (isFullyCovered(profile, a, b)) {
        groups.push({ kind: "fully-covered", sharedWords: shared, covered: summarize(a), covering: summarize(b) });
      } else if (isFullyCovered(profile, b, a)) {
        groups.push({ kind: "fully-covered", sharedWords: shared, covered: summarize(b), covering: summarize(a) });
      } else if (shared.length >= 2 || (a.category === b.category && shared.length >= 1)) {
        groups.push({ kind: "overlap", sharedWords: shared, plugins: [summarize(a), summarize(b)] });
      }
    }
  }
  groups.sort((x, y) => y.sharedWords.length - x.sharedWords.length);
  return { scanned: installed.length, groups };
}
