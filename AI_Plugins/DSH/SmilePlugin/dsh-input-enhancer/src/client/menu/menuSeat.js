/**
 * 命令菜单席位注册：列表席位 conversation.input.overlay 中的 slash-menu 单元。
 *
 * - id 取原生 slash-menu，priority: -100 覆盖原生 MenuView（默认优先级 0）；
 * - 注入面提供菜单/面包屑/启动器快照与 pick/hover/dismiss 路由（全部走原生控制器）；
 * - 数据直接来自原生控制器的候选快照（含宿主与客户端插件贡献），不另建不完整目录。
 */
import { CommandMenu } from './CommandMenu.jsx'

/**
 * 注册命令菜单席位（在动态注入作用域内调用）。
 * @param {import('@deepseek-ai/cordis').Context} scope - 已含 slots/sessions/inputTriggers 的作用域。
 * @param {{ ownerResolver?: (name: string) => string | null }} [owners] - 命令归属解析（v2.1.0）。
 */
export function registerMenuSeat(scope, owners = {}) {
  const inputTriggers = scope.inputTriggers
  const sessions = scope.sessions

  scope.slots.inject('conversation.input.overlay', () => scope.slots.register({
    name: 'conversation.input.overlay',
    id: 'slash-menu',
    order: 0,
    priority: -100,
    /**
     * 会话级注入面：解析本会话控制器，向组件暴露只读快照与既有路由方法。
     * @param {import('@deepseek-ai/dsh-session/types').SessionId} sessionId - 当前会话。
     */
    inject: (sessionId) => {
      const actx = sessions.scope(sessionId)
      if (actx === undefined) {
        throw new Error(`smilexx-input-enhancer: 会话 "${String(sessionId)}" 解析不到 scope`)
      }
      const controller = inputTriggers.sessionOf(actx)
      return {
        menu: controller.menu,
        headers: controller.headers,
        launcher: controller.launcher,
        // 默认动作（pick）由原生控制器补全：省略 action 参数时不再透传 undefined
        onPick: (source, index, action) => {
          if (action === undefined) controller.pick(source, index)
          else controller.pick(source, index, action)
        },
        onCrumb: (source, index) => { controller.pickCrumb(source, index) },
        onHover: (source, index) => { controller.hover(source, index) },
        onDismiss: () => { controller.dismiss() },
        // 命令归属解析（v2.1.0）：经注入面 props 传入组件
        ownerResolver: owners.ownerResolver,
      }
    },
  }, CommandMenu))
}