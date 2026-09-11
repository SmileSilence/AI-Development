import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const reactExternal = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']
const clientBanner = `/* smilexx-notification-manager client bundle */
window.__ModuleLoader__.load({
  id: "smilexx-notification-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
`
const clientFooter = `
module.exports = __notificationManagerExports;
    return module.exports;
  }
});
`

mkdirSync(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src/index.ts')], outfile: join(root, 'lib/index.js'),
  bundle: true, format: 'esm', platform: 'node', target: 'node20', packages: 'external', logLevel: 'info',
})
await build({
  entryPoints: [join(root, 'src/settings.ts')], outfile: join(root, 'lib/settings.js'),
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2020', logLevel: 'info',
})
await build({
  entryPoints: [join(root, 'src/client/index.ts')], outfile: join(root, 'lib/client.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2020',
  banner: { js: clientBanner }, footer: { js: clientFooter }, globalName: '__notificationManagerExports',
  external: [
    ...reactExternal,
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-settings',
  ],
  logLevel: 'info',
})

for (const file of ['index.js', 'client.js', 'settings.js']) {
  const output = join(root, 'lib', file)
  if (readFileSync(output, 'utf8').length === 0) throw new Error(`构建产物为空: ${output}`)
}
console.log('构建完成。')
