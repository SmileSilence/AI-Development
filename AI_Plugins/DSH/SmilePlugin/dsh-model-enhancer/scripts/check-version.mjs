import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`版本不是 SemVer: ${version}`)
for (const file of ['README.md', 'CHANGELOG.md']) {
  if (!readFileSync(join(root, file), 'utf8').includes(version)) throw new Error(`${file} 缺少版本 ${version}`)
}
console.log(`版本一致: ${version}`)
