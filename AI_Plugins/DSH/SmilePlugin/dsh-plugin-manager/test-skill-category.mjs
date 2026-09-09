import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRoots, collectSkillEntries, parseFrontmatter } from "./lib/skill-files.js";

let passed = 0;
function pass(name) { passed += 1; console.log("PASS  " + name); }

// 1) parseFrontmatter 提取 skill-creator 元数据
const skillMd = [
  "---",
  "name: my-nice-tool",
  "description: 一个测试技能",
  "metadata:",
  "  category: 效率工具",
  "  publisher: smile-team",
  "  platforms: [web, desktop]",
  "  keywords: [tool, helper]",
  "---",
  "# My Nice Tool",
  "正文内容",
].join("\n");
const parsed = parseFrontmatter(skillMd);
assert.equal(parsed.name, "my-nice-tool");
assert.equal(parsed.category, "效率工具");
assert.equal(parsed.publisher, "smile-team");
assert.deepEqual(parsed.platforms, ["web", "desktop"]);
assert.deepEqual(parsed.keywords, ["tool", "helper"]);
pass("parseFrontmatter 提取 metadata.category/publisher/platforms/keywords");

// 2) 无 metadata 时字段为空（宽松回退）
const plain = parseFrontmatter("---\nname: plain-skill\ndescription: 无元数据\n---\n正文");
assert.equal(plain.category, undefined);
assert.equal(plain.publisher, undefined);
pass("parseFrontmatter 无 metadata 时 category/publisher 为空");

// 3) metadata 非对象时宽松解析不抛错
const bad = parseFrontmatter("---\nname: bad-skill\ndescription: x\nmetadata: 123\n---\n正文");
assert.equal(bad.category, undefined);
pass("metadata 类型异常时宽松回退为 undefined");

// 4) 目录扫描传播 category 到条目
const dir = await mkdtemp(join(tmpdir(), "dpm-skillcat-"));
try {
  await mkdir(join(dir, "skills", "bundle-tool"), { recursive: true });
  await writeFile(join(dir, "skills", "bundle-tool", "SKILL.md"), skillMd);
  await mkdir(join(dir, "skills", "nested", "inner-skill"), { recursive: true });
  await writeFile(join(dir, "skills", "nested", "inner-skill", "SKILL.md"), "---\nname: inner-skill\ndescription: 嵌套无元数据\n---\n正文");
  const roots = await buildRoots(undefined, { dshHome: dir });
  const entries = await collectSkillEntries(roots);
  const bundle = entries.find((e) => e.name === "my-nice-tool");
  assert.ok(bundle, "bundle entry found");
  assert.equal(bundle.category, "效率工具");
  assert.equal(bundle.publisher, "smile-team");
  assert.equal(bundle.rel, "bundle-tool");
  const inner = entries.find((e) => e.name === "inner-skill");
  assert.ok(inner, "nested entry found");
  assert.equal(inner.rel, "nested/inner-skill");
  assert.equal(inner.category, undefined, "无 metadata 的嵌套技能 category 为空（index.ts 回退 rel 顶层段）");
  pass("collectSkillEntries 将 category/publisher 传播到条目（含嵌套 rel）");
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("\n" + passed + " passed, 0 failed");
console.log("ALL SKILL CATEGORY TESTS PASSED");
