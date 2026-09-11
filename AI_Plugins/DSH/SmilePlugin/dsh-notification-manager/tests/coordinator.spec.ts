import { describe, expect, it } from 'vitest'
import { electLeaseLeader, hasFocusedPage } from '../src/client/coordinator.ts'

describe('后备主节点租约', () => {
  it('活跃页面只选出一个主节点', () => {
    const now = 10_000
    const peers = new Map([['b', { focused: false, seenAt: now }], ['c', { focused: true, seenAt: now }]])
    expect(electLeaseLeader('a', peers, now)).toBe(true)
    expect(electLeaseLeader('d', peers, now)).toBe(false)
  })

  it('主节点过期后由存活页面接管', () => {
    const now = 20_000
    const peers = new Map([['a', { focused: false, seenAt: 1 }]])
    expect(electLeaseLeader('b', peers, now)).toBe(true)
  })

  it('任一活跃页面聚焦时均视为 DSH 正在使用', () => {
    const now = 30_000
    expect(hasFocusedPage(false, new Map([['b', { focused: true, seenAt: now }]]), now)).toBe(true)
    expect(hasFocusedPage(false, new Map([['b', { focused: true, seenAt: 1 }]]), now)).toBe(false)
    expect(hasFocusedPage(true, new Map(), now)).toBe(true)
  })
})
