/**
 * PlanButton 组件测试：三态外观、点击语义、常驻勾选、自动应用、竞态与错误路径。
 * 错误断言使用 role=status 区域 + textContent（避免环境对中文正则的匹配差异）。
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlanButton } from '../client/plan/PlanButton.jsx'
import { PREFERENCE_KEY } from '../client/plan/preference.js'

/** 组合属性工厂：投影/会话由测试注入。 */
function renderPlan({ plan, session = { running: false }, sessionId = 's1', locked = false, execute } = {}) {
  const utils = render(
    <PlanButton
      sessionId={sessionId}
      locked={locked}
      useProjection={() => plan}
      useSession={() => session}
      execute={execute}
    />,
  )
  return { ...utils, button: screen.getByRole('button', { name: /Plan/ }) }
}

function flushMicrotasks() {
  return act(async () => { await Promise.resolve() })
}

const planOff = { active: false, pending: false }
const planOn = { active: true, pending: false }
const planPending = { active: false, pending: true }

describe('PlanButton 三态与点击语义', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('契约：useSession 必须带选择器、useProjection 必须使用 plan 键（防运行时崩溃回归）', () => {
    const useSession = vi.fn(() => ({ running: false }))
    const useProjection = vi.fn(() => planOff)
    render(
      <PlanButton
        sessionId="s1"
        locked={false}
        useProjection={useProjection}
        useSession={useSession}
        execute={vi.fn()}
      />,
    )
    // 应用里 useSession(s => s) 传函数选择器；空参会导致
    // use-sync-external-store 的 selector 未定义而抛 "l is not a function"
    expect(useSession).toHaveBeenCalled()
    const selectorArg = useSession.mock.calls[0][0]
    expect(typeof selectorArg).toBe('function')
    expect(selectorArg({ running: true })).toEqual({ running: true })
    expect(useProjection).toHaveBeenCalledWith('plan')
  })

  it('未启用：中性色按钮、无关闭图标；左键提交 /plan', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: { active: true } })
    renderPlan({ plan: planOff, execute })
    expect(screen.queryByTestId('icon-close')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledWith('/plan')
  })

  it('启用：黄色激活态 + 关闭图标；点击提交 /plan off', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    renderPlan({ plan: planOn, execute })
    const button = screen.getByRole('button', { name: /Plan/ })
    expect(button.className).toContain('dsh-ie-plan-on')
    expect(screen.getByTestId('icon-close')).toBeTruthy()
    fireEvent.click(button)
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledWith('/plan off')
  })

  it('常驻启用时点击退出：先关闭常驻并提交 /plan off', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    render(
      <PlanButton sessionId="s1" locked={false} useProjection={() => planOn} useSession={() => ({ running: false })} execute={execute} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe('false')
    expect(execute).toHaveBeenCalledWith('/plan off')
  })

  it('锁定/原生 pending 期间按钮禁用，阻止相反请求', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    const { unmount } = renderPlan({ plan: planPending, execute })
    expect(screen.getByRole('button', { name: /Plan/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    expect(execute).not.toHaveBeenCalled()
    unmount()
  })

  it('命令失败保留真实状态并显示中文错误', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: false, error: { code: 'BUSY', message: '当前忙线' } })
    renderPlan({ plan: planOff, execute })
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('命令失败：当前忙线')
    expect(status.textContent).toContain('(BUSY)')
    // 状态仍为未启用（投影未变）
    expect(screen.queryByTestId('icon-close')).toBeNull()
  })

  it('执行抛异常显示错误信息', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('network down'))
    renderPlan({ plan: planOff, execute })
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('network down')
  })

  it('未知命令（value undefined）提示', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: undefined })
    renderPlan({ plan: planOff, execute })
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('未知命令')
  })
})

describe('PlanButton 右键菜单与常驻偏好', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('右键弹出常驻勾选项，勾选保存偏好并在允许时开启当前会话', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    renderPlan({ plan: planOff, execute })
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    // v2.2.0：方框勾选样式，文本恒为「默认 Plan」，状态由方框 data-checked 表达
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    const box1 = await screen.findByTestId('plan-checkbox')
    expect(box1.dataset.checked).toBe('false')
    fireEvent.click(screen.getByTestId('menu-item'))
    await flushMicrotasks()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe('true')
    expect(execute).toHaveBeenCalledWith('/plan')
  })

  it('取消勾选只关闭后续自动开启，保留当前会话模式（不提交命令）', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn()
    renderPlan({ plan: planOn, execute })
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    expect((await screen.findByTestId('plan-checkbox')).dataset.checked).toBe('true')
    fireEvent.click(screen.getByTestId('menu-item'))
    await flushMicrotasks()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe('false')
    expect(execute).not.toHaveBeenCalled()
  })

  it('存储写入失败：保持页面选择并明确提示未持久化', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const execute = vi.fn()
    renderPlan({ plan: planOff, execute })
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    fireEvent.click(await screen.findByTestId('menu-item'))
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('常驻偏好未持久化')
    expect(execute).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBeNull()
    vi.restoreAllMocks()
  })

  it('storage 事件同步其他同源标签页的偏好', async () => {
    const execute = vi.fn()
    renderPlan({ plan: planOff, execute })
    act(() => {
      const event = new Event('storage')
      Object.defineProperty(event, 'key', { value: PREFERENCE_KEY })
      Object.defineProperty(event, 'newValue', { value: 'true' })
      window.dispatchEvent(event)
    })
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
  })
})

describe('PlanButton 开关状态即时同步（v2.1.1 回归，v2.2.0 方框样式）', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  /** 读取菜单项方框的当前勾选状态。 */
  async function checkboxState() {
    const box = await screen.findByTestId('plan-checkbox')
    return box.dataset.checked
  }

  it('勾选后重开菜单方框带勾，取消后重开还原（不等 storage 事件，本页写入即时回填）', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    renderPlan({ plan: planOff, execute })
    // 第一次打开：未开启 → 空方框
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    expect(await checkboxState()).toBe('false')
    // 勾选：写入 + 状态回填
    fireEvent.click(screen.getByTestId('menu-item'))
    await flushMicrotasks()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe('true')
    // 重开：方框带勾
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    expect(await checkboxState()).toBe('true')
    // 取消：写入 + 状态回填
    fireEvent.click(screen.getByTestId('menu-item'))
    await flushMicrotasks()
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe('false')
    // 再重开：空方框
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    expect(await checkboxState()).toBe('false')
  })

  it('打开菜单前从存储兜底刷新：旁路写入后打开即显示真状态', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn()
    renderPlan({ plan: planOn, execute })
    // 模拟旁路写入（绕过组件状态，如控制台）
    window.localStorage.setItem(PREFERENCE_KEY, 'false')
    fireEvent.contextMenu(screen.getByRole('button', { name: /Plan/ }))
    expect(await screen.findByText('默认 Plan')).toBeTruthy()
    expect(await checkboxState()).toBe('false')
  })
})

describe('PlanButton 自动应用', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('常驻 + 未启用 + 就绪时自动开启一次；投影普通更新不重复发起', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    const { rerender } = render(
      <PlanButton sessionId="s1" locked={false} useProjection={() => planOff} useSession={() => ({ running: false })} execute={execute} />,
    )
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('/plan')
    // 模拟投影普通更新（active 保持 false）：不新建周期
    rerender(
      <PlanButton sessionId="s1" locked={false} useProjection={() => ({ active: false, pending: false })} useSession={() => ({ running: false })} execute={execute} />,
    )
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('自动开启失败提示且不无限重试；手动入口可重试', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: false, error: { code: 'X', message: '自动失败' } })
    renderPlan({ plan: planOff, execute })
    await flushMicrotasks()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('自动开启失败')
    expect(status.textContent).toContain('自动失败')
    expect(status.textContent).toContain('(X)')
    expect(execute).toHaveBeenCalledTimes(1)
    // 同一会话内不再自动重试
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('会话切换后按新会话重新判定（旧会话自动请求不污染新会话 UI）', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    const props = (sid) => ({
      sessionId: sid,
      locked: false,
      useProjection: () => planOff,
      useSession: () => ({ running: false }),
      execute,
    })
    const { rerender } = render(<PlanButton {...props('s1')} />)
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
    rerender(<PlanButton {...props('s2')} />)
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenLastCalledWith('/plan')
  })

  it('本停留由其他入口退出 Plan 后不自动重开；切换会话仍按偏好处理', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    const { rerender } = render(
      <PlanButton sessionId="s1" locked={false} useProjection={() => planOn} useSession={() => ({ running: false })} execute={execute} />,
    )
    // 其他入口退出：投影 active true → false
    rerender(
      <PlanButton sessionId="s1" locked={false} useProjection={() => ({ active: false, pending: false })} useSession={() => ({ running: false })} execute={execute} />,
    )
    await flushMicrotasks()
    expect(execute).not.toHaveBeenCalled()
    // 切换到新会话：按偏好再次自动开启
    rerender(
      <PlanButton sessionId="s2" locked={false} useProjection={() => ({ active: false, pending: false })} useSession={() => ({ running: false })} execute={execute} />,
    )
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('/plan')
  })

  it('加载未完成（投影 undefined）/锁定/在途请求时不自动开启', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    renderPlan({ plan: undefined, execute })
    await flushMicrotasks()
    expect(execute).not.toHaveBeenCalled()
  })

  it('点击 × 撤销尚未发送的自动任务（常驻被关闭后不再自动开启）', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, 'true')
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    renderPlan({ plan: planOn, execute })
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }))
    await flushMicrotasks()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('/plan off')
  })
})