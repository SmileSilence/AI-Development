import { DirectionAdjustDock } from './DirectionAdjustDock.jsx'

/** 注册仅负责增强原生 QueueDock 的会话级控制器。 */
export function registerDirectionAdjustSeat(scope, callAdjust) {
  scope.slots.inject('conversation.input.dock', () => scope.slots.register({
    name: 'conversation.input.dock',
    id: 'direction-adjust',
    order: 21,
    inject: sessionId => {
      const actx = scope.sessions.scope(sessionId)
      const conversation = actx?.get?.('conversation') ?? actx?.conversation
      return {
        adjustDirection: itemId => callAdjust(sessionId, itemId),
        notify: (level, message) => { conversation?.input?.for(actx)?.notify(level, message) },
      }
    },
  }, DirectionAdjustDock))
}
