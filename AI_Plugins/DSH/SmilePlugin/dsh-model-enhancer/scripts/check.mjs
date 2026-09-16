#!/usr/bin/env node
/**
 * smilexx-model-enhancer 静态验收脚本：
 * 校验构建产物、入口、补丁、许可与客户端外置依赖是否符合发布契约。
 * 失败时以非零退出码结束。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const problems = []
const ok = (cond, message) => { if (!cond) problems.push(message) }

// 1. 产物存在
for (const file of ['lib/index.js', 'lib/client.js']) {
  ok(existsSync(join(root, file)), `缺少构建产物 ${file}（先运行 npm run build）`)
}
// 2. 宿主入口：默认导出 name/description/apply
if (existsSync(join(root, 'lib/index.js'))) {
  const host = await import(pathToFileURL(join(root, 'lib/index.js')).href + '?v=' + Date.now())
  const def = host.default
  ok(def && typeof def === 'object', 'lib/index.js 未导出默认对象')
  ok(def && def.name === 'smilexx-model-enhancer', '宿主默认导出 name 应为 smilexx-model-enhancer')
  ok(def && typeof def.apply === 'function', '宿主 apply 应为函数')
  ok(host.name === 'smilexx-model-enhancer', 'lib/index.js 应具名导出 name')
}
// 3. 客户端入口：__ModuleLoader__ 注册 + id + 外置依赖白名单
if (existsSync(join(root, 'lib/client.js'))) {
  const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
  ok(client.includes('window.__ModuleLoader__.load('), 'lib/client.js 应通过 __ModuleLoader__.load 注册')
  ok(client.includes("'smilexx-model-enhancer'"), 'lib/client.js 应声明 id smilexx-model-enhancer')
  const allowed = new Set([
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-api-remotes',
    '@deepseek-ai/dsh-api-remotes/client',
  ])
  const requires = [...client.matchAll(/\brequire\(['"]([^'"]+)['"]\)/g)].map(m => m[1])
  for (const spec of requires) {
    ok(allowed.has(spec), `客户端 bundle 引入未声明的外置模块：${spec}`)
  }
}
// 4. 包元数据路由
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
ok(pkg.main === './lib/index.js', 'main 应指向 lib/index.js')
ok(pkg.exports['.']?.default === './lib/index.js', '根 exports 应指向 lib/index.js')
ok(pkg.exports['./client']?.default === './lib/client.js', './client 应指向 lib/client.js')
ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch 应指向 cordis.patch.yml')
ok(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform 应为 web')
// 5. 补丁与许可
ok(existsSync(join(root, 'cordis.patch.yml')), '缺少 cordis.patch.yml')
ok(existsSync(join(root, 'LICENSE')), '缺少 LICENSE')
ok(existsSync(join(root, 'README.md')), '缺少 README.md')
ok(existsSync(join(root, 'CHANGELOG.md')), '缺少 CHANGELOG.md')

if (problems.length > 0) {
  console.error('check 失败：')
  for (const problem of problems) console.error(` - ${problem}`)
  process.exit(1)
}
console.log('check 通过：产物、入口、外置依赖与包元数据均符合契约')
