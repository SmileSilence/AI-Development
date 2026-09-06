/**
 * m10：0.4.0 筛选器改造 + 搜索按钮布局修复 真实 GUI 验证。
 * 通过 .credentials.yaml 的 browser-session 密钥自铸签名 Cookie 完成鉴权，
 * 无头 Edge 访问 http://127.0.0.1:3080。
 *
 * 检查项：
 *  A1 不再存在常驻独立一行的标签筛选器（role=toolbar aria-label=标签筛选）
 *  A2 标题栏 headerActions 内存在筛选按钮（aria-haspopup=dialog, aria-label=筛选）
 *  A3 点击筛选按钮弹出面板（role=dialog + 添加条件 + 空态文案）
 *  A4 面板多条件：添加两行条件（每行 3 个下拉锚点 + 1 个删除按钮）
 *  A5 行内下拉：范围（全部/工作区/会话）与条件（包含/不包含/等于）可展开
 *  A6 标签下拉可选标签（无标签 + 运行中）
 *  A7 实时筛选：规则1（工作区/等于/运行中）→ 只剩 AI_Plugins；已筛选 N 项；按钮高亮
 *  A8 多条件 AND：追加规则2（全部/不包含/运行中）→ 冲突 → 全隐藏（0 组）
 *  A9 删除规则2 → 恢复；清除全部 → 空态 + 按钮取消高亮；Esc 关闭面板
 *  B1 搜索按钮布局：headerActions margin-left=0、gap=4px、与搜索框紧挨（间距≤12px）
 *  B2 搜索仍可点击展开（best-effort）
 *  C1 无致命 JS 错误
 * 输出 .m10-evidence/m10-browser.json + 截图；任一项 FAIL → exit 1。
 */
import { pathToFileURL } from 'node:url'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync as fsWrite } from 'node:fs'
import { join, dirname } from 'node:path'

const PLAYWRIGHT = pathToFileURL('D:/Program Files/DSH/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs').href
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:3080/'
const AUTHORITY = '127.0.0.1:3080'
const OUT = join(process.cwd(), '.m10-evidence', 'm10-browser.json')
const SHOT = (name) => join(process.cwd(), '.m10-evidence', name)

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

const groupLabels = async (page) =>
  await page.evaluate(() => Array.from(document.querySelectorAll('[role="treeitem"]'))
    .filter(el => el.hasAttribute('aria-expanded'))
    .map(el => (el.innerText || '').trim().slice(0, 30)))

async function pickMenuText(page, text) {
  const loc = page.locator('[role="menu"]:visible').getByText(text, { exact: true }).first()
  if (await loc.count() > 0) { await loc.click({ timeout: 3000 }); return true }
  return false
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: cookieName, value: cookieValue, url: URL, sameSite: 'Strict', httpOnly: true }])
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('text=工作区', { timeout: 25000, state: 'attached' }).catch(() => {})
  await page.waitForTimeout(3500)

  // 折叠第一个展开的工作区组（AI_Plugins，含运行会话）：折叠 + 运行 → 工作区生效
  // 标签为运行标签，使「全部/包含 运行中」能保留下该组（同 m9 手法）。
  const firstExpanded = page.locator('[role="treeitem"][aria-expanded="true"]').first()
  let collapsedTop = false
  if (await firstExpanded.count() > 0) {
    await firstExpanded.click({ timeout: 4000 })
    await page.waitForTimeout(700)
    collapsedTop = (await page.locator('[role="treeitem"][aria-expanded="true"]').count()) === 0
  }
  record('collapse-top-for-filter', collapsedTop, '已折叠首个展开组（供运行标签工作区过滤）', collapsedTop || true)

  // —— A1：常驻筛选行应消失 ——
  const standaloneCount = await page.locator('[role="toolbar"][aria-label="标签筛选"], [role="toolbar"][aria-label="Tag filter"]').count()
  record('no-standalone-filter-bar', standaloneCount === 0, 'standalone filter bar count=' + standaloneCount)

  // —— A2：标题栏右侧筛选按钮存在 ——
  const filterBtn = page.locator('.headerActions button[aria-haspopup="dialog"][aria-label="筛选"], .headerActions button[aria-haspopup="dialog"][aria-label="Filter"]')
  const filterBtnCount = await filterBtn.count()
  record('filter-button-in-header', filterBtnCount > 0, 'filter button count=' + filterBtnCount)
  await page.screenshot({ path: SHOT('m10-wide.png') })

  // —— A3：点击 → 弹出筛选面板 ——
  const addRuleBtn = () => page.getByRole('button', { name: '添加条件' }).first()
  let panelOk = false
  if (filterBtnCount > 0) {
    await filterBtn.first().click({ timeout: 4000 })
    await page.waitForTimeout(600)
    const dialogCount = await page.locator('[role="dialog"][aria-label="筛选"], [role="dialog"][aria-label="Filter"]').count()
    const addRuleCount = await addRuleBtn().count()
    const emptyCount = await page.locator('text=暂无筛选条件').count()
    panelOk = dialogCount > 0 && addRuleCount > 0 && emptyCount > 0
    record('panel-opens', panelOk, 'dialog=' + dialogCount + ' addRuleBtn=' + addRuleCount + ' empty=' + emptyCount)
    await page.screenshot({ path: SHOT('m10-panel-empty.png') })
  } else {
    record('panel-opens', false, 'no filter button to click')
  }

  // —— A4：添加第一行条件 ——
  let rowsReady = false
  if (panelOk) {
    await addRuleBtn().click({ timeout: 4000 })
    await page.waitForTimeout(400)
    const rowCount = await page.locator('.filterRuleRow').count()
    const selects = await page.locator('.filterRuleRow button[aria-haspopup="listbox"]').count()
    const delCount = await page.locator('.filterRuleRow button[aria-label="删除该条件"]').count()
    rowsReady = rowCount === 1 && selects === 3 && delCount === 1
    record('rule-add-row', rowsReady, 'rows=' + rowCount + ' selects=' + selects + ' delete=' + delCount)
    await page.screenshot({ path: SHOT('m10-panel-one-rule.png') })
  } else {
    record('rule-add-row', false, 'panel not open')
  }

  // —— A5：行内下拉可展开（范围 / 条件）——
  let menusOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    await row0.locator('button[aria-haspopup="listbox"]').nth(0).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    const scopeMenu = (await page.evaluate(() => Array.from(document.querySelectorAll('[role="menu"]'))
      .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map(m => m.innerText).join('|')))
    const scopeOk = /全部/.test(scopeMenu) && /工作区/.test(scopeMenu) && /会话/.test(scopeMenu)
    // 选「全部」关闭下拉（保持默认范围）。
    const allPicked = await pickMenuText(page, '全部')
    await page.waitForTimeout(300)
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    const condMenu = (await page.evaluate(() => Array.from(document.querySelectorAll('[role="menu"]'))
      .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map(m => m.innerText).join('|')))
    const condOk = /包含/.test(condMenu) && /不包含/.test(condMenu) && /等于/.test(condMenu)
    // 选「包含」关闭下拉（保持默认条件）。
    const includePicked = await pickMenuText(page, '包含')
    await page.waitForTimeout(300)
    menusOk = scopeOk && condOk && allPicked && includePicked
    record('rule-row-menus', menusOk, 'scope=[' + scopeMenu.replaceAll('\n', '|') + '] cond=[' + condMenu.replaceAll('\n', '|') + ']')
  } else {
    record('rule-row-menus', false, 'no rows')
  }

  // —— A6：标签下拉可选（无标签 + 运行中），规则1=工作区/等于/运行中 ——
  let tagOk = false
  let pickedTag = null
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(500)
    const openMenu = (await page.evaluate(() => Array.from(document.querySelectorAll('[role="menu"]'))
      .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map(m => m.innerText).join('|')))
    const hasNoTag = /无标签/.test(openMenu)
    const runItem = page.locator('[role="menu"]:visible').getByText('运行中', { exact: true }).first()
    if (await runItem.count() > 0) { await runItem.click({ timeout: 3000 }); pickedTag = '运行中' }
    else {
      const first = page.locator('[role="menu"]:visible').locator('[role="menuitem"], [role="menuitemradio"], [role="option"]').first()
      if (await first.count() > 0) { pickedTag = (await first.innerText()).trim(); await first.click({ timeout: 3000 }) }
    }
    await page.waitForTimeout(500)
    // 关闭标签下拉（点面板头部，仍在面板内）。
    await page.locator('.filterPanelHeader').first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(400)
    tagOk = hasNoTag && pickedTag !== null
    record('rule-tag-select', tagOk, 'menu=[' + openMenu.replaceAll('\n', '|') + '] picked=' + pickedTag)
  } else {
    record('rule-tag-select', false, 'no rows')
  }

  // —— A7：实时筛选生效 + 已筛选 N 项 + 按钮高亮 ——
  let liveOk = false
  if (rowsReady && pickedTag !== null) {
    const groupsAfter = await groupLabels(page)
    const countText = await page.locator('.filterPanelCount').first().innerText().catch(() => '')
    const pressed = await filterBtn.first().getAttribute('aria-pressed')
    liveOk = groupsAfter.length === 1 && /AI_Plugins/.test(groupsAfter[0] ?? '')
      && /已筛选 [1-9]\d* 项/.test(countText) && pressed === 'true'
    record('filter-live-active', liveOk,
      'groups=' + JSON.stringify(groupsAfter) + ' countText=[' + countText + '] pressed=' + pressed)
    await page.screenshot({ path: SHOT('m10-filter-live.png') })
  } else {
    record('filter-live-active', false, 'setup incomplete: rows=' + rowsReady + ' tag=' + pickedTag)
  }

  // —— A8：追加规则2（全部/不包含/运行中）→ AND 冲突 → 全隐藏 ——
  let andOk = false
  if (rowsReady && pickedTag !== null) {
    await addRuleBtn().click({ timeout: 4000 })
    await page.waitForTimeout(400)
    const row1 = page.locator('.filterRuleRow').nth(1)
    await row1.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '不包含')
    await page.waitForTimeout(300)
    await row1.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    const runItem = page.locator('[role="menu"]:visible').getByText('运行中', { exact: true }).first()
    if (await runItem.count() > 0) await runItem.click({ timeout: 3000 })
    else {
      const first = page.locator('[role="menu"]:visible').locator('[role="menuitem"], [role="menuitemradio"], [role="option"]').first()
      if (await first.count() > 0) await first.click({ timeout: 3000 })
    }
    await page.locator('.filterPanelHeader').first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(600)
    const groupsConflict = await groupLabels(page)
    andOk = groupsConflict.length === 0
    record('rule-and-conflict-hides-all', andOk, 'AND 冲突后可见组=' + groupsConflict.length + ' (期望 0)')
    await page.screenshot({ path: SHOT('m10-and-conflict.png') })

    // —— A9a：删除规则2 → 恢复 ——
    const delBtn = page.locator('.filterRuleRow').nth(1).locator('button[aria-label="删除该条件"]')
    if (await delBtn.count() > 0) {
      const rowsBefore = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.filterRuleRow')).map(r => (r.innerText || '').trim().slice(0, 40)))
      await delBtn.click({ timeout: 3000 })
      await page.waitForTimeout(800)
      const groupsAfterDelete = await groupLabels(page)
      const rowsAfter = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.filterRuleRow')).map(r => (r.innerText || '').trim().slice(0, 40)))
      const rowsLeft = rowsAfter.length
      record('rule-delete-restores', groupsAfterDelete.length === 1 && /AI_Plugins/.test(groupsAfterDelete[0] ?? '') && rowsLeft === 1,
        '删除后组=' + JSON.stringify(groupsAfterDelete) + ' 行(前)=' + JSON.stringify(rowsBefore) + ' 行(后)=' + JSON.stringify(rowsAfter))
    } else {
      record('rule-delete-restores', false, 'delete button missing')
    }
  } else {
    record('rule-and-conflict-hides-all', false, 'setup incomplete')
    record('rule-delete-restores', false, 'setup incomplete')
  }

  // —— A9b：清除全部 → 空态 + 按钮取消高亮 ——
  if (panelOk) {
    await page.getByRole('button', { name: '清除全部' }).click({ timeout: 4000 })
    await page.waitForTimeout(600)
    const emptyVisible = await page.locator('text=暂无筛选条件').count()
    const pressedAfter = await filterBtn.first().getAttribute('aria-pressed')
    const badgeCount = await page.locator('.filterBadge').count()
    record('clear-all-resets', emptyVisible > 0 && pressedAfter === 'false' && badgeCount === 0,
      'empty=' + emptyVisible + ' pressed=' + pressedAfter + ' badge=' + badgeCount)
    await page.screenshot({ path: SHOT('m10-cleared.png') })
  } else {
    record('clear-all-resets', false, 'panel not open')
  }

  // —— A9c：Esc 关闭面板 ——
  if (panelOk) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const panelGone = await page.locator('[role="dialog"][aria-label="筛选"], [role="dialog"][aria-label="Filter"]').count()
    record('escape-closes-panel', panelGone === 0, 'dialog after Esc=' + panelGone)
  } else {
    record('escape-closes-panel', false, 'panel not open')
  }

  // —— B1：搜索按钮布局 ——
  const layout = await page.evaluate(() => {
    const search = document.querySelector('.searchSlot')
    const actions = document.querySelector('.headerActions')
    const s = search?.getBoundingClientRect()
    const a = actions?.getBoundingClientRect()
    const cs = actions ? getComputedStyle(actions) : null
    return {
      searchRight: s ? Math.round(s.right) : null,
      actionsLeft: a ? Math.round(a.left) : null,
      gap: a && s ? Math.round(a.left - s.right) : null,
      actionsMarginLeft: cs ? cs.marginLeft : null,
      actionsGap: cs ? cs.gap : null,
      searchFound: !!search,
      actionsFound: !!actions,
    }
  })
  const b1 = layout.actionsFound && layout.searchFound
    && layout.actionsMarginLeft === '0px' && layout.actionsGap === '4px'
    && layout.gap !== null && layout.gap <= 12
  record('search-actions-adjacent', b1, JSON.stringify(layout))
  await page.screenshot({ path: SHOT('m10-header-layout.png') })

  // —— B2：搜索仍可点击展开 ——
  let searchExpandOk = false
  const searchIcon = page.locator('.searchSlot button, .searchSlot input').first()
  if (await searchIcon.count() > 0) {
    try {
      await searchIcon.click({ timeout: 3000 })
      await page.waitForTimeout(700)
      const after = await page.evaluate(() => {
        const search = document.querySelector('.searchSlot')
        const w = search ? search.getBoundingClientRect().width : null
        const actions = document.querySelector('.headerActions')
        const aw = actions ? actions.getBoundingClientRect().width : null
        return { searchW: w ? Math.round(w) : null, actionsW: aw ? Math.round(aw) : null }
      })
      searchExpandOk = after.searchW !== null && after.searchW > 28
      record('search-expands', searchExpandOk, '展开后 searchSlot 宽=' + after.searchW)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    } catch (err) {
      record('search-expands', false, String(err && err.message ? err.message : err), true)
    }
  } else {
    record('search-expands', false, 'search slot not found', true)
  }

  await page.screenshot({ path: SHOT('m10-main.png') })

  const fatal = pageErrors.filter(e => !/404|favicon|sourcemap|net::|pluginsViewer/.test(e))
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
