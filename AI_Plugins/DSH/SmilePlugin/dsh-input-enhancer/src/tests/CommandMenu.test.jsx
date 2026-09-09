/**
 * 命令菜单组件测试：
 * - launcher==='command' 时渲染分类菜单，否则保持原生兼容分支；
 * - 分类行选择路由到 controller.pick（原始索引）；
 * - 分类打开期间上下方向键按视觉排序移动原生高亮；IME 放行；Enter 不拦截。
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CommandMenu } from '../client/menu/CommandMenu.jsx'

/** 极简快照 store（支持订阅/取值）。 */
function store(initial) {
  let value = initial
  const listeners = new Set()
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    getSnapshot: () => value,
    set(next) { value = next; for (const fn of listeners) fn() },
  }
}

function candidate(name, extra = {}) {
  return { name, ...extra }
}

function key(name) {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
}

function makeProps({ launcher = null, open = false, groups = [], highlight = null, ownerResolver } = {}) {
  const menu = store({ open, hit: null, generation: 1, groups, highlight })
  const headers = store(new Map())
  const launch = store(launcher)
  const onPick = vi.fn()
  const onCrumb = vi.fn()
  const onHover = vi.fn()
  const onDismiss = vi.fn()
  const utils = {
    menu, headers, launcher: launch, onPick, onCrumb, onHover, onDismiss,
    ownerResolver,
  }
  utils.render = () => render(
    <CommandMenu
      menu={menu}
      headers={headers}
      launcher={launch}
      onPick={onPick}
      onCrumb={onCrumb}
      // 模拟原生控制器：hover 会回写快照高亮，驱动后续按键从新位置继续
      onHover={(source, index) => {
        onHover(source, index)
        menu.set({ ...menu.getSnapshot(), highlight: { source, index } })
      }}
      onDismiss={onDismiss}
      ownerResolver={utils.ownerResolver}
    />,
  )
  return utils
}

describe('CommandMenu 分支', () => {
  const commandItems = [
    candidate('plan', { description: '进入计划' }),
    candidate('model'),
    candidate('compact'),
    candidate('mystery', { description: '未知命令' }),
  ]
  const groups = [{ source: 'command', showGroupTitle: true, status: 'ready', items: commandItems }]

  it('关闭时不渲染任何菜单', () => {
    const p = makeProps({ launcher: 'command', open: false, groups })
    const { container } = p.render()
    expect(container.firstChild).toBeNull()
  })

  it('launcher 为 command 且打开时渲染分类菜单', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    const { container } = p.render()
    expect(container.querySelector('[data-categorized-menu]')).toBeTruthy()
    for (const title of ['模式', '模型', '会话', '其他']) {
      expect(screen.getByText(title)).toBeTruthy()
    }
    // 空白分类（权限）不显示
    expect(screen.queryByText('权限')).toBeNull()
  })

  it('空分类隐藏、未知命令进其他', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [candidate('mystery')] }],
    })
    p.render()
    expect(screen.getByText('其他')).toBeTruthy()
    expect(screen.queryByText('模式')).toBeNull()
  })

  it('客户端插件贡献的命令同样出现在分类中', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [candidate('client-tool')] }],
    })
    p.render()
    expect(screen.getByText('其他')).toBeTruthy()
    expect(screen.getByText('client-tool')).toBeTruthy()
  })

  it('非 command 启动器（/ 或 @）保持原生兼容分支，组标题按来源显示', () => {
    const p = makeProps({ launcher: null, open: true, groups })
    const { container } = p.render()
    expect(container.querySelector('[data-categorized-menu]')).toBeNull()
    expect(container.querySelector('[data-trigger-menu]')).toBeTruthy()
    expect(screen.getByText('command')).toBeTruthy() // 原生组标题
  })
})

describe('CategorizedMenu 选择与键盘', () => {
  const groups = [{
    source: 'command',
    showGroupTitle: true,
    status: 'ready',
    items: [
      candidate('plan'),
      candidate('model'),
      candidate('compact'),
      candidate('mystery'),
    ],
  }]

  it('点击分类行以原始索引路由到 controller.pick', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    fireEvent.mouseDown(screen.getByRole('option', { name: /plan/i }))
    expect(p.onPick).toHaveBeenCalledWith('command', 0)
    fireEvent.mouseDown(screen.getByRole('option', { name: /compact/i }))
    expect(p.onPick).toHaveBeenCalledWith('command', 2)
  })

  it('悬停路由到 controller.hover（原始索引）', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    fireEvent.mouseMove(screen.getByRole('option', { name: /mystery/i }))
    expect(p.onHover).toHaveBeenCalledWith('command', 3)
  })

  it('ArrowDown/ArrowUp 按视觉排序移动高亮（wrap 循环；打开时已同步到首行）', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    p.onHover.mockClear() // 清掉打开置顶的初始同步调用，聚焦键盘移动
    const down = key('ArrowDown')
    fireEvent(document, down)
    expect(down.defaultPrevented).toBe(true)
    expect(p.onHover).toHaveBeenLastCalledWith('command', 1)
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 2)
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 3)
    fireEvent(document, key('ArrowUp'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 2)
  })

  it('输入法组合期间放行方向键（不移动高亮、不阻止默认）', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    p.onHover.mockClear() // 清掉打开置顶的初始同步调用
    const composing = key('ArrowDown')
    Object.defineProperty(composing, 'isComposing', { value: true })
    fireEvent(document, composing)
    expect(composing.defaultPrevented).toBe(false)
    expect(p.onHover).not.toHaveBeenCalled()
  })

  it('Enter/Tab/Escape 不拦截（继续走原生仲裁）', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    p.onHover.mockClear() // 清掉打开置顶的初始同步调用
    const enter = key('Enter')
    const tab = key('Tab')
    const esc = key('Escape')
    fireEvent(document, enter)
    fireEvent(document, tab)
    fireEvent(document, esc)
    expect(enter.defaultPrevented).toBe(false)
    expect(tab.defaultPrevented).toBe(false)
    expect(esc.defaultPrevented).toBe(false)
    expect(p.onHover).not.toHaveBeenCalled()
  })

  it('菜单关闭或卸载后解除键盘接管', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    const { unmount } = p.render()
    p.onHover.mockClear() // 清掉打开置顶的初始同步调用
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenCalledTimes(1)
    unmount()
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenCalledTimes(1)
  })

  it('候选更新（新快照）后按键按新视觉排序移动', () => {
    const p = makeProps({ launcher: 'command', open: true, groups })
    p.render()
    p.onHover.mockClear()
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 1)
    act(() => {
      p.menu.set({
        open: true, hit: null, generation: 2,
        groups: [{
          source: 'command', showGroupTitle: true, status: 'ready',
          items: [candidate('model'), candidate('mystery')],
        }],
        highlight: null,
      })
    })
    // 新代次：打开置顶同步把高亮带回新视觉首行（model）
    expect(p.onHover).toHaveBeenLastCalledWith('command', 0)
    p.onHover.mockClear()
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 1)
    fireEvent(document, key('ArrowDown'))
    expect(p.onHover).toHaveBeenLastCalledWith('command', 0)
  })
})

describe('OriginalMenuView 兼容行为', () => {
  const groups = [{
    source: 'command', showGroupTitle: true, status: 'ready',
    items: [candidate('plan'), candidate('model')],
  }]

  it('按原始顺序渲染原生候选（不遗漏）', () => {
    const p = makeProps({ launcher: null, open: true, groups })
    p.render()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0].textContent).toContain('plan')
    expect(options[1].textContent).toContain('model')
  })

  it('外部指针点击（菜单与输入栏之外）调 dismiss', () => {
    const p = makeProps({ launcher: null, open: true, groups })
    p.render()
    fireEvent.pointerDown(document.body)
    expect(p.onDismiss).toHaveBeenCalled()
  })

  it('pending 组显示加载骨架（不参与分类）', () => {
    const p = makeProps({
      launcher: null, open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'pending', items: [] }],
    })
    p.render()
    expect(screen.getByRole('status', { name: '加载中' })).toBeTruthy()
  })
})

describe('插件归属分类渲染（v2.1.0）', () => {
  it('未知命令按 ownerResolver 归入插件分类，标题为插件名', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [
        candidate('plan'),
        candidate('rewind'),
        candidate('mystery'),
      ] }],
      // 模拟真实 resolver：内部已含 L3/L1/L2 链，返回值即最终归属
      ownerResolver: (name) => (name === 'mystery' ? 'my-plugin' : name === 'rewind' ? 'dsh-rewind-plugin' : null),
    })
    p.render()
    expect(screen.getByText('模式')).toBeTruthy()
    expect(screen.getByText('dsh-rewind-plugin')).toBeTruthy()
    expect(screen.getByText('my-plugin')).toBeTruthy()
  })

  it('无归属的未知命令仍进其他', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [candidate('mystery')] }],
      ownerResolver: () => null,
    })
    p.render()
    expect(screen.getByText('其他')).toBeTruthy()
  })
})

describe('打开置顶与高亮同步（v2.1.0）', () => {
  it('打开且就绪时：高亮同步到视觉首行（onHover 调用一次）', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      // 原生高亮指向 compact（视觉上位于会话分类，非首行）
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [
        candidate('goal'), candidate('model'), candidate('compact'),
      ] }],
      highlight: { source: 'command', index: 2 },
    })
    p.render()
    // 首行是视觉第一项：goal（source command, index 0）
    expect(p.onHover).toHaveBeenCalledWith('command', 0)
  })

  it('高亮已在视觉首行时不重复同步', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'ready', items: [candidate('goal')] }],
      highlight: { source: 'command', index: 0 },
    })
    p.render()
    expect(p.onHover).not.toHaveBeenCalled()
  })

  it('行集为空（pending）时不同步', () => {
    const p = makeProps({
      launcher: 'command', open: true,
      groups: [{ source: 'command', showGroupTitle: true, status: 'pending', items: [] }],
    })
    p.render()
    expect(p.onHover).not.toHaveBeenCalled()
  })
})