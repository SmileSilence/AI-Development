import { describe, expect, it, vi } from 'vitest'
import { adjustDirection } from '../host/directionAdjust.js'

function fakeAgent(messages) {
  const nextTurn = [...messages]
  const inbox = {
    nextTurn,
    remove(id) {
      const index = nextTurn.findIndex(message => message.id === id)
      if (index < 0) return false
      nextTurn.splice(index, 1)
      return true
    },
    splice(_target, start, count, inserted) {
      nextTurn.splice(start, count, ...inserted)
    },
  }
  const agent = {
    status: 'running', inbox,
    cancel: vi.fn(),
    followup: vi.fn(message => { nextTurn.push(message) }),
  }
  return agent
}

describe('adjustDirection', () => {
  it('取消当前活动、保留队列并把所选消息移到队首', () => {
    const first = { id: 'a' }
    const selected = { id: 'b' }
    const agent = fakeAgent([first, selected])
    expect(adjustDirection(agent, 'b')).toEqual({ accepted: true })
    expect(agent.cancel).toHaveBeenCalledWith({ kind: 'user' }, { keepInbox: true })
    expect(agent.followup).toHaveBeenCalledWith(selected)
    expect(agent.inbox.nextTurn).toEqual([selected, first])
  })

  it('拒绝空闲会话和已不存在的排队消息', () => {
    const idle = fakeAgent([{ id: 'a' }])
    idle.status = 'idle'
    expect(() => adjustDirection(idle, 'a')).toThrow('不在运行中')
    expect(() => adjustDirection(fakeAgent([]), 'missing')).toThrow('不存在')
  })
})
