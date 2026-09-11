// 一次性改名脚本：dsh-workspace-enhancer → smilexx-workspace-enhancer（UTF-8 安全）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const OLD = "dsh-workspace-enhancer";
const NEW = "smilexx-workspace-enhancer";

function read(rel) {
  return readFileSync(root + rel, "utf8").replace(/\r\n/g, "\n");
}
function write(rel, text) {
  writeFileSync(root + rel, text.replace(/\r\n/g, "\n"), "utf8");
}

// ── 1. 纯字符串改名 ────────────────────────────────────────────────────────
const plainFiles = [
  "package.json",
  "cordis.patch.yml",
  "src/index.ts",
  "src/client/index.ts",
  "src/client/locales.ts",
  "src/client/stores.ts",
  "src/client/browser/FilterButton.tsx",
  "tests/tag-filter.spec.ts",
  "scripts/build.mjs",
  "scripts/m11-probe.mjs",
  "README.md",
  "README.zh.md",
  "CHANGELOG.md",
];
for (const rel of plainFiles) {
  const s = read(rel);
  const n = (s.match(/dsh-workspace-enhancer/g) || []).length;
  if (n > 0) {
    write(rel, s.replace(/dsh-workspace-enhancer/g, NEW));
    console.log(`${rel}: ${n} renamed`);
  }
}

// ── 2. 版本 0.7.2 → 0.7.3（仅 package.json；CHANGELOG 历史条目与 README 保留）─
{
  const pj = read("package.json");
  const n = (pj.match(/0\.7\.2/g) || []).length;
  write("package.json", pj.replace(/0\.7\.2/g, "0.7.3"));
  console.log(`package.json: ${n} version bumps to 0.7.3`);
  // CHANGELOG/README 的旧版本字样属于历史记录，不改；check-version 动态读 pkg.version。
}

// ── 3. stores.ts：persist 键迁移（新键 + 一次性旧键导入）────────────────────
{
  let s = read("src/client/stores.ts");
  const oldDoc = ` * persist 键用插件自己的命名空间（dsh-workspace-enhancer:view.v1），不复用官方
 * \`dsh.workspace.view.v5\`——避免与官方/其他插件共享 LocalStorage（见 PLAN §5.1）。`;
  const newDoc = ` * persist 键用插件自己的命名空间（smilexx-workspace-enhancer:view.v1），不复用官方
 * \`dsh.workspace.view.v5\`——避免与官方/其他插件共享 LocalStorage（见 PLAN §5.1）。
 * 0.7.3 包改名：createWorkspaceViewStore 首次运行会把旧键
 * dsh-workspace-enhancer:view.v1 的已存视图状态迁移到新键并清理旧键。`;
  if (!s.includes(oldDoc)) throw new Error("stores.ts doc anchor not found");
  s = s.replace(oldDoc, newDoc);

  const oldPersist = `    persist: 'dsh-workspace-enhancer:view.v1',`;
  const newPersist = `    persist: 'smilexx-workspace-enhancer:view.v1',`;
  if (!s.includes(oldPersist)) throw new Error("stores.ts persist anchor not found");
  s = s.replace(oldPersist, newPersist);

  // 在 createWorkspaceViewStore 返回前插入迁移逻辑
  const fnAnchor = `export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  return defineStore({`;
  const fnNew = `export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  migrateLegacyPersist()
  return defineStore({`;
  if (!s.includes(fnAnchor)) throw new Error("stores.ts fn anchor not found");
  s = s.replace(fnAnchor, fnNew);

  // 文件尾部追加迁移函数（在最后一行 export 之后）
  const tail = `
/**
 * 一次性迁移：0.7.3 包改名后首次创建视图 store 时，把旧 persist 键
 * \`dsh-workspace-enhancer:view.v1\` 的已存状态搬移到新键并删除旧键。
 * 无旧数据或迁移失败（非 JSON）时静默返回——新 store 从 init 起步。
 */
const LEGACY_VIEW_STORAGE_KEY = 'dsh-workspace-enhancer:view.v1'

function migrateLegacyPersist(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const legacy = localStorage.getItem(LEGACY_VIEW_STORAGE_KEY)
    if (legacy === null) return
    if (localStorage.getItem('smilexx-workspace-enhancer:view.v1') === null) {
      localStorage.setItem('smilexx-workspace-enhancer:view.v1', legacy)
    }
    localStorage.removeItem(LEGACY_VIEW_STORAGE_KEY)
  } catch {
    // 隐私模式 / 配额：静默放弃迁移，不影响 store 功能
  }
}
`;
  s = s.replace(/\n$/, "") + tail;
  write("src/client/stores.ts", s);
  console.log("stores.ts: persist key migration added");
}

// ── 4. CHANGELOG 追加 0.7.3 条目 ───────────────────────────────────────────
{
  let s = read("CHANGELOG.md");
  const head = `# Changelog

## 0.7.3（2026-09-12）

- 插件包改名 \`dsh-workspace-enhancer\` → \`smilexx-workspace-enhancer\`：包名、
  cordis.patch.yml insert name、Host/Client 头注与 style dataset、persist 键前缀统一。
- **视图状态迁移**：persist 键改为 \`smilexx-workspace-enhancer:view.v1\`，首次创建
  视图 store 时自动把旧键 \`dsh-workspace-enhancer:view.v1\` 的已存状态搬移并清理
  （分组模式 / 置顶 / 折叠等不丢）。
- 重装后需强制刷新浏览器客户端包。

`;
  const firstLine = s.split("\n").findIndex((l) => l.startsWith("## "));
  if (firstLine < 0) throw new Error("CHANGELOG no version heading");
  const lines = s.split("\n");
  lines.splice(firstLine, 0, ...head.split("\n"));
  write("CHANGELOG.md", lines.join("\n").replace(/\n+$/, "\n"));
  console.log("CHANGELOG.md: 0.7.3 entry added");
}

// ── 5. 校验 ─────────────────────────────────────────────────────────────────
{
  for (const rel of plainFiles) {
    const s = read(rel);
    const leftover = (s.match(/dsh-workspace-enhancer/g) || []).length;
    if (leftover > 0) console.warn(`  leftover in ${rel}: ${leftover}（stores.ts 的迁移引用属预期）`);
  }
  const st = read("src/client/stores.ts");
  if (!st.includes("dsh-workspace-enhancer:view.v1")) console.warn("  stores.ts legacy key reference missing (expected for migration)");
  console.log("rename complete");
}
