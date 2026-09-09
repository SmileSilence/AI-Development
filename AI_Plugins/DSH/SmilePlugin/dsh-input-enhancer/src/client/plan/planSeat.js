/**
 * Plan 席位注册：单实例会话级席位 conversation.input.plan。
 * - priority: -100 覆盖原生 PlanChip（默认优先级 0）；
 * - 注入面提供按会话绑定的命令执行闭包，命令行只取 '/plan' 与 '/plan off'。
 */
import { PlanButton } from './PlanButton.jsx'

/**
 * 注册 Plan 席位（在动态注入作用域内调用）。
 * @param {import('@deepseek-ai/cordis').Context} scope - 已含 slots/remote/remote.commands 的作用域。
 */
export function registerPlanSeat(scope) {
  scope.slots.inject('conversation.input.plan', () => scope.slots.register({
    name: 'conversation.input.plan',
    priority: -100,
    /**
     * 会话级注入面：复用原生 push 语义（仅 /plan 与 /plan off）。
     * @param {import('@deepseek-ai/dsh-session/types').SessionId} sessionId - 当前会话。
     */
    inject: (sessionId) => ({
      execute: (line) => scope.remote.commands.execute(sessionId, line, []),
    }),
  }, PlanButton))
}
