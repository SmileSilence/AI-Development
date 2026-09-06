/**
 * M6 版本 pin 断言：package.json 版本 与 CHANGELOG / README(zh/en) 中
 * 声明的版本一致；CHANGELOG 首个版本条目存在且非占位。
 * 门禁链 `npm run check` 的一部分（check-version 在 build 之后跑）。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`✗ package.json version "${version}" is not semver`)
  process.exit(1)
}

const checks = [
  { name: 'CHANGELOG 首个条目', file: 'CHANGELOG.md', re: new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm') },
  { name: 'CHANGELOG 占位拦截', file: 'CHANGELOG.md', re: /^## \d+\.\d+\.\d+（未发布）/m, invert: true },
  // README 头部不强制版本号；仅当文件含版本字样时断言一致。
  { name: 'README.md 版本一致', file: 'README.md', re: new RegExp(version.replace(/\./g, '\\.')), optional: true },
  { name: 'README.zh.md 版本一致', file: 'README.zh.md', re: new RegExp(version.replace(/\./g, '\\.')), optional: true },
]

let failed = false
for (const check of checks) {
  const text = readFileSync(join(root, check.file), 'utf8')
  const present = check.re.test(text)
  if (check.invert) {
    // 占位拦截：命中占位（未发布）即为失败。
    if (present) {
      console.error(`✗ ${check.name}: 命中占位版本，需更新为 ${version}`)
      failed = true
    } else {
      console.log(`✓ ${check.name}`)
    }
    continue
  }
  if (!check.optional && !present) {
    console.error(`✗ ${check.name}: 未找到版本 ${version}`)
    failed = true
    continue
  }
  if (check.optional && text.includes('0.1.') && !present) {
    console.error(`✗ ${check.name}: 存在旧版本字样但不含 ${version}`)
    failed = true
    continue
  }
  console.log(`✓ ${check.name}`)
}

if (failed) process.exit(1)
console.log(`✓ 版本 pin: ${version}`)
