import assert from "node:assert/strict";
import { compareVersions, fetchUpdateCheck, REPO_SLUG } from "./lib/version.js";

let passed = 0;
function pass(name) {
  passed += 1;
  console.log("PASS  " + name);
}

// 本地分发（file: tgz）：REPO_SLUG 为空，fetchUpdateCheck 短路返回「无更新」，
// 不发起任何网络请求（fetch 不应被调用）。
assert.equal(REPO_SLUG, "");
let fetchCalled = false;
const original = globalThis.fetch;
globalThis.fetch = async () => {
  fetchCalled = true;
  throw new Error("fetch should not be called for local distribution");
};
let info;
try {
  info = await fetchUpdateCheck();
} finally {
  globalThis.fetch = original;
}
assert.equal(fetchCalled, false, "fetch must not be called for local distribution");
assert.equal(info.latest, null);
assert.equal(info.updateAvailable, false);
assert.equal(info.rateLimited, false);
assert.match(info.error ?? "", /本地安装包/);
pass("local distribution short-circuits update check without network");

// compareVersions
assert.ok(compareVersions("2.0.0", "1.9.9") > 0);
assert.ok(compareVersions("v2", "2") === 0);
assert.ok(compareVersions("2.0", "2.0.0") === 0);
assert.ok(compareVersions("2.0.0-rc.1", "2.0.0") > 0); // known limitation: no prerelease semantics
pass("compareVersions keeps legacy numeric-segment semantics");

console.log("\n" + passed + " passed, 0 failed");
console.log("ALL VERSION TESTS PASSED");
