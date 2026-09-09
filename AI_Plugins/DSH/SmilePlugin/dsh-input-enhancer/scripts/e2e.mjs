/**
 * dsh-input-enhancer 端到端验收驱动（真实浏览器 / CDP）：node scripts/e2e.mjs --url <URL>
 * 依赖本机安装的 headless Edge/Chrome（--remote-debugging-port）与 Node 24+ 原生 WebSocket。
 * 通过项：
 *  - E1 只有一个 Plan 按钮（dsh-input-enhancer 座）
 *  - E2 “+”按钮弹出分类菜单（模式/模型/权限/会话/其他），原生候选被完全遮蔽
 *  - E3 点击 Plan 切换 /plan 三态（开启/关闭）
 *  - E4 右键菜单「默认 Plan」写入 localStorage
 *  - E4b 方框勾选状态即时同步（data-checked: false → true，v2.2.0）
 *  - E5 无控制台错误
 *  - E6 “+”菜单每次打开置顶：滚动→关闭→重开后 scrollTop===0 且首分类为“模式”（v2.1.0）
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean))
const tokenUrl = args.url
if (!tokenUrl) { console.error('usage: node scripts/e2e.mjs --url http://127.0.0.1:4310/?token=...'); process.exit(2) }
const outDir = args.out || '.'
const cdpPort = args.cdpPort || '9333'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?` + encodeURIComponent('about:blank'), { method: 'PUT' }).then((r) => r.json())
const ws = new WebSocket(target.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const report = { at: new Date().toISOString(), results: {} }
const consoleErrors = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id); pending.delete(msg.id)
    msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result)
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300))
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('EXC: ' + (msg.params.exceptionDetails.text || '').slice(0, 300))
  }
}
await new Promise((r) => { ws.onopen = r })
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const mid = ++seq; pending.set(mid, { res, rej })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error("eval error: " + JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result ? r.result.value : undefined
}
async function clickEl(expression) {
  return evaluate("(() => { const t = " + expression + "; if (!t) return { clicked: false }; ['mousedown','mouseup','click'].forEach((ty) => t.dispatchEvent(new MouseEvent(ty, { bubbles: true, cancelable: true, view: window }))); return { clicked: true } })()")
}
async function pass(k, v) { report.results[k] = v; console.log('  [', v ? 'PASS' : 'FAIL', ']', k) }

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: tokenUrl })
await sleep(12000)

// 选择工作区（跳过引导与 API Key 配置）
await clickEl("[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('\u7a0d\u540e\u914d\u7f6e'))")
await sleep(1500)
await clickEl("[...document.querySelectorAll('[role=textbox], input')].find((b) => ((b.getAttribute('aria-label') || '') + (b.getAttribute('placeholder') || '') + (b.textContent || '')).includes('\u9009\u62e9\u5de5\u4f5c\u533a'))")
await sleep(1200)
const adopt = await evaluate("(() => { const items = [...document.querySelectorAll('button, [role=menuitem], [role=option]')]; const t = items.find((b) => ((b.getAttribute('aria-label') || '') + (b.textContent || '')).includes('Downloads')); if (!t) return false; [\'mousedown\',\'mouseup\',\'click\'].forEach((ty) => t.dispatchEvent(new MouseEvent(ty, { bubbles: true, cancelable: true, view: window }))); return true })()")
await sleep(5000)
const composer = await evaluate("!!document.querySelector('[data-composer-input][contenteditable=true]')")
await pass('composer-ready', composer)

// E1 单一 Plan 按钮
const planBtns = await evaluate("(() => [...document.querySelectorAll('[data-plan-button]')].map((b) => ({ text: b.textContent.trim(), cls: b.className, on: b.className.includes('dsh-ie-plan-on') })))()")
await pass('E1-plan-button-single', planBtns.length === 1)

// E2 分类菜单
await clickEl("[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('\u6307\u4ee4'))")
await sleep(1500)
const menu = await evaluate("(() => { const cat = document.querySelector('[data-categorized-menu]'); return { categorized: !!cat, titles: cat ? [...cat.querySelectorAll('.dsh-ie-cat-title')].map((n) => n.textContent) : [] } })()")
await pass('E2-categorized-menu', menu.categorized && JSON.stringify(menu.titles).includes('\u6a21\u5f0f'))
await clickEl("[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('\u6307\u4ee4'))")
await sleep(1200)

// E3 三态切换
const on1 = await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); if (!b) return null; [\'mousedown\',\'mouseup\',\'click\'].forEach((ty) => b.dispatchEvent(new MouseEvent(ty, { bubbles: true, cancelable: true, view: window }))); return true })()")
await sleep(2500)
const stateA = await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); return b ? { on: b.className.includes('dsh-ie-plan-on'), cls: b.className } : null })()")
// 关闭常驻再点一次按键（回初始）——若当前开启则点击退出；目标：三态往返无异常
const stateB = await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); if (!b) return null; [\'mousedown\',\'mouseup\',\'click\'].forEach((ty) => b.dispatchEvent(new MouseEvent(ty, { bubbles: true, cancelable: true, view: window }))); return true })()")
await sleep(2500)
const stateC = await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); return b ? { on: b.className.includes('dsh-ie-plan-on'), cls: b.className } : null })()")
await pass('E3-toggle-roundtrip', !!stateA && !!stateC && stateA.on !== stateC.on)

// E4 右键菜单 + localStorage
const ctx = await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); if (!b) return null; b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window })); return true })()")
await sleep(1200)
const item = await evaluate("(() => [...document.querySelectorAll('[role=menuitem]')].map((n) => n.textContent.trim()).filter((t) => t.includes('\u9ed8\u8ba4 Plan')))()")
await pass('E4-context-item', Array.isArray(item) && item.length === 1)
const stateBefore = await evaluate("(() => { const t = [...document.querySelectorAll('[role=menuitem]')].find((n) => (n.textContent || '').includes('\u9ed8\u8ba4 Plan')); if (!t) return null; return t.querySelector('[data-testid=plan-checkbox]') ? t.querySelector('[data-testid=plan-checkbox]').dataset.checked : 'missing' })()")
const persistClicked = await evaluate("(() => { const t = [...document.querySelectorAll('[role=menuitem]')].find((n) => (n.textContent || '').includes('\u9ed8\u8ba4 Plan')); if (!t) return false; ['mousedown','mouseup','click'].forEach((ty) => t.dispatchEvent(new MouseEvent(ty, { bubbles: true, cancelable: true, view: window }))); return true })()")
await sleep(1200)
await sleep(1500)
const ls = await evaluate("(() => { const k = 'dsh-input-enhancer:defaultPlanMode'; return { value: localStorage.getItem(k), present: localStorage.getItem(k) !== null } })()")
await pass('E4-persist-write', persistClicked && ls.present && (ls.value === 'true' || ls.value === 'false'))
// E4b 方框勾选状态即时同步：重开右键菜单读取 data-checked（初始 false → 勾选后 true）
await evaluate("(() => { const b = document.querySelector('[data-plan-button]'); if (!b) return null; b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window })); return true })()")
await sleep(1200)
const stateAfter = await evaluate("(() => { const t = [...document.querySelectorAll('[role=menuitem]')].find((n) => (n.textContent || '').includes('\u9ed8\u8ba4 Plan')); if (!t) return null; const box = t.querySelector('[data-testid=plan-checkbox]'); return box ? box.dataset.checked : 'missing' })()")
await pass('E4b-checkbox-state-sync', stateBefore === 'false' && stateAfter === 'true')
// 关闭菜单恢复现场
await evaluate("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))")
await sleep(800)

// E6 每次打开置顶：滚动到底→外部点击关闭→重开 → scrollTop 回 0、首分类“模式”
await evaluate("localStorage.setItem('dsh-input-enhancer:defaultPlanMode', 'false'); true")
const plusBtn = "[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('\u6307\u4ee4'))"
await clickEl(plusBtn)
await sleep(1500)
await evaluate("(() => { const v = document.querySelector('[data-categorized-menu] .dsh-ie-menu-viewport'); if (v) v.scrollTop = 99999; return true })()")
await sleep(400)
await evaluate("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))")
await sleep(900)
await clickEl(plusBtn)
await sleep(1500)
const reopen = await evaluate("(() => { const v = document.querySelector('[data-categorized-menu] .dsh-ie-menu-viewport'); if (!v) return null; const first = document.querySelector('[data-categorized-menu] .dsh-ie-cat-title'); const active = document.querySelector('[data-categorized-menu] .dsh-ie-active .dsh-ie-menu-name'); return { scrollTop: v.scrollTop, firstTitle: first ? first.textContent : null, activeName: active ? active.textContent : null } })()")
await pass('E6-reopen-scroll-top', !!reopen && reopen.scrollTop === 0 && reopen.firstTitle === '\u6a21\u5f0f')
if (reopen) report.reopen = reopen

// E5 无控制台错误
await pass('E5-no-console-errors', consoleErrors.length === 0)
if (consoleErrors.length) report.consoleErrors = consoleErrors.slice(0, 10)

report.passCount = Object.values(report.results).filter(Boolean).length
report.totalCount = Object.keys(report.results).length
report.ok = report.passCount === report.totalCount
const file = join(outDir, 'e2e-report.json')
writeFileSync(file, JSON.stringify({ ...report, planButtons: planBtns, menu, stateAfterClick: stateA, stateAfterSecond: stateC }, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log('report:', file)
process.exit(report.ok ? 0 : 1)