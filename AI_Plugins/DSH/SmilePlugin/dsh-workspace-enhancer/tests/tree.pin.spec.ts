/**
 * 插件增强（置顶）排序单测：deriveGroups 工作区置顶排前 + deriveFlat 会话置顶排前。
 * 使用最小构造的 SessionListState / WorkspaceView / SessionSummary，不依赖浏览器。
 */
import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveFlat, deriveGroups } from '../src/client/tree.ts'

const id = (s: string) => s as SessionId

function summary(over: Partial<SessionSummary> & { id: SessionId; updatedAt: number }): SessionSummary {
  return {
    displayTitle: over.id,
    running: false,
    blank: false,
    updatedAt: over.updatedAt,
    ...over,
  }
}

function listState(sessions: SessionSummary[], current?: SessionId): SessionListState {
  const byId: Record<SessionId, SessionSummary> = {}
  for (const s of sessions) byId[s.id] = s
  return {
    ids: sessions.map(s => s.id),
    byId,
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function workspace(workspaceId: string, path: string, sessionIds: SessionId[]): WorkspaceView {
  return {
    workspaceId: workspaceId as WorkspaceView['workspaceId'],
    path,
    title: workspaceId,
    sessionIds,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

describe('deriveGroups 置顶工作区排前', () => {
  it('悬停总数去重且排除空白、归档、子代理和缺失会话，不受折叠影响', () => {
    const sessions = [
      summary({ id: id('main'), updatedAt: 100, running: true }),
      summary({ id: id('blank'), updatedAt: 90, blank: true }),
      summary({ id: id('archive'), updatedAt: 80, running: true }),
      summary({ id: id('child'), updatedAt: 70, origin: 'subagent' }),
    ]
    const workspaces = [workspace('w', 'C:/w', [id('main'), id('main'), id('blank'), id('archive'), id('child'), id('missing')]), workspace('empty', 'C:/empty', [])]
    for (const expandedGroups of [[], ['w']]) {
      const groups = deriveGroups(listState(sessions, id('blank')), workspaces, [id('archive')], new Map(), { expandedGroups })
      expect(groups.find(g => g.key === 'w')?.totalSessionCount).toBe(1)
      expect(groups.find(g => g.key === 'w')?.runningSessionCount).toBe(1)
      expect(groups.find(g => g.key === 'empty')?.totalSessionCount).toBe(0)
    }
  })

  it('置顶工作区排在最前，且组内相对顺序保持稳定', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 300 }),
      summary({ id: id('s2'), updatedAt: 200 }),
      summary({ id: id('s3'), updatedAt: 100 }),
      summary({ id: id('s4'), updatedAt: 400 }),
    ]
    const workspaces = [
      workspace('w-a', 'C:/a', [id('s1')]),
      workspace('w-b', 'C:/b', [id('s2')]),
      workspace('w-c', 'C:/c', [id('s3')]),
      workspace('w-d', 'C:/d', [id('s4')]),
    ]
    // 置顶 w-c 和 w-a（乱序指定），w-a 组内顺序在 w-c 前。
    const groups = deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: [] }, ['w-c', 'w-a'])
    const keys = groups.map(g => g.key)
    // 置顶组（w-a、w-c）在前（按原 Host 顺序 w-a 先于 w-c），非置顶随后。
    expect(keys[0]).toBe('w-a')
    expect(keys[1]).toBe('w-c')
    expect(keys.slice(2).sort()).toEqual(['w-b', 'w-d'])
    expect(groups.find(g => g.key === 'w-a')?.pinned).toBe(true)
    expect(groups.find(g => g.key === 'w-c')?.pinned).toBe(true)
    expect(groups.find(g => g.key === 'w-b')?.pinned).toBe(false)
  })

  it('无置顶时保持原 Host 顺序', () => {
    const sessions = [summary({ id: id('s1'), updatedAt: 100 })]
    const workspaces = [workspace('w-a', 'C:/a', [id('s1')]), workspace('w-b', 'C:/b', [])]
    const groups = deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: [] }, [])
    expect(groups.map(g => g.key)).toEqual(['w-a', 'w-b'])
  })
})

describe('deriveFlat 置顶会话排前', () => {
  it('置顶会话排在最前，内部仍按最近更新排序', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 300 }),
      summary({ id: id('s2'), updatedAt: 200 }),
      summary({ id: id('s3'), updatedAt: 100 }),
      summary({ id: id('s4'), updatedAt: 400 }),
    ]
    // 置顶 s3、s1：置顶组按最近更新 s1(300) 在 s3(100) 前，随后非置顶按更新时间 s4(400)、s2(200)。
    const rows = deriveFlat(listState(sessions), [], new Map(), ['s3', 's1'])
    expect(rows.map(r => r.id)).toEqual([id('s1'), id('s3'), id('s4'), id('s2')])
    expect(rows.find(r => r.id === id('s3'))?.pinned).toBe(true)
    expect(rows.find(r => r.id === id('s4'))?.pinned).toBe(false)
  })

  it('无置顶时保持最近更新排序', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 300 }),
      summary({ id: id('s2'), updatedAt: 400 }),
    ]
    const rows = deriveFlat(listState(sessions), [], new Map(), [])
    expect(rows.map(r => r.id)).toEqual([id('s2'), id('s1')])
  })
})

describe('运行中自动置顶（任务 B 扩展2/3）', () => {
  it('组内运行中会话自动置顶（按最近更新，其余保持原顺序）', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 100 }),
      summary({ id: id('s2'), updatedAt: 200, running: true }),
      summary({ id: id('s3'), updatedAt: 300 }),
      summary({ id: id('s4'), updatedAt: 400, running: true }),
    ]
    const workspaces = [workspace('w-a', 'C:/a', [id('s1'), id('s2'), id('s3'), id('s4')])]
    const groups = deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: ['w-a'] })
    const g = groups[0]
    // 运行中 s4(400) 在前、s2(200) 随后；非运行保持原顺序 s1、s3。
    expect(g.sessions.map(s => s.id)).toEqual([id('s4'), id('s2'), id('s1'), id('s3')])
    expect(g.runningSessionCount).toBe(2)
    // 折叠组：sessions 为空但计数仍可用（任务 B 扩展1 的计数来源）。
    const folded = deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: [] })
    expect(folded[0].sessions).toEqual([])
    expect(folded[0].runningSessionCount).toBe(2)
  })

  it('有运行中会话的工作区自动置顶，高于手动置顶；结束后还原', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 100 }),
      summary({ id: id('s2'), updatedAt: 200, running: true }),
      summary({ id: id('s3'), updatedAt: 300 }),
      summary({ id: id('s4'), updatedAt: 400 }),
    ]
    const workspaces = [
      workspace('w-a', 'C:/a', [id('s1')]),
      workspace('w-b', 'C:/b', [id('s2')]),
      workspace('w-c', 'C:/c', [id('s3')]),
      workspace('w-d', 'C:/d', [id('s4')]),
    ]
    // 手动置顶 w-c；但 w-b 有运行中会话 → w-b 应排在最上层，随后 w-c，其余原序。
    const groups = deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: [] }, ['w-c'])
    expect(groups.map(g => g.key)).toEqual(['w-b', 'w-c', 'w-a', 'w-d'])
    // 会话结束后（running=false）自动置顶取消，还原为：置顶 w-c → w-a、w-b、w-d 原序。
    const idle = [
      summary({ id: id('s1'), updatedAt: 100 }),
      summary({ id: id('s2'), updatedAt: 200 }),
      summary({ id: id('s3'), updatedAt: 300 }),
      summary({ id: id('s4'), updatedAt: 400 }),
    ]
    const restored = deriveGroups(listState(idle), workspaces, [], new Map(), { expandedGroups: [] }, ['w-c'])
    expect(restored.map(g => g.key)).toEqual(['w-c', 'w-a', 'w-b', 'w-d'])
  })

  it('单列视图：运行中会话自动置顶（按最近更新）', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 400 }),
      summary({ id: id('s2'), updatedAt: 300, running: true }),
      summary({ id: id('s3'), updatedAt: 200 }),
      summary({ id: id('s4'), updatedAt: 100, running: true }),
    ]
    const rows = deriveFlat(listState(sessions), [], new Map(), [])
    expect(rows.map(r => r.id)).toEqual([id('s2'), id('s4'), id('s1'), id('s3')])
  })

  it('运行中会话排在手动置顶会话之前（自动置顶最上层）', () => {
    const sessions = [
      summary({ id: id('s1'), updatedAt: 100, running: true }),
      summary({ id: id('s2'), updatedAt: 200 }),
      summary({ id: id('s3'), updatedAt: 300 }),
    ]
    const rows = deriveFlat(listState(sessions), [], new Map(), ['s2'])
    expect(rows.map(r => r.id)).toEqual([id('s1'), id('s2'), id('s3')])
  })
})
