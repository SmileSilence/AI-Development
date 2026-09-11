/**
 * m11-probe：探测当前 GUI 是否已加载 smilexx-workspace-enhancer 0.5.0 的新 client bundle。
 * 通过自铸 Cookie + 无头 Edge 打开筛选面板，统计操作符下拉的选项数。
 * 3 项=旧 bundle（HMR 未生效）；7 项=新 bundle（HMR 已生效）。
 */
import { pathToFileURL } from 'node:url'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const PLAYWRIGHT = pathToFileURL('D:/Program Files/DSH/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs').href
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:3080/'
const AUTHORITY = '127.0.0.1:3080'

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
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: cookieName, value: cookieValue, url: URL, sameSite: 'Strict', httpOnly: true }])
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('text=工作区', { timeout: 25000, state: 'attached' }).catch(() => {})
  await page.waitForTimeout(3500)

  const filterBtn = page.locator('.headerActions button[aria-haspopup="dialog"][aria-label="筛选"], .headerActions button[aria-haspopup="dialog"][aria-label="Filter"]')
  const count = await filterBtn.count()
  if (count === 0) {
    console.log('PROBE: 未找到筛选按钮（GUI 可能未就绪或宽侧栏未展开）')
    await browser.close()
    process.exit(2)
  }
  await filterBtn.first().click({ timeout: 4000 })
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '添加条件' }).first().click({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(400)
  const row = page.locator('.filterRuleRow').first()
  const condBtn = row.locator('button[aria-haspopup="listbox"]').nth(1)
  await condBtn.click({ timeout: 3000 })
  await page.waitForTimeout(500)
  const menuText = (await page.evaluate(() => Array.from(document.querySelectorAll('[role="menu"]'))
    .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map(m => m.innerText).join('|')))
  const has7 = /不等于/.test(menuText) && /包含全部/.test(menuText) && /为空/.test(menuText) && /不为空/.test(menuText)
  console.log('PROBE: 操作符菜单=' + JSON.stringify(menuText.replaceAll('\n', '|')))
  console.log(has7 ? 'RESULT: NEW BUNDLE (7 operators) — HMR 已生效' : 'RESULT: OLD BUNDLE (3 operators) — HMR 未生效')
  await browser.close()
  process.exit(has7 ? 0 : 1)
} catch (err) {
  console.error('PROBE ERROR: ' + (err && err.message ? err.message : err))
  await browser.close().catch(() => {})
  process.exit(2)
}
