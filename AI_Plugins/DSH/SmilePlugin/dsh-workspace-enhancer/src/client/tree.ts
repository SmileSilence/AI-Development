/**
 * Derives the workspace browser tree from Host Workspace order and membership.
 * Unassigned Sessions trail under Ungrouped; only the selected blank Session
 * remains visible.
 */
import {
  type SessionListState, type SessionSearchResultItem, type SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {
  SessionPendingInteractionBase,
} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-schedule/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import {
  indexSubagentDescendants, type SubagentDescendantSummary,
} from './subagent-lineage.ts'
// ——— 标签子系统（集成自 dsh-workspace-tagger）：生效标签规则 + 筛选（任务 B）———
import type { WorkspaceTaggerSettings } from './tags/settings-types.ts'
import { effectiveSessionTagId, effectiveWorkspaceTagId } from './tags/tag-store.ts'

/** Group key for Sessions outside every Workspace. */
export const UNGROUPED_KEY = ''

/** Pending interaction kinds with dedicated Workspace-row presentation. */
export type SessionPendingInteractionStatus = 'approval' | 'plan-review' | 'question'
type SessionPendingInteractions = ReadonlyMap<SessionId, SessionPendingInteractionBase>

/** One top-level session row in a group or the flat list. */
export interface SessionNode {
  id: SessionId
  /** Stored display title; the renderer substitutes the localized New Session label for blank rows. */
  title: string
  /** The provisional blank session (renderer shows the localized New Session title). */
  blank: boolean
  /** A Session-scoped UI consumer is awaiting this user. */
  pendingInteraction?: SessionPendingInteractionStatus
  running: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  /** The current list projection contains at least one active Schedule record. */
  hasActiveSchedule: boolean
  updatedAt: number
  /** 置顶状态（插件增强：渲染排前）。 */
  pinned: boolean
}

/** Session order selected by the Workspace browser. */
export type SessionOrderBy = 'manual' | 'updated'

/** One workspace group section: header row facts + visible top-level session rows. */
export interface GroupNode {
  /** Group key: the workspace id or {@link UNGROUPED_KEY}. */
  key: string
  /** Backing Workspace id; absent only for the ungrouped bucket. */
  workspaceId: WorkspaceId | undefined
  cwd: string | undefined
  /** Workspace creation time (epoch ms); absent only for the ungrouped bucket. */
  createdAt: number | undefined
  label: string
  /** Total visible sessions in the group. */
  sessionCount: number
  /** 组内运行中的可见会话数（任务 B 扩展1/3：折叠计数与工作区自动置顶）。 */
  runningSessionCount: number
  expanded: boolean
  /** The group contains the selected session (active folder tint; supplied here so the renderer never scans). */
  containsCurrent: boolean
  /** Visible session rows (empty while the group is folded). */
  sessions: readonly SessionNode[]
  /** 置顶状态（插件增强：渲染排前）。 */
  pinned: boolean
}

/** One flat search row combining list metadata with an optional content match. */
export interface SearchResultNode {
  id: SessionId
  title: string
  workspace: string
  /** A Session-scoped UI consumer is awaiting this user. */
  pendingInteraction?: SessionPendingInteractionStatus
  running: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  /** The current list projection contains at least one active Schedule record. */
  hasActiveSchedule: boolean
  snippet?: string
}

/** Bounded merged search projection plus the refine-query hint bit. */
export interface SearchResultSet {
  items: readonly SearchResultNode[]
  hasMore: boolean
}

/** Viewing state consumed by the derivation. */
export interface TreeView {
  expandedGroups: readonly string[]
  /** Browser-local order for Sessions without a backing Workspace account. */
  ungroupedOrder?: readonly string[]
}

interface Group {
  key: string
  workspaceId: WorkspaceId | undefined
  cwd: string | undefined
  createdAt: number | undefined
  label: string
  sessions: SessionSummary[]
}

/**
 * Directory display label: basename of the path (both separators accepted).
 * Ungrouped-bucket fallback for surfaces without a workspace title.
 * @param cwd - directory path, or undefined for the ungrouped bucket.
 * @returns basename, the raw cwd when it has no basename, or an empty ungrouped marker.
 */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return ''
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/** Recency comparator: newest first, id as the deterministic tiebreak (ids are unique per group). */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : 1
}

/**
 * Ordinary sessions are visible; among blank sessions, only the current one
 * is visible. Subagent children use their parent header catalog; archived
 * sessions are visible nowhere, while their accounting slots remain so
 * unarchiving restores position.
 */
function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean {
  return session.origin !== 'subagent'
    && !archived.has(session.id)
    && (!session.blank || session.id === current)
}

/**
 * A blank session is the selected Workspace's provisional New Session row;
 * its canonical title never enters search (blank rows are query-excluded)
 * and the renderer localizes its display label.
 */
function sessionTitle(session: SessionSummary): string {
  return session.blank ? '' : session.displayTitle
}

/** The list projection alone owns the best-effort active-Schedule indicator. */
function hasActiveSchedule(session: SessionSummary): boolean {
  return (session.projectionValues?.schedule?.length ?? 0) > 0
}

/** Build one group without projecting session lineage into presentation. */
function buildGroup(
  key: string,
  workspaceId: WorkspaceId | undefined,
  cwd: string | undefined,
  createdAt: number | undefined,
  label: string,
  members: readonly SessionSummary[],
  order: 'account' | 'recency',
): Group {
  const sessions = [...members]
  // Real Workspace order comes from sessionIds. Ungrouped falls back to
  // recency until the browser supplies its persisted local order.
  if (order === 'recency') sessions.sort(byRecency)
  return { key, workspaceId, cwd, createdAt, label, sessions }
}

/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
function orderedUngrouped(members: readonly SessionSummary[], stored: readonly string[]): SessionSummary[] {
  const byId = new Map(members.map(session => [session.id as string, session]))
  const included = new Set<string>()
  const ordered: SessionSummary[] = []
  for (const key of stored) {
    const session = byId.get(key)
    if (session === undefined || included.has(key)) continue
    ordered.push(session)
    included.add(key)
  }
  for (const session of [...members].sort(byRecency)) {
    if (included.has(session.id)) continue
    ordered.push(session)
  }
  return ordered
}

/**
 * Group Sessions by Host Workspace: one group per entity in stable Host
 * order, with members resolved from sessionIds in their stored order. Sessions
 * outside every Workspace trail in the browser-local Ungrouped order, which
 * falls back to recency before that order is initialized.
 */
function groupByWorkspace(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archived: ReadonlySet<SessionId>,
  ungroupedOrder: readonly string[] | undefined,
): Group[] {
  const groups: Group[] = []
  const accounted = new Set<SessionId>()
  for (const workspace of workspaces) {
    const members: SessionSummary[] = []
    for (const id of workspace.sessionIds) {
      const summary = list.byId[id]
      if (summary === undefined) continue // account may lead the list pull; the row appears when the summary lands
      accounted.add(id)
      if (!sessionVisible(summary, list.current, archived)) continue
      members.push(summary)
    }
    groups.push(buildGroup(
      workspace.workspaceId, workspace.workspaceId, workspace.path,
      Date.parse(workspace.createdAt), workspace.title, members, 'account',
    ))
  }
  const stray = list.ids
    .map(id => list.byId[id])
    .filter((s): s is SessionSummary =>
      s !== undefined && !accounted.has(s.id) && sessionVisible(s, list.current, archived))
  if (stray.length > 0) {
    groups.push(buildGroup(
      UNGROUPED_KEY,
      undefined,
      undefined,
      undefined,
      '',
      ungroupedOrder === undefined ? stray : orderedUngrouped(stray, ungroupedOrder),
      ungroupedOrder === undefined ? 'recency' : 'account',
    ))
  }
  return groups
}

/** Keep navigation presentation independent from domain-owned interaction objects. */
function visiblePendingKind(kind: string | undefined): SessionPendingInteractionStatus | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

function sessionNode(
  s: SessionSummary,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  pendingInteractions: SessionPendingInteractions,
  pinnedSessionIds: ReadonlySet<SessionId> = new Set(),
): SessionNode {
  const pendingInteraction = visiblePendingKind(pendingInteractions.get(s.id)?.kind)
  return {
    id: s.id,
    title: sessionTitle(s),
    blank: s.blank,
    running: s.running,
    runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
    completed: s.completed === true,
    hasActiveSchedule: hasActiveSchedule(s),
    updatedAt: s.updatedAt,
    pinned: pinnedSessionIds.has(s.id),
    ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
  }
}

/** 组内会话排序（任务 B 扩展2）：运行中会话自动置顶（按最近更新），其余保持原顺序。 */
function withRunningFirst(nodes: readonly SessionNode[]): SessionNode[] {
  if (!nodes.some(node => node.running)) return [...nodes]
  const running = nodes.filter(node => node.running).sort((a, b) => b.updatedAt - a.updatedAt)
  return [...running, ...nodes.filter(node => !node.running)]
}

/**
 * Derive the workspace browser groups with every session as a top-level row.
 *
 * Every group shows; sessions populate under expanded groups in the selected
 * local order. Blank sessions are excluded except for the selected
 * provisional New Session row; archived sessions are excluded everywhere.
 * Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot (`current` feeds containsCurrent).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingInteractions - pending UI interactions by Session.
 * @param view - local expansion arrays.
 * @returns group sections in render order.
 */
export function deriveGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  view: TreeView,
  pinnedWorkspaceIds: readonly string[] = [],
  pinnedSessionIds: readonly string[] = [],
): GroupNode[] {
  const archived = new Set(archivedSessionIds)
  const expandedGroups = new Set(view.expandedGroups)
  const pinnedWorkspaces = new Set(pinnedWorkspaceIds)
  const pinnedSessions = new Set<SessionId>(pinnedSessionIds as SessionId[])
  const descendants = indexSubagentDescendants(list.byId)
  const currentGroup = list.current === undefined
    ? undefined
    : (workspaces.find(w => w.sessionIds.includes(list.current as SessionId))?.workspaceId as string | undefined)
        ?? UNGROUPED_KEY
  const groups: GroupNode[] = []
  for (const g of groupByWorkspace(list, workspaces, archived, view.ungroupedOrder)) {
    const expanded = expandedGroups.has(g.key)
    const runningSessionCount = g.sessions.filter(s => s.running).length
    groups.push({
      key: g.key,
      workspaceId: g.workspaceId,
      cwd: g.cwd,
      createdAt: g.createdAt,
      label: g.label,
      sessionCount: g.sessions.length,
      runningSessionCount,
      expanded,
      containsCurrent: g.key === currentGroup,
      pinned: g.workspaceId !== undefined && pinnedWorkspaces.has(g.workspaceId),
      sessions: expanded
        ? withRunningFirst(g.sessions.map(session => sessionNode(session, descendants, pendingInteractions, pinnedSessions)))
        : [],
    })
  }
  // 任务 B 扩展3：有运行中会话的工作区自动置顶到最上层（结束后还原）；随后是
  // 手动置顶工作区；其余保持原 Host 顺序（组间相对稳定）。
  groups.sort((a, b) => {
    const aActive = a.runningSessionCount > 0
    const bActive = b.runningSessionCount > 0
    if (aActive !== bActive) return aActive ? -1 : 1
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return 0
  })
  return groups
}

/**
 * Derive the flat session list ("In one list" mode): every session — fork
 * children included — as a top-level row, strictly newest-first. No grouping,
 * no parent/child adjacency. Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingInteractions - pending UI interactions by Session.
 * @returns flat rows in render order.
 */
export function deriveFlat(
  list: SessionListState,
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  pinnedSessionIds: readonly string[] = [],
): SessionNode[] {
  const archived = new Set(archivedSessionIds)
  // 置顶集合：调用方传 string[]（store 持久化），此处提升为 SessionId 以匹配
  // sessionNode 的参数（SessionId extends string，as 转换合法）。
  const pinned = new Set<SessionId>(pinnedSessionIds as SessionId[])
  const descendants = indexSubagentDescendants(list.byId)
  const rows: SessionSummary[] = []
  for (const id of list.ids) {
    const s = list.byId[id]
    if (s === undefined || !sessionVisible(s, list.current, archived)) continue
    rows.push(s)
  }
  // 任务 B 扩展2：运行中会话自动置顶（最上层），随后手动置顶会话，其余按最近更新
  // （各段内部都按最近更新，稳定排序）。
  rows.sort((a, b) => {
    const aRunning = a.running ? 0 : 1
    const bRunning = b.running ? 0 : 1
    if (aRunning !== bRunning) return aRunning - bRunning
    const aPinned = pinned.has(a.id) ? 0 : 1
    const bPinned = pinned.has(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    return byRecency(a, b)
  })
  return rows.map(session => sessionNode(session, descendants, pendingInteractions, pinned))
}

/**
 * Merge immediate title/Workspace substring matches with ranked Host content
 * matches. Local rows lead newest-first, content-only rows retain backend
 * order, and duplicate sessions receive the backend snippet in place.
 * @param list - session metadata authority.
 * @param workspaces - Workspace membership and display labels.
 * @param query - caller text; surrounding whitespace is ignored.
 * @param archivedSessionIds - registry-global archive set (members never match).
 * @param pendingInteractions - pending UI interactions by Session.
 * @param content - ranked Host content-search page.
 * @param limit - protocol-owned maximum merged row count.
 * @returns bounded deduplicated flat rows and a refine-query hint bit.
 */
export function deriveSearchResults(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  query: string,
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  content: { items: readonly SessionSearchResultItem[]; hasMore: boolean },
  limit: number,
): SearchResultSet {
  const q = query.trim().toLowerCase()
  if (q === '') return { items: [], hasMore: false }
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)

  const workspaceBySession = new Map<SessionId, string>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title)
    }
  }
  const labelOf = (summary: SessionSummary): string =>
    workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd)
  const contentBySession = new Map<SessionId, SessionSearchResultItem>()
  for (const item of content.items) {
    if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item)
  }

  const local: SessionSummary[] = []
  for (const id of list.ids) {
    const summary = list.byId[id]
    // Blank placeholders never match a query (their canonical title displays
    // localized, so matching it would tie search to one language).
    if (summary === undefined || summary.blank || !sessionVisible(summary, list.current, archived)) continue
    if (
      sessionTitle(summary).toLowerCase().includes(q)
      || labelOf(summary).toLowerCase().includes(q)
    ) {
      local.push(summary)
    }
  }
  local.sort(byRecency)

  const ordered: SessionSummary[] = []
  const included = new Set<SessionId>()
  const include = (summary: SessionSummary): void => {
    if (included.has(summary.id)) return
    included.add(summary.id)
    ordered.push(summary)
  }
  for (const summary of local) include(summary)
  for (const item of content.items) {
    const summary = list.byId[item.sessionId]
    if (summary !== undefined && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary)
  }

  return {
    items: ordered.slice(0, limit).map((summary) => {
      const match = contentBySession.get(summary.id)
      const pendingInteraction = visiblePendingKind(pendingInteractions.get(summary.id)?.kind)
      return {
        id: summary.id,
        title: sessionTitle(summary),
        workspace: labelOf(summary),
        running: summary.running,
        runningSubagentCount: descendants.get(summary.id)?.runningCount ?? 0,
        ...(pendingInteraction === undefined
          ? {}
          : { pendingInteraction }),
        completed: summary.completed === true,
        hasActiveSchedule: hasActiveSchedule(summary),
        ...match === undefined ? {} : { snippet: match.snippet },
      }
    }),
    hasMore: content.hasMore || ordered.length > limit,
  }
}

// ---------------------------------------------------------------------------
// 标签筛选（任务 B 扩展4-6）
// ---------------------------------------------------------------------------

/** 「无标签」筛选选项的哨兵 id（与 nextTagId 的 tag-N 命名不冲突）。 */
export const TAG_FILTER_NO_TAG = '__no_tag__'

/** 筛选条件：包含（任一选中）/ 不包含（均未选中）/ 等于（单个指定标签）。 */
export type TagFilterCondition = 'include' | 'exclude' | 'equals'

/** 筛选作用范围：全部（工作区+会话）/ 仅工作区 / 仅会话。 */
export type TagFilterScope = 'all' | 'workspace' | 'session'

/** 标签筛选器状态（v0.4.0：多条件行 AND 组合；由浏览器本地维护，不持久化）。 */
export interface TagFilterRule {
  /** 条件行唯一 id（面板增删行时用于定位）。 */
  id: string
  /** 本行作用范围：全部（工作区+会话）/ 仅工作区 / 仅会话。 */
  scope: TagFilterScope
  /** 本行条件：包含 / 不包含 / 等于。 */
  condition: TagFilterCondition
  /** 本行选中的标签 id 集合；含 {@link TAG_FILTER_NO_TAG} 表示「无标签」。 */
  tagIds: readonly string[]
}

/** 标签筛选器状态（v0.4.0：多条件行 AND 组合；由浏览器本地维护，不持久化）。 */
export interface TagFilter {
  /** 主开关：关闭时不过滤（面板「清除全部」会连同规则一起清空）。 */
  enabled: boolean
  /** 条件行列表，行间 AND：目标行必须通过所有适用规则。 */
  rules: readonly TagFilterRule[]
}

/** 空筛选：未启用、无规则、或所有规则都未选标签 → 不过滤。 */
export function isTagFilterInactive(filter: TagFilter): boolean {
  if (!filter.enabled || filter.rules.length === 0) return true
  return filter.rules.every(rule => rule.tagIds.length === 0)
}

/** 单个目标（工作区/会话）的生效标签是否匹配某一条条件行（空标签行恒匹配）。 */
export function tagFilterMatches(rule: TagFilterRule, effectiveTagId: string | undefined): boolean {
  if (rule.tagIds.length === 0) return true
  const noneSelected = rule.tagIds.includes(TAG_FILTER_NO_TAG)
  const match = (): boolean => {
    if (effectiveTagId === undefined) return noneSelected
    return rule.tagIds.includes(effectiveTagId)
  }
  switch (rule.condition) {
    case 'exclude':
      return !match()
    case 'include':
    case 'equals':
    default:
      // 包含/等于：命中任一选中标签或「无标签」即视为匹配（等于 UI 强制单选）。
      return match()
  }
}

/**
 * 按筛选条件过滤分组树（v0.4.0：多条件行 AND）：
 *  - 工作区行：需通过所有「workspace/all」范围规则（任一条淘汰即隐藏组）；
 *  - 会话行：需通过所有「session/all」范围规则（任一条淘汰即隐藏行）；
 *  - workspace 范围规则不影响会话行，session 范围规则不影响工作区行。
 * 未分组桶没有工作区标签，仅受 session/all 范围规则影响。
 */
export function applyTagFilterToGroups(
  groups: readonly GroupNode[],
  settings: WorkspaceTaggerSettings,
  filter: TagFilter,
): GroupNode[] {
  if (isTagFilterInactive(filter)) return [...groups]
  // 适用于工作区行的规则（全部 + 仅工作区）与会话行的规则（全部 + 仅会话）。
  const workspaceRules = filter.rules.filter(rule => rule.scope !== 'session')
  const sessionRules = filter.rules.filter(rule => rule.scope !== 'workspace')
  const result: GroupNode[] = []
  for (const group of groups) {
    if (group.workspaceId !== undefined && workspaceRules.length > 0) {
      const effective = effectiveWorkspaceTagId(
        settings, group.workspaceId, group.expanded, group.runningSessionCount > 0,
      )
      if (!workspaceRules.every(rule => tagFilterMatches(rule, effective))) continue
    }
    const sessions = sessionRules.length === 0
      ? group.sessions
      : group.sessions.filter(session => {
          const effective = effectiveSessionTagId(settings, session.id, session.running)
          return sessionRules.every(rule => tagFilterMatches(rule, effective))
        })
    result.push({ ...group, sessions })
  }
  return result
}
