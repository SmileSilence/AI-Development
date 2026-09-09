import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { classify, mergeLoaderEntries, scanProfile, scanDuplicates } from "./lib/plugin/scan.js";
import { disablePlugin, editManifestRemove, enablePlugin, pluginEnabledState } from "./lib/plugin/patch.js";
import { anomalyAction, generateReport } from "./lib/plugin/service.js";

let passed = 0;
function pass(name) { passed += 1; console.log("PASS  " + name); }

const dir = await mkdtemp(join(tmpdir(), "dpm-plugin-"));
const profileDir = join(dir, "profiles", "test");
await mkdir(join(profileDir, "node_modules", "dshmarket"), { recursive: true });
await writeFile(join(profileDir, "node_modules", "dshmarket", "package.json"), JSON.stringify({ name: "dshmarket", version: "1.40.0", description: "DSH 插件市场" }));
await writeFile(join(profileDir, "package.json"), JSON.stringify({
  name: "dsh-test-profile",
  dependencies: { dshmarket: "^1.0.0", "ghost-plugin": "^0.0.1" },
  dsh: { profile: { bundles: ["dshmarket"] } },
}));
await writeFile(join(profileDir, "cordis.patch.yml"), "[]\n");
process.env.DSH_HOME = dir;

try {
  // 1) classify 分类规则
  assert.equal(classify("dshmarket"), "插件管理");
  assert.equal(classify("dsh-better-sidebar"), "界面增强");
  assert.equal(classify("dsh-sight"), "AI 能力");
  assert.equal(classify("dsh-at-file"), "效率工具");
  assert.equal(classify("random-tool-x"), "其他");
  pass("classify 按名称自动归类（5 类 + 兜底其他）");

  // 2) scanProfile：已安装+已启用 / 悬挂声明
  const scan = scanProfile("test");
  assert.equal(scan.plugins.length, 2);
  const market = scan.plugins.find((p) => p.name === "dshmarket");
  assert.ok(market);
  assert.equal(market.installed, true);
  assert.equal(market.enabled, true);
  assert.equal(market.category, "插件管理");
  assert.equal(market.version, "1.40.0");
  const ghost = scan.plugins.find((p) => p.name === "ghost-plugin");
  assert.ok(ghost);
  assert.equal(ghost.installed, false);
  const dangling = scan.anomalies.find((a) => a.kind === "dangling-dependency");
  assert.ok(dangling);
  assert.equal(dangling.plugin, "ghost-plugin");
  assert.equal(dangling.action, "cleanup");
  pass("scanProfile 区分已安装/悬挂声明并产生结构化异常");

  // 3) mergeLoaderEntries：附带 loaderEntry + 追加只读系统条目
  const merged = mergeLoaderEntries("test", scan, [
    { moduleName: "dshmarket", entryId: "e-1", fiberPhase: "attached", enabled: true },
    { moduleName: "@deepseek-ai/dsh-web-app", entryId: "e-2", fiberPhase: "attached", enabled: true },
  ]);
  const mMarket = merged.find((p) => p.name === "dshmarket");
  assert.deepEqual(mMarket.loaderEntry, { entryId: "e-1", fiberPhase: "attached" });
  const webApp = merged.find((p) => p.name === "@deepseek-ai/dsh-web-app");
  assert.ok(webApp);
  assert.equal(webApp.managed, false);
  assert.equal(webApp.category, "系统/附带");
  assert.equal(webApp.enabled, true);
  pass("mergeLoaderEntries 附上 loader 条目并把范围外 bundle 显示为只读");

  // 4) disable / enable / pluginEnabledState 补丁往返
  const d1 = disablePlugin("test", "dshmarket");
  assert.equal(d1.ok, true);
  const patch1 = await readFile(join(profileDir, "cordis.patch.yml"), "utf8");
  assert.match(patch1, /- id: dshmarket/);
  assert.match(patch1, /disabled: true/);
  const st1 = pluginEnabledState("test", "dshmarket");
  assert.equal(st1.enabled, false);
  assert.equal(st1.disabledByPatch, true);
  const d2 = disablePlugin("test", "dshmarket");
  assert.equal(d2.already, true, "重复停用幂等");
  const e1 = enablePlugin("test", "dshmarket");
  assert.equal(e1.ok, true);
  const st2 = pluginEnabledState("test", "dshmarket");
  assert.equal(st2.enabled, true);
  assert.equal(st2.disabledByPatch, false);
  const patch2 = await readFile(join(profileDir, "cordis.patch.yml"), "utf8");
  assert.equal(patch2.includes("disabled: true"), false, "启用后补丁块被移除");
  pass("disablePlugin/enablePlugin 写读 user patch 层并保持幂等");

  // 5) anomalyAction cleanup 清理悬挂声明
  const cleaned = anomalyAction({ profile: "test", plugin: "ghost-plugin", kind: "cleanup" });
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.action, "cleaned");
  const rescan = scanProfile("test");
  assert.equal(rescan.plugins.some((p) => p.name === "ghost-plugin"), false);
  assert.equal(rescan.anomalies.some((a) => a.kind === "dangling-dependency"), false);
  const again = anomalyAction({ profile: "test", plugin: "ghost-plugin", kind: "cleanup" });
  assert.equal(again.action, "nothing-to-clean", "重复清理幂等");
  pass("anomalyAction cleanup 移除悬挂声明（幂等）");

  // 6) generateReport 生成 Markdown 清单
  const report = generateReport("test");
  assert.match(report, /插件清单/);
  assert.match(report, /dshmarket/);
  assert.match(report, /插件管理/);
  pass("generateReport 生成含类别分组的 Markdown 清单");

  // 7) scanDuplicates 返回结构化结果
  const dups = scanDuplicates("test");
  assert.equal(typeof dups.scanned, "number");
  assert.ok(Array.isArray(dups.groups));
  pass("scanDuplicates 返回 { scanned, groups } 结构");
} finally {
  delete process.env.DSH_HOME;
  await rm(dir, { recursive: true, force: true });
}

console.log("\n" + passed + " passed, 0 failed");
console.log("ALL PLUGIN TESTS PASSED");
