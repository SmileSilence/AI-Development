/**
 * M4 批量执行语义单测：归档/删除的顺序、幂等、部分失败不阻断。
 * 提取为纯函数以便测试（WorkspaceBrowser 内的内联实现此处复刻语义）。
 */
import { describe, expect, it } from 'vitest'

/** 按顺序执行归档，失败计入但继续；返回 { ok, failed }。 */
async function runArchives(ids: string[], archive: (id: string) => Promise<void>): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  for (const id of ids) {
    try { await archive(id); ok += 1 } catch { failed += 1 }
  }
  return { ok, failed }
}

/** 删除工作区：先归档其全部会话（失败不阻断注册删除），再删除注册。 */
async function runDeleteWorkspaces(
  workspaceIds: string[],
  lookup: (id: string) => { sessionIds: string[] } | undefined,
  archive: (id: string) => Promise<void>,
  remove: (id: string) => Promise<void>,
): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  for (const workspaceId of workspaceIds) {
    try {
      const target = lookup(workspaceId)
      if (target !== undefined) {
        for (const sessionId of target.sessionIds) {
          try { await archive(sessionId) } catch { /* 会话归档失败不阻断删除注册 */ }
        }
      }
      await remove(workspaceId)
      ok += 1
    } catch { failed += 1 }
  }
  return { ok, failed }
}

describe('批量归档会话', () => {
  it('顺序执行全部归档', async () => {
    const order: string[] = []
    const result = await runArchives(['a', 'b', 'c'], async id => { order.push(id) })
    expect(result).toEqual({ ok: 3, failed: 0 })
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('单个失败继续其余', async () => {
    const result = await runArchives(['a', 'b', 'c'], async id => {
      if (id === 'b') throw new Error('boom')
    })
    expect(result).toEqual({ ok: 2, failed: 1 })
  })

  it('空集合为 no-op', async () => {
    const result = await runArchives([], async () => { throw new Error('never') })
    expect(result).toEqual({ ok: 0, failed: 0 })
  })
})

describe('批量删除工作区', () => {
  it('先归档全部会话再删除注册', async () => {
    const archived: string[] = []
    const removed: string[] = []
    const ws = {
      w1: { sessionIds: ['s1', 's2'] },
      w2: { sessionIds: [] },
    }
    const result = await runDeleteWorkspaces(
      ['w1', 'w2'],
      id => ws[id],
      async id => { archived.push(id) },
      async id => { removed.push(id) },
    )
    expect(result).toEqual({ ok: 2, failed: 0 })
    expect(archived).toEqual(['s1', 's2'])
    expect(removed).toEqual(['w1', 'w2'])
  })

  it('会话归档失败不阻断工作区删除', async () => {
    const removed: string[] = []
    const result = await runDeleteWorkspaces(
      ['w1'],
      () => ({ sessionIds: ['s1'] }),
      async () => { throw new Error('archive failed') },
      async id => { removed.push(id) },
    )
    expect(result).toEqual({ ok: 1, failed: 0 })
    expect(removed).toEqual(['w1'])
  })

  it('删除注册失败计入 failed', async () => {
    const result = await runDeleteWorkspaces(
      ['w1'],
      () => ({ sessionIds: [] }),
      async () => {},
      async () => { throw new Error('remove failed') },
    )
    expect(result).toEqual({ ok: 0, failed: 1 })
  })
})
