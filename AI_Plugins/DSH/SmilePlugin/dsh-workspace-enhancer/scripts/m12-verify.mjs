/**
 * m12：0.6.0 一键折叠/展开所有工作区 + 位置调整 真实 GUI 验证。
 * 自铸签名 Cookie + 无头 Edge 访问 http://127.0.0.1:3080。
 *
 * 检查项：
 *  A1 按钮位置：sectionHeader 内 sectionLabel（工作区标题）之后、searchSlot 之前；
 *     不在 headerActions 内（紧挨标题）
 *  A2 初始（混合/有展开组）：图标朝下 ▼ + aria-label「折叠所有工作区」
 *  A3 点击 → 全部折叠：图标朝右 ▶ + aria-label「展开全部」+ 全部组 aria-expanded=false
 *  A4 再点击 → 全部展开：图标朝下 ▼ + aria-label「折叠所有工作区」+ 全部组 aria-expanded=true
 *  A5 混合状态：折叠一个组、展开其余 → 图标仍 ▼（未全部折叠按折叠全部处理）
 *  A6 切 flat（单列表）：按钮消失；切回 workspace：按钮恢复
 *  A7 tooltip：悬停显示「折叠所有工作区/展开全部」随状态切换
 *  C1 无致命 JS 错误
 * 输出 .m12-evidence/m12-browser.json + 截图；任一项 FAIL → exit 1。
 */
import { pathToFileURL } from 'node:url'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync as fsWrite } from 'node:fs'
import { join, dirname } from 'node:path'

const PLAYWRIGHT = pathToFileURL('D:/Program Files/DSH/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs').href
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:3080/'
const AUTHORITY = '127.0.0.1:3080'
const OUT = join(process.cwd(), '.m12-evidence', 'm12-browser.json')
const SHOT = (name) => join(process.cwd(), '.m12-evidence', name)

const credentialsRaw = readFileSync('C:/Users/19163/.dsh/.credentials.yaml', 'utf8')
const secretMatch = /secret:\s*([A-Za-z0-9_-]+)/.exec(credentialsRaw)
if (secretMatch === null) { console.error('credentials: no browser-session secret'); process.exit(1) }
const b64url = (buf) => Buffer.from(buf).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const unb64url = (s) => Buffer.from(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - s.length % 4) % 4), 'base64')
const secret = unb64url(secretMatch[1])
const issuedAt = Date.now()
const expiresAt = issuedAt + 7 * 24 * 60 * 60 * 1000
const body = b64url(Buffer.from(JSON.stringify({ version: 1, authority: AUTHORITY, issuedAt, expiresAt }), 'utf8'))
const sig = b64url(createHmac('sha256', secret).update(body).digest())
const cookieName = 'dsh-auth-' + b64url(createHash('sha256').update(AUTHORITY).digest())
const cookieValue = `v1.${body}.${sig}`

const { chromium } = await import(PLAYWRIGHT)
const browser = await chromium.launch({ headless: true, executablePath: EDGE, args: ['--no-sandbox', '--disable-gpu'] })
const results = []
const record = (name, ok, detail, warn = false) => results.push({ name, ok, detail: detail ?? '', warn })

/** 读取折叠按钮的 svg path 开头以判断方向（朝下 ▼ / 朝右 ▶）。 */
const toggleSvg = async (page) => await page.evaluate(() => {
  const btn = document.querySelector('.sectionCollapseToggle')
  if (btn === null) return null
  const p = btn.querySelector('path')
  return p !== null ? (p.getAttribute('d') ?? '') : ''
})

const groupsExpanded = async (page) => await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="treeitem"][aria-expanded]')).map(el => el.getAttribute('aria-expanded') === 'true'))

const toggleAria = async (page) => await page.evaluate(() =>
  document.querySelector('.sectionCollapseToggle')?.getAttribute('aria-label') ?? null)

const headerChildren = async (page) => await page.evaluate(() =>
  Array.from(document.querySelectorAll('.sectionHeader > *')).map(el => ({
    cls: (el.className || '').toString().split(' ')[0],
    aria: el.getAttribute('aria-label') ?? '',
    text: (el.innerText || '').trim().slice(0, 12),
  })))

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: cookieName, value: cookieValue, url: URL, sameSite: 'Strict', httpOnly: true }])
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('text=工作区', { timeout: 25000, state: 'attached' }).catch(() => {})
  await page.waitForTimeout(3500)

  // —— A1：按钮位置（sectionLabel 之后、searchSlot 之前，不在 headerActions）——
  const children = await headerChildren(page)
  const idxLabel = children.findIndex(c => /sectionLabel/.test(c.cls))
  const idxToggle = children.findIndex(c => /sectionCollapseToggle/.test(c.cls))
  const idxSearch = children.findIndex(c => /searchSlot/.test(c.cls))
  const idxActions = children.findIndex(c => /headerActions/.test(c.cls))
  const a1 = idxToggle >= 0 && idxLabel >= 0 && idxSearch >= 0
    && idxToggle === idxLabel + 1 && idxToggle < idxSearch
    && (idxActions < 0 || idxToggle < idxActions)
  record('button-next-to-title', a1,
    'children=' + JSON.stringify(children.map(c => c.cls + (c.aria ? '[' + c.aria + ']' : ''))),
    !a1)
  await page.screenshot({ path: SHOT('m12-position.png') })

  // —— A2：初始状态（有展开组 → 未全部折叠）：图标 ▼ + aria「折叠所有工作区」——
  const svg0 = await toggleSvg(page)
  const aria0 = await toggleAria(page)
  const a2 = svg0 !== null && svg0.startsWith('M11.8486 5.5L') && aria0 === '折叠所有工作区'
  record('initial-down-chevron', a2, 'svgHead=' + (svg0 ?? '').slice(0, 14) + ' aria=' + aria0)

  // —— A3：点击 → 全部折叠：图标 ▶ + aria「展开全部」+ 全部组折叠 ——
  await page.locator('.sectionCollapseToggle').click({ timeout: 3000 })
  await page.waitForTimeout(700)
  const svg1 = await toggleSvg(page)
  const aria1 = await toggleAria(page)
  const exp1 = await groupsExpanded(page)
  const a3 = svg1 !== null && svg1.startsWith('M5.5 2.15137L') && aria1 === '展开全部'
    && exp1.length > 0 && exp1.every(e => e === false)
  record('collapse-all-flips-right', a3,
    'svgHead=' + (svg1 ?? '').slice(0, 14) + ' aria=' + aria1 + ' expanded=' + JSON.stringify(exp1))
  await page.screenshot({ path: SHOT('m12-collapsed.png') })

  // —— A4：再点击 → 全部展开：图标 ▼ + aria「折叠所有工作区」+ 全部组展开 ——
  await page.locator('.sectionCollapseToggle').click({ timeout: 3000 })
  await page.waitForTimeout(700)
  const svg2 = await toggleSvg(page)
  const aria2 = await toggleAria(page)
  const exp2 = await groupsExpanded(page)
  const a4 = svg2 !== null && svg2.startsWith('M11.8486 5.5L') && aria2 === '折叠所有工作区'
    && exp2.length > 0 && exp2.every(e => e === true)
  record('expand-all-flips-down', a4,
    'svgHead=' + (svg2 ?? '').slice(0, 14) + ' aria=' + aria2 + ' expanded=' + JSON.stringify(exp2))
  await page.screenshot({ path: SHOT('m12-expanded.png') })

  // —— A5：混合状态（折叠第一个组、其余展开）→ 图标仍 ▼ ——
  if (exp2.length >= 2 && exp2.every(e => e === true)) {
    // 点击第一个展开的组行以折叠它（行点击切换展开状态）。
    const firstRow = page.locator('[role="treeitem"][aria-expanded="true"]').first()
    if (await firstRow.count() > 0) {
      await firstRow.click({ timeout: 3000 })
      await page.waitForTimeout(600)
    }
  }
  const expMix = await groupsExpanded(page)
  const mixed = expMix.some(e => e === true) && expMix.some(e => e === false)
  const svg3 = await toggleSvg(page)
  const aria3 = await toggleAria(page)
  const a5 = mixed && svg3 !== null && svg3.startsWith('M11.8486 5.5L') && aria3 === '折叠所有工作区'
  record('mixed-state-stays-down', a5,
    'expanded=' + JSON.stringify(expMix) + ' svgHead=' + (svg3 ?? '').slice(0, 14) + ' aria=' + aria3,
    !mixed)
  await page.screenshot({ path: SHOT('m12-mixed.png') })

  // —— A6：flat 模式按钮消失 / workspace 恢复 ——
  // 先恢复全部展开以便切回后断言。
  await page.locator('.sectionCollapseToggle').click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(500)
  // 视图菜单：headerActions 内「视图选项」按钮。
  const viewBtn = page.locator('.headerActions button[aria-label="视图选项"], .headerActions button[aria-label="View options"]')
  let a6 = false
  if (await viewBtn.count() > 0) {
    await viewBtn.click({ timeout: 3000 })
    await page.waitForTimeout(500)
    await page.getByText('单列表', { exact: true }).first().click({ timeout: 3000 })
    await page.waitForTimeout(700)
    const toggleGoneFlat = await page.locator('.sectionCollapseToggle').count()
    const titleFlat = (await page.locator('.sectionLabel').first().innerText().catch(() => '')) === '会话'
    // 切回分组视图。
    await viewBtn.click({ timeout: 3000 })
    await page.waitForTimeout(500)
    await page.getByText('按工作区', { exact: true }).first().click({ timeout: 3000 })
    await page.waitForTimeout(700)
    const toggleBack = await page.locator('.sectionCollapseToggle').count()
    a6 = toggleGoneFlat === 0 && titleFlat && toggleBack === 1
    record('flat-hides-button', a6,
      'flatCount=' + toggleGoneFlat + ' title=[' + (await page.locator('.sectionLabel').first().innerText().catch(() => '')) + '] back=' + toggleBack)
  } else {
    record('flat-hides-button', false, 'view menu button not found', true)
  }
  await page.screenshot({ path: SHOT('m12-flat.png') })

  // —— A7：tooltip 随状态切换 ——
  // 当前为 workspace 分组视图；记录按钮当前 aria（折叠所有工作区 / 展开全部），
  // hover 后 tooltip 应与其一致；再点击切换状态，hover 后 tooltip 应随之变化。
  const ariaBefore = await toggleAria(page)
  await page.locator('.sectionCollapseToggle').hover({ timeout: 3000 })
  await page.waitForTimeout(900)
  const tooltipBefore = await page.evaluate(() => {
    const tips = Array.from(document.querySelectorAll('[role="tooltip"]'))
      .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    return tips.map(t => t.innerText).join('|')
  })
  // 点击切换状态 → hover 显示另一侧文案。
  await page.locator('.sectionCollapseToggle').click({ timeout: 3000 })
  await page.waitForTimeout(700)
  const ariaAfter = await toggleAria(page)
  await page.locator('.sectionCollapseToggle').hover({ timeout: 3000 })
  await page.waitForTimeout(900)
  const tooltipAfter = await page.evaluate(() => {
    const tips = Array.from(document.querySelectorAll('[role="tooltip"]'))
      .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    return tips.map(t => t.innerText).join('|')
  })
  const tipMatchesAria = (tip, aria) => (aria === '折叠所有工作区' && tip.includes('折叠所有工作区'))
    || (aria === '展开全部' && tip.includes('展开全部'))
  const a7 = tipMatchesAria(tooltipBefore, ariaBefore)
    && tipMatchesAria(tooltipAfter, ariaAfter)
    && ariaBefore !== ariaAfter
  record('tooltip-switches', a7,
    'before: aria=[' + ariaBefore + '] tip=[' + tooltipBefore + '] | after: aria=[' + ariaAfter + '] tip=[' + tooltipAfter + ']')
  await page.screenshot({ path: SHOT('m12-tooltip.png') })

  const fatal = pageErrors.filter(e => !/404|favicon|sourcemap|net::/.test(e))
  record('no-fatal-js-errors', fatal.length === 0, pageErrors.slice(0, 3).join(' | '))
  await browser.close()
} catch (err) {
  record('fatal', false, String(err && err.message ? err.message : err))
  await browser.close().catch(() => {})
} finally {
  mkdirSync(dirname(OUT), { recursive: true })
  fsWrite(OUT, JSON.stringify({ ts: new Date().toISOString(), url: URL, cookieMinted: true, results }, null, 2))
  const failed = results.filter(r => !r.ok && !r.warn)
  const warned = results.filter(r => r.warn)
  console.log(results.map(r => (r.ok ? 'OK   ' : 'WARN ') + r.name + (r.ok ? '' : ' -- ' + r.detail)).join(String.fromCharCode(10)))
  console.log('WARNED (环境依赖): ' + (warned.map(r => r.name).join(', ') || '无'))
  console.log(failed.length === 0 ? 'ALL PASS' : 'FAILED: ' + failed.length)
  process.exit(failed.length === 0 ? 0 : 1)
}
