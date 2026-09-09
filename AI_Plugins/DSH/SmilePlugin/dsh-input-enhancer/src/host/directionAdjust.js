import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

const stringSchema = {
  parse(value) {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError('必须是非空字符串')
    return value
  },
}
const resultSchema = {
  parse(value) {
    if (value?.accepted !== true) throw new TypeError('调整方向结果无效')
    return value
  },
}
const codec = (typeSymbol, schema) => ({ mode: 'strict', typeSymbol, schema })

export const DIRECTION_ADJUST_MANIFEST = {
  package: 'dsh-input-enhancer',
  face: 'host',
  schemas: [],
  invocations: [{
    id: 'dsh-input-enhancer#directionAdjust/adjust',
    service: 'directionAdjust',
    namespace: 'directionAdjust',
    method: 'adjust',
    invocation: { kind: 'direct' },
    parameters: [
      { name: 'sessionId', wire: 'sessionId', source: 'json', codec: codec('dsh-input-enhancer#SessionId', stringSchema) },
      { name: 'itemId', wire: 'itemId', source: 'json', codec: codec('dsh-input-enhancer#MessageId', stringSchema) },
    ],
    result: codec('dsh-input-enhancer#DirectionAdjustResult', resultSchema),
  }],
  model: { services: [], events: [], objects: [] },
}

/** 调整方向宿主服务：终止当前活动步骤，并以所选排队消息唤醒后继轮次。 */
export class DirectionAdjustGateway extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'directionAdjust')
  }

  adjust(sessionId, itemId) {
    const agent = this.ctx.agents.get(sessionId)
    return adjustDirection(agent, itemId)
  }
}

/** 执行可独立测试的调整方向事务。 */
export function adjustDirection(agent, itemId) {
    if (agent === undefined) throw new Error('会话不存在或尚未连接')
    if (agent.status !== 'running') throw new Error('当前会话不在运行中')

    const message = agent.inbox.nextTurn.find(candidate => candidate.id === itemId)
    if (message === undefined) throw new Error('排队消息已开始处理或不存在')
    if (!agent.inbox.remove(message.id)) throw new Error('无法锁定排队消息')

    try {
      agent.cancel({ kind: 'user' }, { keepInbox: true })
      // 活动已收到取消信号，followup 会把唤醒锁存到活动收敛之后。
      agent.followup(message)
      const index = agent.inbox.nextTurn.findIndex(candidate => candidate.id === message.id)
      if (index > 0) {
        agent.inbox.splice('next-turn', index, 1, [])
        agent.inbox.splice('next-turn', 0, 0, [message])
      }
    } catch (error) {
      if (!agent.inbox.nextTurn.some(candidate => candidate.id === message.id)) {
        agent.inbox.splice('next-turn', 0, 0, [message])
      }
      throw error
    }
    return { accepted: true }
}
