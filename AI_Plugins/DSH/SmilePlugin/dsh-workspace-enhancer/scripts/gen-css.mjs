/**
 * gen-css.mjs — 把 fork 的 CSS Module 转为可打包的 TS 模块。
 *
 * 加载器不支持 CSS import；产出两个模块：
 *   src/client/styles/css.ts      —— 类名 → 类名本身（`export const css` 结构）。
 *   src/client/styles/raw.ts      —— 三份原始 CSS 字符串（入口注入 <style>）。
 *
 * 类名不 hash（与上游一致），因此 raw CSS 可原样注入，css.ts 仅做键映射。
 * 生成物不提交评审（由本脚本维护）；修改 module.css 后重跑 `npm run gen-css`。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** 需要转换的 CSS module（相对 src/client）。 */
const CSS_FILES = [
  'browser/WorkspaceBrowser.module.css',
  'browser/Rows.module.css',
  'WorkspacePicker.module.css',
  // 标签子系统（集成自 dsh-workspace-tagger）。
  'tags/ui/TagDialog.module.css',
  'tags/settings/TagsSettingsTab.module.css',
]

/** 提取类名：匹配选择器起始的 `.class`（后随 `,` `{` `.` `#` 空白或末尾）。 */
const CLASS_RE = /\.([A-Za-z_][A-Za-z0-9_-]*)(?=[\s,{.#])/g

function extractClasses(css) {
  const set = new Set()
  for (const match of css.matchAll(CLASS_RE)) set.add(match[1])
  return [...set]
}

function toTsString(value) {
  return JSON.stringify(value)
}

const cssEntries = CSS_FILES.map((rel) => {
  const abs = join(root, 'src/client', rel)
  const raw = readFileSync(abs, 'utf8')
  const classes = extractClasses(raw)
  return { rel, classes, raw }
})

// 1) css.ts —— 每个文件导出其类名对象，并聚合导出。
const outDir = join(root, 'src/client/styles')
mkdirSync(outDir, { recursive: true })

const cssLines = [
  '/* 由 scripts/gen-css.mjs 生成 — 勿手改。类名与上游 CSS Module 一致。 */',
]
for (const entry of cssEntries) {
  const varName = entry.rel
    .split('/')
    .pop()
    .replace(/\.module\.css$/, '')
    .replace(/\W/g, '_') + 'Css'
  cssLines.push(`export const ${varName} = {`)
  for (const cls of entry.classes) {
    cssLines.push(`  ${JSON.stringify(cls)}: ${toTsString(cls)},`)
  }
  cssLines.push(`} as const`)
  cssLines.push('')
}
writeFileSync(join(outDir, 'css.ts'), cssLines.join('\n'))

// 2) raw.ts —— 原始 CSS 字符串（每个文件一个具名导出）。
const rawLines = [
  '/* 由 scripts/gen-css.mjs 生成 — 勿手改。运行时注入 <style>。 */',
]
for (const entry of cssEntries) {
  const varName = entry.rel
    .split('/')
    .pop()
    .replace(/\.module\.css$/, '')
    .replace(/\W/g, '_')
  rawLines.push(`export const ${varName}Raw = ${toTsString(entry.raw)}`)
  rawLines.push('')
}
writeFileSync(join(outDir, 'raw.ts'), rawLines.join('\n'))

console.log(`gen-css: ${CSS_FILES.length} 个文件 → css.ts + raw.ts`)
for (const entry of cssEntries) {
  console.log(`  ${entry.rel}: ${entry.classes.length} 类名`)
}
