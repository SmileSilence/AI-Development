/**
 * m12-probe：探测 0.6.0 一键折叠/展开按钮的 DOM 结构（位置、aria-label、图标 svg），
 * 供 m12 正式验证脚本设计断言。
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

  const probe = await page.evaluate(() => {
    const header = document.querySelector('.sectionHeader') ?? document.querySelector('[class*="sectionHeader"]')
    if (header === null) return { headerFound: false }
    const children = Array.from(header.children).map(el => ({
      cls: (el.className || '').toString().slice(0, 60),
      label: el.getAttribute('aria-label') ?? '',
      text: (el.innerText || '').trim().slice(0, 24),
    }))
    const toggle = header.querySelector('button[aria-label="折叠所有工作区"], button[aria-label="展开全部"]')
    const toggleInfo = toggle === null ? null : {
      aria: toggle.getAttribute('aria-label'),
      cls: (toggle.className || '').toString().slice(0, 80),
      svg: toggle.innerHTML.slice(0, 300),
      inHeaderActions: toggle.closest('[class*="headerActions"]') !== null,
    }
    const groups = Array.from(document.querySelectorAll('[role="treeitem"][aria-expanded]'))
      .map(el => ({ t: (el.innerText || '').trim().slice(0, 20), exp: el.getAttribute('aria-expanded') }))
      .slice(0, 8)
    return { headerFound: true, children, toggleInfo, groups }
  })
  console.log(JSON.stringify(probe, null, 2))
  await browser.close()
} catch (err) {
  console.error('PROBE ERROR: ' + (err && err.message ? err.message : err))
  await browser.close().catch(() => {})
  process.exit(2)
}
