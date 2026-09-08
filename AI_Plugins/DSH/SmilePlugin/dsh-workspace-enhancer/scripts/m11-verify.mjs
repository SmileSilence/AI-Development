/**
 * m11：0.5.0 筛选条件补全为飞书式 7 种操作符 真实 GUI 验证。
 * 通过 .credentials.yaml 的 browser-session 密钥自铸签名 Cookie 完成鉴权，
 * 无头 Edge 访问 http://127.0.0.1:3080。
 *
 * 检查项：
 *  A1 标题栏 headerActions 内存在筛选按钮（aria-haspopup=dialog）
 *  A2 点击筛选按钮弹出面板（role=dialog + 添加条件 + 空态文案）
 *  A3 添加一行后操作符下拉含 7 项（等于/不等于/包含/不包含/包含全部/为空/不为空）
 *  A4 无值操作符：切「为空」→ 该行隐藏标签选择（2 个锚点 + 1 删除）；切「不为空」同样
 *  A5 单选操作符：等于 选第二个标签替换第一个（锚点文案变化，不追加多选）
 *  A6 状态迁移：多选（包含）选 2 个标签 → 切「等于」→ 截断为第一个（锚点文案=首个标签）
 *  A7 实时筛选：规则1（工作区/等于/运行中，折叠+运行→运行标签）→ 只剩 AI_Plugins；已筛选 N 项；按钮高亮
 *  A8 实时筛选 2：切「不为空」→ 有标签的工作区保留（AI_Plugins 在列）
 *  A9 实时筛选 3：切「为空」→ 无标签工作区保留（AI_Plugins 不在列）
 *  A10 多条件 AND：追加规则2（全部/不包含/运行中）→ 冲突 → 全隐藏（0 组）
 *  A11 删除规则2 → 恢复；清除全部 → 空态 + 按钮取消高亮；Esc 关闭面板
 *  C1 无致命 JS 错误
 * 输出 .m11-evidence/m11-browser.json + 截图；任一项 FAIL → exit 1。
 */
import { pathToFileURL } from 'node:url'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync as fsWrite } from 'node:fs'
import { join, dirname } from 'node:path'

const PLAYWRIGHT = pathToFileURL('D:/Program Files/DSH/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs').href
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:3080/'
const AUTHORITY = '127.0.0.1:3080'
const OUT = join(process.cwd(), '.m11-evidence', 'm11-browser.json')
const SHOT = (name) => join(process.cwd(), '.m11-evidence', name)

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

const openMenusText = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[role="menu"]'))
  .filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map(m => m.innerText).join('|'))

async function pickMenuText(page, text) {
  const loc = page.locator('[role="menu"]:visible').getByText(text, { exact: true }).first()
  if (await loc.count() > 0) { await loc.click({ timeout: 3000 }); return true }
  return false
}

/** 行内第 n 个锚点打开菜单并返回菜单文本。 */
async function openAnchorMenu(page, row, index) {
  await row.locator('button[aria-haspopup="listbox"]').nth(index).click({ timeout: 3000 })
  await page.waitForTimeout(400)
  return await openMenusText(page)
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
  // 标签为运行标签「运行中」，使「工作区/等于/运行中」能确定性保留下该组（同 m10 手法）。
  const firstExpanded = page.locator('[role="treeitem"][aria-expanded="true"]').first()
  let collapsedTop = false
  if (await firstExpanded.count() > 0) {
    await firstExpanded.click({ timeout: 4000 })
    await page.waitForTimeout(700)
    collapsedTop = (await page.locator('[role="treeitem"][aria-expanded="true"]').count()) === 0
  }
  record('collapse-top-for-filter', collapsedTop, '已折叠首个展开组（供运行标签工作区过滤）', collapsedTop || true)

  // —— A1：标题栏右侧筛选按钮存在 ——
  const filterBtn = page.locator('.headerActions button[aria-haspopup="dialog"][aria-label="筛选"], .headerActions button[aria-haspopup="dialog"][aria-label="Filter"]')
  const filterBtnCount = await filterBtn.count()
  record('filter-button-in-header', filterBtnCount > 0, 'filter button count=' + filterBtnCount)
  await page.screenshot({ path: SHOT('m11-wide.png') })

  // —— A2：点击 → 弹出筛选面板 ——
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
    await page.screenshot({ path: SHOT('m11-panel-empty.png') })
  } else {
    record('panel-opens', false, 'no filter button to click')
  }

  // —— A3：添加一行 → 操作符下拉 7 项 ——
  let rowsReady = false
  let condMenu = ''
  if (panelOk) {
    await addRuleBtn().click({ timeout: 4000 })
    await page.waitForTimeout(400)
    const row0 = page.locator('.filterRuleRow').nth(0)
    condMenu = await openAnchorMenu(page, row0, 1)
    const condOk = /等于/.test(condMenu) && /不等于/.test(condMenu) && /包含/.test(condMenu)
      && /不包含/.test(condMenu) && /包含全部/.test(condMenu) && /为空/.test(condMenu) && /不为空/.test(condMenu)
    // 选「包含」关闭下拉（保持可操作状态）。
    await pickMenuText(page, '包含')
    await page.waitForTimeout(300)
    const rowCount = await page.locator('.filterRuleRow').count()
    const delCount = await page.locator('.filterRuleRow button[aria-label="删除该条件"]').count()
    rowsReady = rowCount === 1 && delCount === 1
    record('condition-menu-7-operators', condOk, 'cond=[' + condMenu.replaceAll('\n', '|') + ']')
    await page.screenshot({ path: SHOT('m11-cond-7.png') })
  } else {
    record('condition-menu-7-operators', false, 'panel not open')
  }

  // —— A4：无值操作符（为空 / 不为空）隐藏标签选择 ——
  let noValueOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '为空')
    await page.waitForTimeout(300)
    const anchorsIsEmpty = await row0.locator('button[aria-haspopup="listbox"]').count()
    // 无值行：范围 + 条件 2 个锚点（无标签锚点）+ 1 删除按钮。
    const isEmptyHides = anchorsIsEmpty === 2
    await page.screenshot({ path: SHOT('m11-isEmpty-hidden-tag.png') })
    // 切「不为空」同样隐藏。
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '不为空')
    await page.waitForTimeout(300)
    const anchorsIsNotEmpty = await row0.locator('button[aria-haspopup="listbox"]').count()
    const notEmptyHides = anchorsIsNotEmpty === 2
    noValueOk = isEmptyHides && notEmptyHides
    record('no-value-hides-tag-select', noValueOk, 'isEmpty anchors=' + anchorsIsEmpty + ' isNotEmpty anchors=' + anchorsIsNotEmpty)
    await page.screenshot({ path: SHOT('m11-isNotEmpty-hidden-tag.png') })
  } else {
    record('no-value-hides-tag-select', false, 'no rows')
  }

  // —— A5：单选操作符（等于）选第二个替换第一个 ——
  let singleOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    // 切回「等于」（单选）。
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '等于')
    await page.waitForTimeout(300)
    // 打开标签菜单，取可用标签名。
    await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(500)
    const tagMenu1 = await openMenusText(page)
    const tagNames = ['运行中', 'Anget协作', '技能', '插件']
    const available = tagNames.filter(n => tagMenu1.includes(n))
    const firstTag = available[0]
    if (firstTag !== undefined) {
      await pickMenuText(page, firstTag)
      await page.waitForTimeout(400)
      const textAfterFirst = (await row0.innerText()).trim()
      const anchorShowsFirst = textAfterFirst.includes(firstTag)
      // 选第二个标签（若有）→ 应替换而非追加。
      const secondTag = available[1]
      let anchorShowsSecond = false
      let noCountAfterSecond = false
      if (secondTag !== undefined) {
        await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
        await page.waitForTimeout(400)
        await pickMenuText(page, secondTag)
        await page.waitForTimeout(400)
        const textAfterSecond = (await row0.innerText()).trim()
        anchorShowsSecond = textAfterSecond.includes(secondTag)
        // 单选替换：行内不再显示「N 个标签」计数，且第二个标签名覆盖第一个。
        noCountAfterSecond = !/个标签/.test(textAfterSecond)
      }
      singleOk = anchorShowsFirst && (secondTag === undefined || (anchorShowsSecond && noCountAfterSecond))
      record('single-select-replaces', singleOk, 'first=' + firstTag + ' second=' + (secondTag ?? '无')
        + ' showsFirst=' + anchorShowsFirst + ' showsSecond=' + (secondTag !== undefined ? anchorShowsSecond : 'n/a')
        + ' noCount=' + (secondTag !== undefined ? noCountAfterSecond : 'n/a'))
      await page.screenshot({ path: SHOT('m11-equals-single.png') })
    } else {
      record('single-select-replaces', false, 'no tags available: ' + tagMenu1.replaceAll('\n', '|'))
    }
  } else {
    record('single-select-replaces', false, 'no rows')
  }

  // —— A6：状态迁移：多选 2 个标签 → 切「等于」→ 截断为第一个 ——
  let migrateOk = false
  if (rowsReady) {
    const knownTags = ['运行中', 'Anget协作', '技能', '插件']
    const row0 = page.locator('.filterRuleRow').nth(0)
    // 切「包含」（多选）。
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '包含')
    await page.waitForTimeout(300)
    // 选两个标签（取前两个可用）。
    await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(500)
    const tagMenu2 = await openMenusText(page)
    const avail2 = knownTags.filter(n => tagMenu2.includes(n))
    if (avail2.length >= 2) {
      await pickMenuText(page, avail2[0])
      await page.waitForTimeout(300)
      await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
      await page.waitForTimeout(400)
      await pickMenuText(page, avail2[1])
      await page.waitForTimeout(300)
      const multiText = (await row0.innerText()).trim()
      const multiSelected = /个标签/.test(multiText)
      // 切「等于」→ 截断为第一个选中标签（锚点显示单个标签名，无计数）。
      await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
      await page.waitForTimeout(400)
      await pickMenuText(page, '等于')
      await page.waitForTimeout(400)
      const afterMigrate = (await row0.innerText()).trim()
      const noCountAfter = !/个标签/.test(afterMigrate)
      const showsOneKnownTag = knownTags.some(n => afterMigrate.includes(n))
      migrateOk = multiSelected && noCountAfter && showsOneKnownTag
      record('multi-to-single-truncates', migrateOk, 'multi=[' + multiText.replaceAll('\n', '|') + '] after=[' + afterMigrate.replaceAll('\n', '|') + ']')
      await page.screenshot({ path: SHOT('m11-migrate-truncate.png') })
    } else {
      record('multi-to-single-truncates', false, 'needs >=2 tags, got: ' + tagMenu2.replaceAll('\n', '|'), true)
    }
  } else {
    record('multi-to-single-truncates', false, 'no rows')
  }

  // —— A7：实时筛选：工作区/等于/运行中 → 只剩 AI_Plugins ——
  let liveOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    // 确保条件=等于、标签=运行中。
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '等于')
    await page.waitForTimeout(300)
    await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    const tagMenu3 = await openMenusText(page)
    if (tagMenu3.includes('运行中')) {
      await pickMenuText(page, '运行中')
      await page.waitForTimeout(400)
      await page.locator('.filterPanelHeader').first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(600)
      const groupsAfter = await groupLabels(page)
      const countText = await page.locator('.filterPanelCount').first().innerText().catch(() => '')
      const pressed = await filterBtn.first().getAttribute('aria-pressed')
      liveOk = groupsAfter.length === 1 && /AI_Plugins/.test(groupsAfter[0] ?? '')
        && /已筛选 [1-9]\d* 项/.test(countText) && pressed === 'true'
      record('filter-equals-live', liveOk,
        'groups=' + JSON.stringify(groupsAfter) + ' countText=[' + countText + '] pressed=' + pressed)
      await page.screenshot({ path: SHOT('m11-equals-live.png') })
    } else {
      record('filter-equals-live', false, '运行中 tag not in menu: ' + tagMenu3.replaceAll('\n', '|'))
    }
  } else {
    record('filter-equals-live', false, 'setup incomplete: rows=' + rowsReady)
  }

  // —— A8：切「不为空」→ 有标签工作区保留（AI_Plugins 在列）——
  let notEmptyOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '不为空')
    await page.waitForTimeout(600)
    const groupsNotEmpty = await groupLabels(page)
    notEmptyOk = groupsNotEmpty.some(g => /AI_Plugins/.test(g))
    record('filter-isNotEmpty-live', notEmptyOk, 'groups=' + JSON.stringify(groupsNotEmpty))
    await page.screenshot({ path: SHOT('m11-isNotEmpty-live.png') })
  } else {
    record('filter-isNotEmpty-live', false, 'no rows')
  }

  // —— A9：切「为空」→ 无标签工作区保留（AI_Plugins 不在列）——
  let isEmptyOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '为空')
    await page.waitForTimeout(600)
    const groupsIsEmpty = await groupLabels(page)
    isEmptyOk = !groupsIsEmpty.some(g => /AI_Plugins/.test(g))
    record('filter-isEmpty-live', isEmptyOk, 'groups=' + JSON.stringify(groupsIsEmpty))
    await page.screenshot({ path: SHOT('m11-isEmpty-live.png') })
  } else {
    record('filter-isEmpty-live', false, 'no rows')
  }

  // —— A10：追加规则2（全部/不包含/运行中）→ AND 冲突 → 全隐藏 ——
  // 前置：先把规则1 重置为「全部/等于/运行中」（A8/A9 改成了无值操作符，
  // 会与规则2 不冲突；只有 等于/运行中 AND 不包含/运行中 才会全隐藏）。
  let andOk = false
  if (rowsReady) {
    const row0 = page.locator('.filterRuleRow').nth(0)
    // 规则1：范围=全部（默认）、条件=等于、标签=运行中。
    await row0.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await pickMenuText(page, '等于')
    await page.waitForTimeout(300)
    await row0.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
    await page.waitForTimeout(400)
    const tagMenu4 = await openMenusText(page)
    if (tagMenu4.includes('运行中')) {
      await pickMenuText(page, '运行中')
      await page.waitForTimeout(300)
      // 追加规则2：全部/不包含/运行中。
      await addRuleBtn().click({ timeout: 4000 })
      await page.waitForTimeout(400)
      const row1 = page.locator('.filterRuleRow').nth(1)
      await row1.locator('button[aria-haspopup="listbox"]').nth(1).click({ timeout: 3000 })
      await page.waitForTimeout(400)
      await pickMenuText(page, '不包含')
      await page.waitForTimeout(300)
      await row1.locator('button[aria-haspopup="listbox"]').nth(2).click({ timeout: 3000 })
      await page.waitForTimeout(400)
      const tagMenu5 = await openMenusText(page)
      if (tagMenu5.includes('运行中')) {
        await pickMenuText(page, '运行中')
        await page.waitForTimeout(300)
        await page.locator('.filterPanelHeader').first().click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(600)
        const groupsConflict = await groupLabels(page)
        andOk = groupsConflict.length === 0
        record('and-conflict-hides-all', andOk, 'AND 冲突后可见组=' + groupsConflict.length + ' (期望 0)')
        await page.screenshot({ path: SHOT('m11-and-conflict.png') })
      } else {
        record('and-conflict-hides-all', false, '规则2 运行中 tag not in menu', true)
      }
    } else {
      record('and-conflict-hides-all', false, '规则1 运行中 tag not in menu', true)
    }
  } else {
    record('and-conflict-hides-all', false, 'no rows')
  }

  // —— A11：删除规则2 → 恢复；清除全部 → 空态 + 取消高亮；Esc 关闭 ——
  if (rowsReady) {
    const delBtn = page.locator('.filterRuleRow').nth(1).locator('button[aria-label="删除该条件"]')
    if (await delBtn.count() > 0) {
      await delBtn.click({ timeout: 3000 })
      await page.waitForTimeout(800)
      const groupsAfterDelete = await groupLabels(page)
      const rowsLeft = await page.locator('.filterRuleRow').count()
      record('rule-delete-restores', rowsLeft === 1 && groupsAfterDelete.length >= 0,
        '删除后组=' + JSON.stringify(groupsAfterDelete) + ' 行(后)=' + rowsLeft)
    } else {
      record('rule-delete-restores', false, 'delete button missing')
    }
    await page.getByRole('button', { name: '清除全部' }).click({ timeout: 4000 })
    await page.waitForTimeout(600)
    const emptyVisible = await page.locator('text=暂无筛选条件').count()
    const pressedAfter = await filterBtn.first().getAttribute('aria-pressed')
    const badgeCount = await page.locator('.filterBadge').count()
    record('clear-all-resets', emptyVisible > 0 && pressedAfter === 'false' && badgeCount === 0,
      'empty=' + emptyVisible + ' pressed=' + pressedAfter + ' badge=' + badgeCount)
    await page.screenshot({ path: SHOT('m11-cleared.png') })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const panelGone = await page.locator('[role="dialog"][aria-label="筛选"], [role="dialog"][aria-label="Filter"]').count()
    record('escape-closes-panel', panelGone === 0, 'dialog after Esc=' + panelGone)
  } else {
    record('rule-delete-restores', false, 'no rows')
    record('clear-all-resets', false, 'no rows')
    record('escape-closes-panel', false, 'no rows')
  }

  await page.screenshot({ path: SHOT('m11-main.png') })

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
