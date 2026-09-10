// dsh-plugin-manager 版本门禁链（smilexx-dsh-plugin-creator 要求）
// 用法：node scripts/check.mjs [--expect <版本>]
// 断言：package.json 版本 pin、结构检查（Host 入口/客户端产物/补丁文件）、CHANGELOG/README 版本同步。
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const expect = process.argv.find((a) => a.startsWith('--expect='))?.slice(9)
const version = pkg.version
const failures = []

const check = (ok, msg) => { if (!ok) failures.push(msg); else console.log('  ✓ ' + msg) }

console.log('版本门禁链检查：' + pkg.name + ' v' + version)
check(typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version), 'package.json 版本为语义化版本 (' + version + ')')
if (expect) check(version === expect, '版本 pin：期望 ' + expect + '，实际 ' + version)

// 结构检查
check(pkg.main === 'lib/index.js' && existsSync(join(root, pkg.main)), 'Host 入口 lib/index.js 存在')
check(pkg.exports?.['.'] === './lib/index.js', 'exports["."] 指向 lib/index.js')
check(pkg.exports?.['./client'] === './lib/client.js' && existsSync(join(root, 'lib/client.js')), '客户端产物 lib/client.js 存在')
check(pkg.dsh?.bundle?.patch && existsSync(join(root, pkg.dsh.bundle.patch)), 'bundle patch 文件存在 (' + pkg.dsh.bundle.patch + ')')
check(pkg.dsh?.client?.platform === 'web' && Array.isArray(pkg.dsh.client.inject), 'dsh.client(web) 声明有效')

// 文档版本同步
for (const f of ['CHANGELOG.md', 'README.md']) {
  const p = join(root, f)
  if (!existsSync(p)) { check(false, f + ' 缺失'); continue }
  const text = readFileSync(p, 'utf8')
  check(text.includes(version), f + ' 提及版本 ' + version)
}

if (failures.length > 0) {
  console.error('\n门禁失败：\n' + failures.map((f) => '  ✗ ' + f).join('\n'))
  process.exit(1)
}
console.log('\n门禁通过。')
