// 一次性改名脚本：dsh-input-enhancer → smilexx-input-enhancer（UTF-8 安全）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const OLD = "dsh-input-enhancer";
const NEW = "smilexx-input-enhancer";

function read(rel) {
  return readFileSync(root + rel, "utf8").replace(/\r\n/g, "\n");
}
function write(rel, text) {
  writeFileSync(root + rel, text.replace(/\r\n/g, "\n"), "utf8");
}

// ── 1. 纯字符串改名（所有文件里的 dsh-input-enhancer → smilexx-input-enhancer）──
const plainFiles = [
  "package.json",
  "cordis.patch.yml",
  "src/index.js",
  "src/client/plugin.js",
  "src/client/style.js",
  "src/client/direction/contribution.js",
  "src/client/menu/menuSeat.js",
  "src/client/menu/owners.js",
  "src/client/plan/preference.js",
  "src/host/directionAdjust.js",
  "src/tests/owners.test.js",
  "build.mjs",
  "scripts/check.mjs",
  "scripts/e2e.mjs",
  "README.md",
  "SKILL.md",
  "PROJECT_SPEC.md",
  "DESIGN_EXECUTION.md",
  "docs/API.md",
  "docs/CHANGELOG.md",
  "docs/TROUBLESHOOTING.md",
];
for (const rel of plainFiles) {
  const s = read(rel);
  const n = (s.match(/dsh-input-enhancer/g) || []).length;
  if (n > 0) {
    write(rel, s.replace(/dsh-input-enhancer/g, NEW));
    console.log(`${rel}: ${n} renamed`);
  }
}

// ── 2. 版本号 2.3.1 → 2.3.2（package.json + check.mjs）──────────────────────
{
  const pj = read("package.json");
  const n = (pj.match(/2\.3\.1/g) || []).length;
  write("package.json", pj.replace(/2\.3\.1/g, "2.3.2"));
  console.log(`package.json: ${n} version bumps to 2.3.2`);

  const ck = read("scripts/check.mjs");
  const n2 = (ck.match(/2\.3\.1/g) || []).length;
  write("scripts/check.mjs", ck.replace(/2\.3\.1/g, "2.3.2"));
  console.log(`scripts/check.mjs: ${n2} version bumps to 2.3.2`);
}

// ── 3. LocalStorage 键兼容：preference.js（defaultPlanMode）────────────────
// 新键为 smilexx-input-enhancer:defaultPlanMode，读取时回退旧键 dsh-input-enhancer:...
// （旧版用户偏好不丢），写入时写新键并清理旧键。
{
  let s = read("src/client/plan/preference.js");
  const oldBlock = ` * 键名保持 dsh-input-enhancer:defaultPlanMode（与旧版一致），值为 'true'/'false'。`;
  const newBlock = ` * 键名改为 smilexx-input-enhancer:defaultPlanMode（包改名）。读取时回退旧键
 * dsh-input-enhancer:defaultPlanMode（v2.3.1 及更早的偏好不丢），写入时写新键并清理旧键。`;
  if (!s.includes(oldBlock)) throw new Error("preference.js comment anchor not found");
  s = s.replace(oldBlock, newBlock);

  s = s.replace(
    `/** 偏好存储键名（历史兼容，勿改）。 */
export const PREFERENCE_KEY = 'smilexx-input-enhancer:defaultPlanMode'`,
    `/** 偏好存储键名（包改名后使用新前缀；读取时回退旧键）。 */
export const PREFERENCE_KEY = 'smilexx-input-enhancer:defaultPlanMode'
/** 旧键名（v2.3.1 及更早版本），仅用于读取回退迁移。 */
const LEGACY_PREFERENCE_KEY = 'dsh-input-enhancer:defaultPlanMode'`
  );

  s = s.replace(
    `export function readPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}`,
    `export function readPreference() {
  try {
    const ls = window.localStorage
    const v = ls.getItem(PREFERENCE_KEY) ?? ls.getItem(LEGACY_PREFERENCE_KEY)
    return v === 'true'
  } catch {
    return false
  }
}`
  );

  s = s.replace(
    `    window.localStorage.setItem(PREFERENCE_KEY, value ? 'true' : 'false')`,
    `    const ls = window.localStorage
    ls.setItem(PREFERENCE_KEY, value ? 'true' : 'false')
    ls.removeItem(LEGACY_PREFERENCE_KEY)`
  );

  write("src/client/plan/preference.js", s);
  console.log("preference.js: key migration added");
}

// ── 4. LocalStorage 键兼容：owners.js（commandOwners）───────────────────────
{
  let s = read("src/client/menu/owners.js");
  s = s.replace(
    `/** L3 用户配置的 localStorage 键。 */
export const OWNERS_STORAGE_KEY = 'smilexx-input-enhancer:commandOwners'`,
    `/** L3 用户配置的 localStorage 键（包改名后新前缀）。 */
export const OWNERS_STORAGE_KEY = 'smilexx-input-enhancer:commandOwners'
/** 旧键名（v2.3.1 及更早），仅用于读取回退迁移。 */
const LEGACY_OWNERS_STORAGE_KEY = 'dsh-input-enhancer:commandOwners'`
  );

  s = s.replace(
    `    const raw = storage?.getItem(OWNERS_STORAGE_KEY)`,
    `    const raw = storage?.getItem(OWNERS_STORAGE_KEY) ?? storage?.getItem(LEGACY_OWNERS_STORAGE_KEY)`
  );

  // 注释里的键引用同步
  s = s.replace(/`dsh-input-enhancer:commandOwners`/, "`smilexx-input-enhancer:commandOwners`（读取回退旧键）");
  write("src/client/menu/owners.js", s);
  console.log("owners.js: key migration added");
}

// ── 5. CHANGELOG 追加 2.3.2 条目 ────────────────────────────────────────────
{
  let s = read("docs/CHANGELOG.md");
  const head = `# 变更日志

## 2.3.2（2026-09-12）

### 变更
- 插件包改名 \`dsh-input-enhancer\` → \`smilexx-input-enhancer\`：包名、cordis.patch.yml
  insert id/name、宿主/客户端 name 与 effect label、Typert package/typeSymbol、
  LocalStorage 键前缀（\`smilexx-input-enhancer:\`）统一；\`dsh-panel\`/菜单座不受影响。
- **LocalStorage 键兼容**：\`defaultPlanMode\` 与 \`commandOwners\` 读取时回退旧键
  \`dsh-input-enhancer:*\`（2.3.1 及更早的偏好/命令归属不丢），写入使用新键并清理旧键。
- 重装后需强制刷新浏览器客户端包。

## 2.3.1（2026-09-08）`;
  if (!s.includes("## 2.3.1（2026-09-08）")) throw new Error("CHANGELOG anchor not found");
  s = s.replace("## 2.3.1（2026-09-08）", head.replace("## 2.3.1（2026-09-08）", "") + "\n## 2.3.1（2026-09-08）");
  write("docs/CHANGELOG.md", s);
  console.log("docs/CHANGELOG.md: 2.3.2 entry added");
}

// ── 6. 校验 ─────────────────────────────────────────────────────────────────
{
  for (const rel of plainFiles) {
    const s = read(rel);
    const leftover = (s.match(/dsh-input-enhancer/g) || []).length;
    if (leftover > 0) console.warn(`  leftover in ${rel}: ${leftover}`);
  }
  const ck = read("scripts/check.mjs");
  if (!ck.includes("=== 'smilexx-input-enhancer'")) console.warn("  check.mjs may still assert old name");
  console.log("rename complete");
}
