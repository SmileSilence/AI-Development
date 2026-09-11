// smilexx-input-enhancer 单一构建脚本（唯一产物生成方式）
// - lib/index.js   : 宿主端入口（esm，Node）
// - lib/client.js  : 浏览器端入口（cjs 工厂，经 window.__ModuleLoader__.load 注册）
// React、ReactDOM 与原生 UI 组件由 DSH 模块加载器提供，构建时全部外置。
import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const lib = join(root, 'lib')

/** 与 dsh-client-web PLATFORM_MODULES 对齐的浏览器端外置清单。 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  // v2.1.0：命令归属拦截按需 require 的宿主模块（动态 import，缺失可容忍）
  '@deepseek-ai/dsh-client-ui-commands',
  '@deepseek-ai/dsh-client-ui-commands/client',
]

const HOST_EXTERNALS = [
  '@deepseek-ai/dsh-typert-protocol',
]

await mkdir(lib, { recursive: true })

// 1. 宿主端：空挂载入口
await build({
  entryPoints: [join(root, 'src/index.js')],
  outfile: join(lib, 'index.js'),
  bundle: true,
  external: HOST_EXTERNALS,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  jsx: 'automatic',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})

// 2. 浏览器端：插件主体（暂存 CJS，随后包裹进加载器注册）
await build({
  entryPoints: [join(root, 'src/client/plugin.js')],
  outfile: join(lib, '.client-inner.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: CLIENT_EXTERNALS,
  minify: false,
  sourcemap: false,
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

// 3. 包裹为 __ModuleLoader__.load 注册（契约 C6）
const inner = await readFile(join(lib, '.client-inner.cjs'), 'utf8')
const indent = text => text.split('\n').map(line => '    ' + line).join('\n')
const wrapped = [
  'window.__ModuleLoader__.load({',
  "  id: 'smilexx-input-enhancer',",
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  indent(inner),
  '    return module.exports;',
  '  }',
  '});',
  '',
].join('\n')
await writeFile(join(lib, 'client.js'), wrapped)
await rm(join(lib, '.client-inner.cjs'))

console.log('build: lib/index.js + lib/client.js 已生成')
