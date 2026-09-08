/**
 * dsh-workspace-enhancer — 标签筛选（v0.5.0 飞书式 7 种操作符）单元测试。
 * 覆盖：tagFilterMatches 单条件行（equals/notEquals/contains/notContains/
 * containsAll/isEmpty/isNotEmpty + 无标签 + 空标签）、migrateRuleCondition
 * 操作符切换状态迁移（单选截断 / 无值清空）、applyTagFilterToGroups 多规则
 * AND（范围隔离、行间 AND、运行标签覆盖折叠）、isTagFilterInactive 空筛选判定。
 */
import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TagDefinition, WorkspaceTaggerSettings } from '../src/client/tags/settings-types.ts'
import {
  applyTagFilterToGroups,
  deriveGroups,
  isNoValueCondition,
  isSingleSelectCondition,
  isTagFilterInactive,
  migrateRuleCondition,
  tagFilterMatches,
  tagFilterRuleActive,
  type TagFilter,
  type TagFilterRule,
} from '../src/client/tree.ts'

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

function workspace(workspaceId: string, sessionIds: SessionId[]): WorkspaceView {
  return {
    workspaceId: workspaceId as WorkspaceView['workspaceId'],
    path: `C:/${workspaceId}`,
    title: workspaceId,
    sessionIds,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

const tag = (tId: string, name: string): TagDefinition => ({ id: tId, name, color: '#4f7cff' })

function settings(patch: Partial<WorkspaceTaggerSettings> = {}): WorkspaceTaggerSettings {
  return {
    tags: [tag('tag-1', '设计'), tag('tag-2', '开发'), tag('tag-3', '运行中')],
    workspaceTags: { 'w-1': 'tag-1', 'w-2': 'tag-2' },
    sessionTags: { 's1': 'tag-1', 's2': 'tag-2' },
    runningTagId: null,
    splitRatio: 0.35,
    customColors: [],
    ...patch,
  }
}

/** 一条条件行（默认：全部范围 / 包含 / tag-1）。 */
let ruleSeq = 0
const rule = (patch: Partial<Omit<TagFilterRule, 'id'>> = {}): TagFilterRule => {
  ruleSeq += 1
  return { id: `r${ruleSeq}`, scope: 'all', condition: 'contains', tagIds: ['tag-1'], ...patch }
}

/** 多条件筛选器（默认启用，含一条默认规则）。 */
const filter = (rules: readonly TagFilterRule[] = [rule()], enabled = true): TagFilter => ({ enabled, rules })

describe('操作符分类辅助函数', () => {
  it('单选操作符只有 equals / notEquals', () => {
    expect(isSingleSelectCondition('equals')).toBe(true)
    expect(isSingleSelectCondition('notEquals')).toBe(true)
    expect(isSingleSelectCondition('contains')).toBe(false)
    expect(isSingleSelectCondition('notContains')).toBe(false)
    expect(isSingleSelectCondition('containsAll')).toBe(false)
    expect(isSingleSelectCondition('isEmpty')).toBe(false)
    expect(isSingleSelectCondition('isNotEmpty')).toBe(false)
  })

  it('无值操作符只有 isEmpty / isNotEmpty', () => {
    expect(isNoValueCondition('isEmpty')).toBe(true)
    expect(isNoValueCondition('isNotEmpty')).toBe(true)
    expect(isNoValueCondition('equals')).toBe(false)
    expect(isNoValueCondition('contains')).toBe(false)
    expect(isNoValueCondition('containsAll')).toBe(false)
  })
})

describe('tagFilterMatches（单条件行匹配，7 种操作符）', () => {
  it('equals 等于：精确命中单个指定标签；无标签不匹配', () => {
    const eq = rule({ condition: 'equals' })
    expect(tagFilterMatches(eq, 'tag-1')).toBe(true)
    expect(tagFilterMatches(eq, 'tag-2')).toBe(false)
    expect(tagFilterMatches(eq, undefined)).toBe(false)
  })

  it('notEquals 不等于：不等于指定标签即匹配，含无标签（语义约定）', () => {
    const ne = rule({ condition: 'notEquals' })
    expect(tagFilterMatches(ne, 'tag-2')).toBe(true)
    expect(tagFilterMatches(ne, 'tag-1')).toBe(false)
    // 无标签 ≠ 选中标签 → 匹配 true。
    expect(tagFilterMatches(ne, undefined)).toBe(true)
  })

  it('contains 包含任一：命中任一选中标签；无标签不匹配', () => {
    expect(tagFilterMatches(rule(), 'tag-1')).toBe(true)
    expect(tagFilterMatches(rule(), 'tag-2')).toBe(false)
    expect(tagFilterMatches(rule(), undefined)).toBe(false)
    expect(tagFilterMatches(rule({ tagIds: ['tag-1', 'tag-2'] }), 'tag-2')).toBe(true)
    expect(tagFilterMatches(rule({ tagIds: ['tag-1', 'tag-2'] }), 'tag-3')).toBe(false)
  })

  it('notContains 不包含：不命中任一选中标签即匹配，含无标签（语义约定）', () => {
    const nc = rule({ condition: 'notContains', tagIds: ['tag-1', 'tag-2'] })
    expect(tagFilterMatches(nc, 'tag-3')).toBe(true)
    expect(tagFilterMatches(nc, 'tag-1')).toBe(false)
    expect(tagFilterMatches(nc, 'tag-2')).toBe(false)
    // 无标签不命中任一选中 → 匹配 true。
    expect(tagFilterMatches(nc, undefined)).toBe(true)
  })

  it('containsAll 包含全部：生效标签是单个，须同时等于每个选中（多选恒不匹配）', () => {
    // 单选集：等于该标签即命中（= equals）。
    const all = rule({ condition: 'containsAll' })
    expect(tagFilterMatches(all, 'tag-1')).toBe(true)
    expect(tagFilterMatches(all, 'tag-2')).toBe(false)
    expect(tagFilterMatches(all, undefined)).toBe(false)
    // 多选集：单个生效标签无法同时等于多个标签 → 恒不匹配。
    expect(tagFilterMatches(rule({ condition: 'containsAll', tagIds: ['tag-1', 'tag-2'] }), 'tag-1')).toBe(false)
    expect(tagFilterMatches(rule({ condition: 'containsAll', tagIds: ['tag-1', 'tag-2'] }), undefined)).toBe(false)
  })

  it('isEmpty 为空：无标签匹配', () => {
    const empty = rule({ condition: 'isEmpty', tagIds: [] })
    expect(tagFilterMatches(empty, undefined)).toBe(true)
    expect(tagFilterMatches(empty, 'tag-1')).toBe(false)
  })

  it('isNotEmpty 不为空：有任意标签匹配', () => {
    const notEmpty = rule({ condition: 'isNotEmpty', tagIds: [] })
    expect(tagFilterMatches(notEmpty, 'tag-1')).toBe(true)
    expect(tagFilterMatches(notEmpty, undefined)).toBe(false)
  })

  it('空标签行恒匹配（有值操作符未选标签 = 不筛选）', () => {
    expect(tagFilterMatches(rule({ tagIds: [] }), 'anything')).toBe(true)
    expect(tagFilterMatches(rule({ tagIds: [] }), undefined)).toBe(true)
    expect(tagFilterMatches(rule({ condition: 'notEquals', tagIds: [] }), 'anything')).toBe(true)
    expect(tagFilterMatches(rule({ condition: 'containsAll', tagIds: [] }), undefined)).toBe(true)
  })
})

describe('migrateRuleCondition（切换操作符状态迁移）', () => {
  it('多选 → 单选（equals/notEquals）：截断为第一个', () => {
    const multi = rule({ tagIds: ['tag-1', 'tag-2'] })
    expect(migrateRuleCondition(multi, 'equals').tagIds).toEqual(['tag-1'])
    expect(migrateRuleCondition(multi, 'notEquals').tagIds).toEqual(['tag-1'])
    expect(migrateRuleCondition(multi, 'equals').condition).toBe('equals')
    expect(migrateRuleCondition(multi, 'notEquals').condition).toBe('notEquals')
  })

  it('有值 → 无值（isEmpty/isNotEmpty）：清空 tagIds', () => {
    const multi = rule({ tagIds: ['tag-1', 'tag-2'] })
    expect(migrateRuleCondition(multi, 'isEmpty').tagIds).toEqual([])
    expect(migrateRuleCondition(multi, 'isEmpty').condition).toBe('isEmpty')
    expect(migrateRuleCondition(multi, 'isNotEmpty').tagIds).toEqual([])
    expect(migrateRuleCondition(multi, 'isNotEmpty').condition).toBe('isNotEmpty')
  })

  it('单选 ↔ 单选：保留唯一选中', () => {
    const single = rule({ condition: 'equals', tagIds: ['tag-1'] })
    const next = migrateRuleCondition(single, 'notEquals')
    expect(next.condition).toBe('notEquals')
    expect(next.tagIds).toEqual(['tag-1'])
  })

  it('无值 → 有值：tagIds 保持空（用户重新选择）', () => {
    const noValue = rule({ condition: 'isEmpty', tagIds: [] })
    const next = migrateRuleCondition(noValue, 'contains')
    expect(next.condition).toBe('contains')
    expect(next.tagIds).toEqual([])
  })

  it('多选 ↔ 多选（contains/notContains/containsAll）：保留全部选中', () => {
    const multi = rule({ tagIds: ['tag-1', 'tag-2'] })
    expect(migrateRuleCondition(multi, 'notContains').tagIds).toEqual(['tag-1', 'tag-2'])
    expect(migrateRuleCondition(multi, 'containsAll').tagIds).toEqual(['tag-1', 'tag-2'])
    expect(migrateRuleCondition(multi, 'contains').tagIds).toEqual(['tag-1', 'tag-2'])
  })

  it('单选标签替换语义：UI 层选新替换旧（tagIds 恒 0 或 1 个）', () => {
    const single = rule({ condition: 'equals', tagIds: ['tag-1'] })
    // 单选时选新标签 → 替换为 [tag-2]（不追加）。
    const next = migrateRuleCondition(single, 'equals')
    expect(next.tagIds).toEqual(['tag-1'])
    expect(next.tagIds.length).toBeLessThanOrEqual(1)
  })
})

describe('tagFilterRuleActive / isTagFilterInactive（空筛选判定）', () => {
  it('无值操作符即使未选标签也视为有效规则', () => {
    expect(tagFilterRuleActive(rule({ condition: 'isEmpty', tagIds: [] }))).toBe(true)
    expect(tagFilterRuleActive(rule({ condition: 'isNotEmpty', tagIds: [] }))).toBe(true)
    expect(tagFilterRuleActive(rule({ tagIds: [] }))).toBe(false)
    expect(tagFilterRuleActive(rule({ tagIds: ['tag-1'] }))).toBe(true)
  })

  it('未启用或无规则 → 整体不过滤；isEmpty 规则算生效筛选', () => {
    expect(isTagFilterInactive(filter([], false))).toBe(true)
    expect(isTagFilterInactive(filter([], true))).toBe(true)
    expect(isTagFilterInactive(filter([rule()]))).toBe(false)
    expect(isTagFilterInactive(filter([rule({ tagIds: [] }), rule({ tagIds: [] })]))).toBe(true)
    // 无值操作符：规则虽无 tagIds 但仍是生效筛选。
    expect(isTagFilterInactive(filter([rule({ condition: 'isEmpty', tagIds: [] })]))).toBe(false)
    expect(isTagFilterInactive(filter([rule({ condition: 'isNotEmpty', tagIds: [] })]))).toBe(false)
  })
})

describe('applyTagFilterToGroups（范围过滤 + 多规则 AND）', () => {
  const sessions = [
    summary({ id: id('s1'), updatedAt: 100 }), // 工作区 w-1，会话标签 tag-1
    summary({ id: id('s2'), updatedAt: 200 }), // 工作区 w-1，会话标签 tag-2
    summary({ id: id('s3'), updatedAt: 300 }), // 工作区 w-2，无会话标签
  ]
  const workspaces = [
    workspace('w-1', [id('s1'), id('s2')]),
    workspace('w-2', [id('s3')]),
  ]
  const base = (): ReturnType<typeof deriveGroups> =>
    deriveGroups(listState(sessions), workspaces, [], new Map(), { expandedGroups: ['w-1', 'w-2'] })

  it('范围=全部：工作区与会话同时按生效标签过滤', () => {
    const groups = applyTagFilterToGroups(base(), settings(), filter([rule({ tagIds: ['tag-1'] })]))
    // w-1（tag-1）保留，其会话仅 s1（tag-1）；w-2（tag-2）被隐藏。
    expect(groups.map(g => g.key)).toEqual(['w-1'])
    expect(groups[0].sessions.map(s => s.id)).toEqual([id('s1')])
  })

  it('范围=工作区：仅过滤工作区行，会话全部保留', () => {
    const groups = applyTagFilterToGroups(base(), settings(), filter([rule({ scope: 'workspace', tagIds: ['tag-2'] })]))
    expect(groups.map(g => g.key)).toEqual(['w-2'])
    expect(groups[0].sessions.map(s => s.id)).toEqual([id('s3')])
  })

  it('范围=会话：工作区全部保留，仅过滤会话行', () => {
    const groups = applyTagFilterToGroups(base(), settings(), filter([rule({ scope: 'session', tagIds: ['tag-2'] })]))
    expect(groups.map(g => g.key)).toEqual(['w-1', 'w-2'])
    expect(groups[0].sessions.map(s => s.id)).toEqual([id('s2')])
    expect(groups[1].sessions.map(s => s.id)).toEqual([])
  })

  it('isEmpty 操作符：筛选出无标签行（会话范围）', () => {
    const groups = applyTagFilterToGroups(
      base(), settings(),
      filter([rule({ scope: 'session', condition: 'isEmpty', tagIds: [] })]),
    )
    // s3 无会话标签 → 保留；s1/s2 有标签 → 淘汰。
    expect(groups.flatMap(g => g.sessions.map(s => s.id))).toEqual([id('s3')])
  })

  it('isNotEmpty 操作符：筛选出有标签行（会话范围）', () => {
    const groups = applyTagFilterToGroups(
      base(), settings(),
      filter([rule({ scope: 'session', condition: 'isNotEmpty', tagIds: [] })]),
    )
    expect(groups.flatMap(g => g.sessions.map(s => s.id))).toEqual([id('s1'), id('s2')])
  })

  it('多条件行 AND：同一范围的两条规则都须命中', () => {
    // 工作区范围两条规则：tag-1 且 tag-2 → 无工作区同时满足 → 全隐藏。
    const groups = applyTagFilterToGroups(
      base(), settings(),
      filter([
        rule({ scope: 'workspace', tagIds: ['tag-1'] }),
        rule({ scope: 'workspace', tagIds: ['tag-2'] }),
      ]),
    )
    expect(groups.map(g => g.key)).toEqual([])
  })

  it('多条件行 AND：会话范围两条规则都须命中', () => {
    // 会话范围两条规则：tag-1 且 tag-2 → 无会话同时满足 → 会话行全空但工作区保留。
    const groups = applyTagFilterToGroups(
      base(), settings(),
      filter([
        rule({ scope: 'session', tagIds: ['tag-1'] }),
        rule({ scope: 'session', tagIds: ['tag-2'] }),
      ]),
    )
    expect(groups.map(g => g.key)).toEqual(['w-1', 'w-2'])
    expect(groups.flatMap(g => g.sessions)).toEqual([])
  })

  it('多条件行 AND + 范围隔离：工作区规则只筛工作区，会话规则只筛会话', () => {
    // 规则A（工作区范围，tag-1）→ 保留 w-1、淘汰 w-2；
    // 规则B（会话范围，tag-2）→ w-1 内仅 s2 保留。
    const groups = applyTagFilterToGroups(
      base(), settings(),
      filter([
        rule({ scope: 'workspace', tagIds: ['tag-1'] }),
        rule({ scope: 'session', tagIds: ['tag-2'] }),
      ]),
    )
    expect(groups.map(g => g.key)).toEqual(['w-1'])
    expect(groups[0].sessions.map(s => s.id)).toEqual([id('s2')])
  })

  it('折叠工作区按运行标签匹配（运行覆盖规则）', () => {
    const running = settings({ runningTagId: 'tag-3' })
    const groups = applyTagFilterToGroups(
      deriveGroups(listState([summary({ id: id('s1'), updatedAt: 100, running: true })], id('s1')),
        [workspace('w-1', [id('s1')])], [], new Map(), { expandedGroups: [] }),
      running,
      filter([rule({ scope: 'all', tagIds: ['tag-3'] })]),
    )
    // 折叠 + 运行 → 工作区生效标签为运行标签 tag-3 → 匹配保留；会话行也匹配（运行标签）。
    expect(groups.map(g => g.key)).toEqual(['w-1'])
  })

  it('未启用或无规则 → 原样返回', () => {
    const derived = base()
    expect(applyTagFilterToGroups(derived, settings(), filter([], false))).toEqual(derived)
    expect(applyTagFilterToGroups(derived, settings(), filter([], true))).toEqual(derived)
  })
})
