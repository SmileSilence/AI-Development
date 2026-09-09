/**
 * 插件装配测试：动态注入作用域、席位注册选项与注入面路由。
 * 使用受控 fake 注册中心验证注册契约，不依赖真实 slots。
 */
import { describe, expect, it, vi } from 'vitest'
import { apply } from '../client/plugin.js'
import { registerPlanSeat } from '../client/plan/planSeat.js'
import { registerMenuSeat } from '../client/menu/menuSeat.js'
import { PlanButton } from '../client/plan/PlanButton.jsx'
import { CommandMenu } from '../client/menu/CommandMenu.jsx'
import { OriginalMenuView } from '../client/menu/OriginalMenuView.jsx'
import { CategorizedMenu } from '../client/menu/CategorizedMenu.jsx'
import { DirectionAdjustDock } from '../client/direction/DirectionAdjustDock.jsx'
import { registerDirectionAdjustSeat } from '../client/direction/directionSeat.js'

/** 记录 slots.inject / slots.register 调用的 fake 作用域。 */
function fakeScope() {
  const injected = [] // { key, arrange }
  const registered = [] // { options, component }
  const slots = {
    register(options, component) {
      registered.push({ options, component })
      return () => {}
    },
    inject(key, arrange) {
      const disposer = arrange()
      injected.push({ key, disposer })
      return disposer
    },
  }
  return { injected, registered, slots, ctx: { slots } }
}

describe('registerPlanSeat', () => {
  it('以 priority -100 注册 conversation.input.plan 单席位', () => {
    const hub = fakeScope()
    registerPlanSeat({ ...hub.ctx, remote: { commands: { execute: vi.fn() } } })
    expect(hub.injected).toHaveLength(1)
    expect(hub.injected[0].key).toBe('conversation.input.plan')
    expect(hub.registered).toHaveLength(1)
    expect(hub.registered[0].options.name).toBe('conversation.input.plan')
    expect(hub.registered[0].options.priority).toBe(-100)
    expect(hub.registered[0].component).toBe(PlanButton)
  })

  it('注入面 execute 按会话绑定 remote.commands.execute(sessionId, line, [])', async () => {
    const hub = fakeScope()
    const execute = vi.fn().mockResolvedValue({ ok: true, value: {} })
    registerPlanSeat({ ...hub.ctx, remote: { commands: { execute } } })
    const face = hub.registered[0].options.inject('s7')
    const result = await face.execute('/plan off')
    expect(execute).toHaveBeenCalledWith('s7', '/plan off', [])
    expect(result.ok).toBe(true)
  })
})

describe('registerMenuSeat', () => {
  const controller = {
    pick: vi.fn(), pickCrumb: vi.fn(), hover: vi.fn(), dismiss: vi.fn(),
    menu: { subscribe: vi.fn(), getSnapshot: vi.fn(() => ({ open: false })) },
    headers: { subscribe: vi.fn(), getSnapshot: vi.fn(() => new Map()) },
    launcher: { subscribe: vi.fn(), getSnapshot: vi.fn(() => null) },
  }

  it('以 id slash-menu + priority -100 + order 0 注册 overlay 列表单元', () => {
    const hub = fakeScope()
    const sessions = { scope: vi.fn(() => ({})) }
    const inputTriggers = { sessionOf: vi.fn(() => controller) }
    registerMenuSeat({ ...hub.ctx, sessions, inputTriggers })
    expect(hub.injected).toHaveLength(1)
    expect(hub.injected[0].key).toBe('conversation.input.overlay')
    expect(hub.registered).toHaveLength(1)
    const options = hub.registered[0].options
    expect(options.name).toBe('conversation.input.overlay')
    expect(options.id).toBe('slash-menu')
    expect(options.order).toBe(0)
    expect(options.priority).toBe(-100)
    expect(hub.registered[0].component).toBe(CommandMenu)
  })

  it('注入面按会话解析控制器并暴露快照与既有路由（委托原生控制器）', async () => {
    const hub = fakeScope()
    const actx = { marker: true }
    const sessions = { scope: vi.fn((sid) => { expect(sid).toBe('s9'); return actx }) }
    const inputTriggers = { sessionOf: vi.fn((inCtx) => { expect(inCtx).toBe(actx); return controller }) }
    registerMenuSeat({ ...hub.ctx, sessions, inputTriggers })
    const face = hub.registered[0].options.inject('s9')

    expect(face.menu).toBeDefined()
    expect(face.headers).toBeDefined()
    expect(face.launcher).toBeDefined()
    face.onPick('command', 2)
    face.onPick('command', 3, 'drill')
    face.onHover('command', 1)
    face.onCrumb('command', 0)
    face.onDismiss()
    // 默认动作由原生控制器补全（pick 方法的默认参数），包装层只透传原始索引
    expect(controller.pick).toHaveBeenNthCalledWith(1, 'command', 2)
    expect(controller.pick).toHaveBeenNthCalledWith(2, 'command', 3, 'drill')
    expect(controller.hover).toHaveBeenCalledWith('command', 1)
    expect(controller.pickCrumb).toHaveBeenCalledWith('command', 0)
    expect(controller.dismiss).toHaveBeenCalled()
  })
})

describe('plugin.apply 动态作用域', () => {
  it('注入样式并注册两个独立作用域（分类不阻断 Plan）', async () => {
    const injects = []
    const ctx = {
      effect: vi.fn(fn => fn()),
      inject(services, callback) {
        injects.push({ services, callback })
      },
    }
    await apply(ctx)
    expect(ctx.effect).toHaveBeenCalled()
    expect(injects.map(i => i.services)).toEqual([
      ['slots', 'sessions', 'inputTriggers'],
      ['slots', 'remote', 'remote.commands'],
      ['slots', 'sessions', 'remote'],
    ])
  })

  it('分类作用域缺 inputTriggers 时仅等待；Plan 作用域独立可用', async () => {
    const injects = []
    const ctx = {
      effect: vi.fn(fn => fn()),
      inject(services, callback) {
        injects.push({ services, callback })
      },
    }
    await apply(ctx)

    // 仅 Plan 作用域的服务齐备：立即注册 plan 席位
    const planScope = fakeScope()
    const planCtx = { ...planScope.ctx, remote: { commands: { execute: vi.fn() } } }
    injects.find(i => i.services.includes('remote.commands')).callback(planCtx)
    expect(planScope.registered[0].component).toBe(PlanButton)

    // 菜单作用域的服务齐备后注册 overlay 席位
    const menuScope = fakeScope()
    const controller2 = { pick: vi.fn(), pickCrumb: vi.fn(), hover: vi.fn(), dismiss: vi.fn() }
    const menuCtx = {
      ...menuScope.ctx,
      sessions: { scope: vi.fn(() => ({})) },
      inputTriggers: { sessionOf: vi.fn(() => controller2) },
    }
    injects.find(i => i.services.includes('inputTriggers')).callback(menuCtx)
    expect(menuScope.registered[0].component).toBe(CommandMenu)

    const directionScope = fakeScope()
    const directionCtx = {
      ...directionScope.ctx,
      sessions: { scope: vi.fn(() => ({ get: vi.fn() })) },
      remote: { $mount: vi.fn(() => Promise.resolve()) },
      get: vi.fn(() => ({ adjust: vi.fn() })),
    }
    injects.find(i => i.services.length === 3 && i.services.includes('sessions') && i.services.includes('remote')).callback(directionCtx)
    expect(directionScope.registered[0].component).toBe(DirectionAdjustDock)
  })
})

describe('registerDirectionAdjustSeat', () => {
  it('以独立列表项增强原生队列，不覆盖原按钮', () => {
    const hub = fakeScope()
    registerDirectionAdjustSeat({
      ...hub.ctx,
      sessions: { scope: vi.fn(() => ({ get: vi.fn() })) },
    }, vi.fn())
    expect(hub.registered[0].options).toMatchObject({
      name: 'conversation.input.dock', id: 'direction-adjust', order: 21,
    })
    expect(hub.registered[0].component).toBe(DirectionAdjustDock)
  })
})

describe('组件装配身份', () => {
  it('分类/原生分支与席位组件均为自有导出', () => {
    expect(CategorizedMenu).toBeDefined()
    expect(OriginalMenuView).toBeDefined()
    expect(CommandMenu).toBeDefined()
  })
})
