/**
 * smilexx-input-enhancer 客户端插件主体（2.3.1）
 *
 * 功能清单：
 * - 分类命令菜单   依赖 slots / sessions / inputTriggers；
 * - Plan 按钮      依赖 slots / remote / remote.commands；
 * - 调整方向按钮   依赖 slots / sessions / remote；
 * - 命令归属拦截   依赖 ui-commands 模块存在（缺失时静默跳过，v2.1.0）。
 *
 * 服务缺失时相应作用域保持等待，提供方晚到时自动注册；提供方消失时
 * 作用域清理并自动恢复原生席位（较低 priority 的注册项在同一单元内
 * 覆盖原生默认优先级条目，撤销后原生条目重新生效）。
 */
import { injectStylesOnce } from './style.js'
import { registerMenuSeat } from './menu/menuSeat.js'
import { registerPlanSeat } from './plan/planSeat.js'
import { entryLabelOf, noteCommandOwner, ownerOf, readConfiguredOwners } from './menu/owners.js'
import { DIRECTION_ADJUST_CONTRIBUTION } from './direction/contribution.js'
import { registerDirectionAdjustSeat } from './direction/directionSeat.js'

/**
 * 条目级硬依赖：只有 slots 注册中心。其余服务按功能动态注入。
 * @type {string[]}
 */
export const inject = ['slots']

/** 原型防重复包装标记（HMR 重入安全）。 */
const PATCHED = Symbol.for('smilexx-input-enhancer.commandUi.patched')

/**
 * 经宿主模块系统 require ui-commands 客户端模块（工厂参数 require 由
 * __ModuleLoader__ 注入；esbuild 对外置包保留该 require 调用）。
 * 缺失/异常一律返回 undefined（L1 静默跳过）。
 * @returns {{ CommandUiRuntime?: unknown } | undefined}
 */
function requireUiCommands() {
  try {
    if (typeof require !== 'function') return undefined
    return require('@deepseek-ai/dsh-client-ui-commands/client')
  } catch {
    return undefined
  }
}

/**
 * 安装 L1 命令归属拦截：包装 CommandUiRuntime.prototype.register/decorate，
 * 在调用瞬间从 traceable 代理的 this.ctx 沿 fiber 父链解析调用方插件名。
 * 只观察不改行为：同参数、同 this、原样转发返回值。任何一步失败都静默跳过。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端根上下文。
 */
function installCommandOwnerInterceptor(ctx) {
  try {
    const mod = requireUiCommands()
    const Runtime = mod?.CommandUiRuntime
    if (typeof Runtime !== 'function') return
    const proto = Runtime.prototype
    if (proto === undefined || proto[PATCHED] === true) return
    for (const method of ['register', 'decorate']) {
      const original = proto[method]
      if (typeof original !== 'function') continue
      Object.defineProperty(proto, method, {
        value: function (argument) {
          try {
            const owner = entryLabelOf(this?.ctx)
            const name = typeof argument === 'object' && argument !== null ? argument.name : undefined
            if (typeof name === 'string') noteCommandOwner(name, owner ?? '')
          } catch { /* 归属失败不影响原生注册 */ }
          return original.call(this, argument)
        },
        writable: true,
        configurable: true,
      })
    }
    proto[PATCHED] = true
  } catch { /* ui-commands 缺失或结构变化：跳过 L1，归属回退 L2/L3 */ }
}

/**
 * 客户端插件激活入口。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端根上下文。
 * @param {{ commandOwners?: Record<string, string> }} [_config] - 预留：客户端启动图不传配置。
 */
export async function apply(ctx, _config) {
  ctx.effect(() => injectStylesOnce(), 'smilexx-input-enhancer: 注入样式')

  // L1：先装拦截（晚于我们 apply 的插件命令即可归属），失败不阻塞功能
  installCommandOwnerInterceptor(ctx)

  // L3：用户配置（localStorage JSON，通道与 defaultPlanMode 一致）
  const configOwners = readConfiguredOwners()
  const ownerResolver = (name) => {
    try { return ownerOf(name, { configOwners }) } catch { return null }
  }

  // 功能一：分类命令菜单（slots + sessions + inputTriggers）
  ctx.inject(['slots', 'sessions', 'inputTriggers'], (scope) => {
    registerMenuSeat(scope, { ownerResolver })
  })

  // 功能二：Plan 模式按钮与常驻偏好（slots + remote + remote.commands）
  ctx.inject(['slots', 'remote', 'remote.commands'], (scope) => {
    registerPlanSeat(scope)
  })

  // 功能三：保留原生全部按钮，额外提供可中止当前生成的调整方向。
  ctx.inject(['slots', 'sessions', 'remote'], (scope) => {
    const directionMount = scope.remote.$mount(DIRECTION_ADJUST_CONTRIBUTION)
    registerDirectionAdjustSeat(scope, async (sessionId, itemId) => {
      await directionMount
      const remote = scope.get('remote.directionAdjust')
      if (remote === undefined) throw new Error('调整方向服务不可用')
      const result = await remote.adjust(sessionId, itemId)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    })
  })
}
