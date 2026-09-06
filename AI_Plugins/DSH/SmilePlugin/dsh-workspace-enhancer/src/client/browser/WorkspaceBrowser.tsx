/**
 * The workspace/session browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + view options + add
 * workspace), search, the grouped tree or flat list, and the workspace
 * dialogs. Wide state renders the full browser; rail state renders the two
 * region icons (search / add workspace) as 36px controls on the shell's shared
 * rail entry path, each requesting expansion through the owner share. Adding
 * is the header button's one action, so it raises the directory flow with no
 * menu in between; the flow and its error dialog live in WorkspacePicker
 * (same package — direct composition, no slot between them).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Button, IconAgentPresetOutline16, IconChevronDownOutline14, IconChevronUpOutline14, IconCloseFill14, IconNewChatOutline16, IconPersonalizationOutline16,
  IconProjectAddOutline16, IconChecklistOutline14, IconSearchOutline16, Menu, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionListState, SessionSearchResultItem,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceBrowserInjected, WorkspaceBrowserProps } from '../contract/slots.ts'
import type { SessionNode, SessionOrderBy, TagFilter } from '../tree.ts'
import { applyTagFilterToGroups, deriveFlat, deriveGroups, deriveSearchResults, isTagFilterInactive, UNGROUPED_KEY } from '../tree.ts'
import { ProjectRowItem, SearchResultItem, SessionNodeItem, type RowTaggerProps, type TagTarget } from './Rows.tsx'
import { TagDialog } from '../tags/ui/TagDialog.tsx'
import { tagById } from '../tags/tag-store.ts'
import type { WorkspaceTaggerSettings } from '../tags/settings-types.ts'
import { FilterButton } from './FilterButton.tsx'
import { FLAT_SESSION_ORDER_KEY } from '../stores.ts'
import { WorkspacePickFlow } from '../WorkspacePicker.tsx'
import css from './WorkspaceBrowser.module.css'

/**
 * Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
 * focus() forces a synchronous layout and would jank the slide.
 */
const EXPAND_SLIDE_MS = 300
/** Pause between the latest keystroke and a Host content-search request. */
const SEARCH_DEBOUNCE_MS = 250
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
const SEARCH_QUERY_MAX_CODE_UNITS = 500
/** Session rows visible per Workspace before the local overflow control. */
const COLLAPSED_SESSION_LIMIT = 5

/** Fold one Workspace without charging its provisional New Session against the ordinary-row limit. */
function collapsedSessionRows(sessions: readonly SessionNode[]): {
  rows: readonly SessionNode[]
  hiddenCount: number
} {
  let ordinaryCount = 0
  const rows = sessions.filter((session) => {
    if (session.blank) return true
    if (ordinaryCount >= COLLAPSED_SESSION_LIMIT) return false
    ordinaryCount += 1
    return true
  })
  return { rows, hiddenCount: sessions.length - rows.length }
}

/** Keep controlled input and RPC payload inside the session.search wire contract. */
function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--
  return withoutNul.slice(0, end)
}

/** Immutable membership toggle for the local expand-all array. */
function toggled(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key]
}

/**
 * Accept the native drag at document level while a row drag is active: row
 * hover still owns the insertion marker, and releasing outside the list must
 * not be rendered as a rejected drop before dragend commits that last marker.
 */
function useNativeDragAcceptance(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const acceptDrag = (event: DragEvent): void => {
      event.preventDefault()
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
    }
    const acceptDrop = (event: DragEvent): void => { event.preventDefault() }
    document.addEventListener('dragover', acceptDrag)
    document.addEventListener('drop', acceptDrop)
    return () => {
      document.removeEventListener('dragover', acceptDrag)
      document.removeEventListener('drop', acceptDrop)
    }
  }, [active])
}

/** Reconcile a stored view order with the Workspace's current session account. */
function reconciledSessionOrder(sessionIds: readonly SessionId[], stored: readonly string[] | undefined): SessionId[] {
  if (stored === undefined) return [...sessionIds]
  const byId = new Map(sessionIds.map(id => [id as string, id]))
  const ordered: SessionId[] = []
  const included = new Set<string>()
  for (const key of stored) {
    const id = byId.get(key)
    if (id === undefined || included.has(key)) continue
    ordered.push(id)
    included.add(key)
  }
  for (const id of sessionIds) {
    if (included.has(id)) continue
    ordered.push(id)
  }
  return ordered
}

/** Newest update first with stable Session identity as the tie-break. */
function compareSessionRecency(a: SessionId, b: SessionId, byId: SessionListState['byId']): number {
  const aUpdatedAt = byId[a]?.updatedAt ?? Number.NEGATIVE_INFINITY
  const bUpdatedAt = byId[b]?.updatedAt ?? Number.NEGATIVE_INFINITY
  if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt
  return a < b ? -1 : 1
}

/** Reconcile one editable order account and apply its activity-promotion policy. */
function nextSessionOrderAccount({
  sessionIds, previousOrder, previousUpdatedAt, list, orderBy, sortByRecency,
}: {
  sessionIds: readonly SessionId[]
  previousOrder: readonly string[] | undefined
  previousUpdatedAt: Readonly<Record<string, number>>
  list: SessionListState
  orderBy: SessionOrderBy
  sortByRecency: boolean
}): { order: SessionId[]; updatedAt: Record<string, number>; changed: boolean } {
  let order = reconciledSessionOrder(sessionIds, previousOrder)
  if (sortByRecency) {
    order.sort((a, b) => compareSessionRecency(a, b, list.byId))
  } else if (orderBy === 'updated') {
    const promoted = sessionIds
      .filter((id) => {
        const session = list.byId[id]
        return session !== undefined
          && (previousUpdatedAt[id] === undefined || session.updatedAt > previousUpdatedAt[id])
      })
      .sort((a, b) => compareSessionRecency(a, b, list.byId))
    if (promoted.length > 0) {
      const promotedIds = new Set(promoted)
      order = [...promoted, ...order.filter(id => !promotedIds.has(id))]
    }
  }
  const updatedAt: Record<string, number> = {}
  for (const id of sessionIds) {
    const session = list.byId[id]
    if (session !== undefined) updatedAt[id] = session.updatedAt
  }
  const orderChanged = previousOrder === undefined
    || order.length !== previousOrder.length
    || order.some((id, index) => id !== previousOrder[index])
  const timestampsChanged = Object.keys(updatedAt).length !== Object.keys(previousUpdatedAt).length
    || Object.entries(updatedAt).some(([id, timestamp]) => previousUpdatedAt[id] !== timestamp)
  return { order, updatedAt, changed: orderChanged || timestampsChanged }
}

/** Grouping and ordering menu; own open state so it resets with the wide chrome.
 *  批量操作入口已提升为标题栏可见按钮（修改 4），不再藏于本菜单。 */
function ViewOptionsMenu({ groupBy, orderBy, onGroupPick, onOrderPick, t }: {
  groupBy: 'workspace' | 'flat'
  orderBy: SessionOrderBy
  onGroupPick: (mode: 'workspace' | 'flat') => void
  onOrderPick: (mode: SessionOrderBy) => void
  t: WorkspaceBrowserProps['t']
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { type: 'label' as const, id: 'group-by', text: t('groupBy.label') },
        { id: 'workspace', label: t('groupBy.workspace') },
        { id: 'flat', label: t('groupBy.flat') },
        { type: 'separator' as const, id: 'order-by-separator' },
        { type: 'label' as const, id: 'order-by', text: t('orderBy.label') },
        { id: 'manual', label: t('orderBy.manual') },
        { id: 'updated', label: t('orderBy.updated') },
      ]}
      selectedIds={[groupBy, orderBy]}
      onSelect={(id) => {
        if (id === 'workspace' || id === 'flat') onGroupPick(id)
        else if (id === 'manual' || id === 'updated') onOrderPick(id)
        setOpen(false)
      }}
      align="end"
      dense
      // Portal: the section header clips overflow, so an in-place list would
      // be cut off at the header's bounds.
      portal
      anchor={(
        <Tooltip label={t('viewOptions.label')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={clsx(css.iconButton, css.wide)}
            aria-label={t('viewOptions.label')}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconPersonalizationOutline16 />
          </button>
        </Tooltip>
      )}
    />
  )
}

/**
 * 会话默认模式选择器（需求 6）：读 Agent preset 名册与当前默认，
 * Menu 列出可选 preset，选中写 settings `agent-presets.default`。
 * 数据经注入的 agentPresetDefault（仅 default，绝不触碰 agentPresets.select）。
 */
function AgentPresetDefaultSelector({ list, current, setDefault, t, compact = false }: {
  list: WorkspaceBrowserInjected['agentPresetDefault']['list']
  current: WorkspaceBrowserInjected['agentPresetDefault']['current']
  setDefault: WorkspaceBrowserInjected['agentPresetDefault']['setDefault']
  t: WorkspaceBrowserProps['t']
  /** 收缩边栏（rail）模式：只显示图标。 */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<Awaited<ReturnType<typeof list>>>([])
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [applyError, setApplyError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all([list(), current()]).then(([items, currentId]) => {
      if (!alive) return
      setPresets(items)
      setSelected(currentId)
    }).catch(() => { /* 名册不可用：选择器渲染空态 */ })
    return () => { alive = false }
  }, [list, current])
  const label = presets.find(p => p.id === selected)?.name ?? selected
  return (
    <>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={presets.length === 0
          ? [{ type: 'label' as const, id: 'none', text: t('defaultMode.unset') }]
          : presets.map(preset => ({
            id: preset.id,
            label: preset.name ?? preset.id,
          }))}
        selectedIds={selected === undefined ? [] : [selected]}
        onSelect={(id) => {
          setOpen(false)
          setSelected(id)
          setApplyError(null)
          void setDefault(id).catch((error: unknown) => {
            setApplyError(error instanceof Error ? error.message : String(error))
          })
        }}
        align="start"
        dense
        portal
        anchor={(
          <button
            type="button"
            className={clsx(
              compact ? css.defaultModeIcon : css.defaultModeFull,
              open && css.defaultModeFullOpen,
            )}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t('defaultMode.aria')}
            title={compact ? (label ?? t('defaultMode.unset')) : undefined}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconAgentPresetOutline16 size={14} />
            {!compact && (
              <>
                <span className={css.defaultModeSeatLabel}>
                  {selected === undefined || label === undefined
                    ? t('defaultMode.unset')
                    : label}
                </span>
                <IconChevronDownOutline14 size={14} />
              </>
            )}
          </button>
        )}
      />
      {applyError !== null && (
        <div className={css.defaultModeError} role="alert">{applyError}</div>
      )}
    </>
  )
}

/** In-flight root-row drag: source identity plus the current insert marker. */
interface DragState {
  /** Workspace id, or {@link UNGROUPED_KEY} for the browser-local loose-session account. */
  accountKey: string
  sessionId: SessionNode['id']
  /** Row the marker sits on and which half (insert above/below it). */
  over: { id: SessionNode['id']; half: 'before' | 'after' } | null
}

/** In-flight Workspace-row drag: source identity plus the current marker. */
interface WorkspaceDragState {
  workspaceId: WorkspaceId
  over: { id: WorkspaceId; half: 'before' | 'after' } | null
}

/** Resolve an insertion side from the full rendered workspace group. */
function workspaceGroupHalf(e: { clientY: number; currentTarget: HTMLElement }): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/** 双色胶囊前段 = 工作区自身标签（集成自 dsh-workspace-tagger）。 */
function workspaceFrontFor(
  tagger: RowTaggerProps,
  workspaceId: string,
): { color: string; name: string } | undefined {
  const settings = tagger.settings
  if (settings === undefined) return undefined
  const id = settings.workspaceTags[workspaceId]
  if (id === undefined) return undefined
  const tag = tagById(settings, id)
  return tag === undefined ? undefined : { color: tag.color, name: tag.name }
}

type SessionTreeProps = Pick<
  WorkspaceBrowserProps,
  'useSessions' | 'useSessionPendingInteraction' | 'startSession' | 'open' | 'forkSession'
  | 'insertWorkspaceBefore' | 'insertSessionBefore' | 't'
> & {
  /** Host account home for POSIX hover-path abbreviation. */
  home?: string | undefined
  workspaces: readonly WorkspaceView[]
  /** Explicit persisted zero-or-five-session state by Workspace group. */
  groupExpansion: Readonly<Record<string, boolean>>
  /** Persist one Workspace group's zero-or-five-session state. */
  setGroupExpanded: (key: string, expanded: boolean) => void
  /** Shared editable orders used by Workspace groups and the flat-list account. */
  sessionOrderByAccount: Readonly<Record<string, readonly string[]>>
  /** Last update timestamps observed for one-time recent-update promotions. */
  sessionUpdatedAtByAccount: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Replace one shared order and its observed timestamps. */
  syncSessionOrderAccount: (accountKey: string, order: string[], updatedAt: Record<string, number>) => void
  /** Apply a drag to one shared order. */
  setSessionOrder: (accountKey: string, order: string[]) => void
  /** Registry-global archive set (hidden rows). */
  archivedSessionIds: readonly SessionNode['id'][]
  /** Open the browser-owned rename dialog for a real Workspace group. */
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  /**
   * 悬停卡内直接改名（需求 2 双击标题）：不弹窗，直接提交 Host。
   * 与 onRenameRequest 并存（菜单弹窗 / 卡内双击两条路径）。
   */
  onRenameWorkspace: (workspaceId: WorkspaceId, title: string) => Promise<void>
  /** Open the browser-owned delete-confirmation dialog for a real Workspace group. */
  onDeleteRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  /** Open the browser-owned session rename dialog. */
  onSessionRename: (sessionId: SessionNode['id'], currentTitle: string) => void
  /** Archive a session (row menu action; the row disappears on the state echo). */
  onSessionArchive: (sessionId: SessionNode['id']) => void
  /** Session order behavior: fixed after edits, or additionally promoted by user activity. */
  orderBy: SessionOrderBy
  /** 置顶的工作区 id（渲染排前）。 */
  pinnedWorkspaceIds: readonly string[]
  /** 置顶的会话 id（渲染排前）。 */
  pinnedSessionIds: readonly string[]
  /** Toggle a workspace's pin state. */
  onTogglePinWorkspace: (workspaceId: WorkspaceId) => void
  /** Toggle a session's pin state. */
  onTogglePinSession: (sessionId: SessionId) => void
  /** 批量模式类型（v3）：'workspace' 工作区行勾选、'session' 会话行勾选、null 关闭。 */
  bulkType: 'workspace' | 'session' | null
  /** 行勾选状态（key = workspaceId 或 sessionId）。 */
  bulkSelection: ReadonlyMap<string, 'session' | 'workspace'>
  /** Toggle one row's bulk selection. */
  onBulkToggle: (key: string, kind: 'session' | 'workspace') => void
  /** 标签子系统行侧注入面（集成自 dsh-workspace-tagger）。 */
  tagger: RowTaggerProps
  /** 标签筛选器（v0.4.0：多条件行 AND）；undefined = 不启用。 */
  tagFilter?: TagFilter | undefined
  /** 筛选命中总数回调（工作区组 + 会话行）；用于筛选面板「已筛选 N 项」。 */
  onFilteredCountChange?: (count: number) => void
}

/** The scrolling session tree; unmounting drops the sessions subscription and expand-all state. */
function SessionTree({
  useSessions, useSessionPendingInteraction, startSession, open, forkSession, workspaces, archivedSessionIds,
  onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onRenameWorkspace,
  insertWorkspaceBefore, insertSessionBefore, orderBy,
  groupExpansion, setGroupExpanded,
  sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, home, t,
  pinnedWorkspaceIds, pinnedSessionIds, onTogglePinWorkspace, onTogglePinSession,
  bulkType, bulkSelection, onBulkToggle, tagger, tagFilter, onFilteredCountChange,
}: SessionTreeProps) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const current = list.current
  const [expandedSessionGroups, setExpandedSessionGroups] = useState<string[]>([])
  // Transient drag marker state; the selected mode owns the resulting order.
  const [drag, setDrag] = useState<DragState | null>(null)
  const sessionDropCommitted = useRef(false)
  const [workspaceDrag, setWorkspaceDrag] = useState<WorkspaceDragState | null>(null)
  const workspaceDropCommitted = useRef(false)
  const previousOrderBy = useRef(orderBy)
  const nativeDragActive = drag !== null || workspaceDrag !== null
  useNativeDragAcceptance(nativeDragActive)
  const currentGroup = current === undefined
    ? undefined
    : (workspaces.find(w => w.sessionIds.includes(current))?.workspaceId as string | undefined)
      ?? UNGROUPED_KEY
  useEffect(() => {
    if (current === undefined || currentGroup === undefined || Object.hasOwn(groupExpansion, currentGroup)) return
    setGroupExpanded(currentGroup, true)
  }, [current, currentGroup, setGroupExpanded, groupExpansion])
  const expandedGroups = useMemo(
    () => Object.entries(groupExpansion).filter(([, expanded]) => expanded).map(([key]) => key),
    [groupExpansion],
  )
  const ungroupedSessionIds = useMemo(() => {
    const accounted = new Set(workspaces.flatMap(workspace => workspace.sessionIds))
    return list.ids.filter((id: SessionId) => list.byId[id] !== undefined && !accounted.has(id))
  }, [list, workspaces])
  useEffect(() => {
    if (list.phase !== 'ready') return
    const switchedToUpdated = previousOrderBy.current !== 'updated' && orderBy === 'updated'
    previousOrderBy.current = orderBy
    const accounts = [
      ...workspaces.map(workspace => ({
        key: workspace.workspaceId as string,
        sessionIds: workspace.sessionIds.filter(id => list.byId[id] !== undefined),
      })),
      { key: UNGROUPED_KEY, sessionIds: ungroupedSessionIds },
    ]
    for (const { key, sessionIds } of accounts) {
      const previousOrder = sessionOrderByAccount[key]
      const previousUpdatedAt = sessionUpdatedAtByAccount[key] ?? {}
      const next = nextSessionOrderAccount({
        sessionIds,
        previousOrder,
        previousUpdatedAt,
        list,
        orderBy,
        sortByRecency: orderBy === 'updated' && (previousOrder === undefined || switchedToUpdated),
      })
      if (next.changed) {
        syncSessionOrderAccount(key, next.order.map(id => id as string), next.updatedAt)
      }
    }
  }, [list, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, ungroupedSessionIds, workspaces])
  const orderedWorkspaces = useMemo(() => {
    return workspaces.map((workspace) => {
      const stored = sessionOrderByAccount[workspace.workspaceId as string]
      const sessionIds = reconciledSessionOrder(workspace.sessionIds, stored)
      return { ...workspace, sessionIds }
    })
  }, [sessionOrderByAccount, workspaces])
  const orderedUngroupedSessionIds = useMemo(
    () => reconciledSessionOrder(ungroupedSessionIds, sessionOrderByAccount[UNGROUPED_KEY]),
    [sessionOrderByAccount, ungroupedSessionIds],
  )
  const groups = useMemo(() => {
    const derived = deriveGroups(list, orderedWorkspaces, archivedSessionIds, pendingInteractions, {
      expandedGroups,
      ...(sessionOrderByAccount[UNGROUPED_KEY] === undefined
        ? {}
        : { ungroupedOrder: sessionOrderByAccount[UNGROUPED_KEY] }),
    }, pinnedWorkspaceIds, pinnedSessionIds)
    // 标签筛选（v0.4.0：多条件行 AND）：按生效标签过滤工作区组与会话行。
    if (tagFilter !== undefined && tagger.settings !== undefined) {
      return applyTagFilterToGroups(derived, tagger.settings, tagFilter)
    }
    return derived
  }, [list, orderedWorkspaces, archivedSessionIds, pendingInteractions, expandedGroups, sessionOrderByAccount, pinnedWorkspaceIds, pinnedSessionIds, tagFilter, tagger.settings])
  // 筛选命中总数（工作区组 + 会话行）汇报给父层，供筛选面板「已筛选 N 项」展示。
  useEffect(() => {
    if (tagFilter === undefined || tagger.settings === undefined || isTagFilterInactive(tagFilter)) {
      onFilteredCountChange?.(0)
      return
    }
    onFilteredCountChange?.(groups.reduce((total, group) => total + 1 + group.sessions.length, 0))
  }, [groups, tagFilter, tagger.settings, onFilteredCountChange])
  const now = Date.now()
  const commitSessionDrag = (activeDrag: DragState, over: NonNullable<DragState['over']>): void => {
    if (sessionDropCommitted.current) return
    sessionDropCommitted.current = true
    setDrag(null)
    const group = groups.find(candidate => candidate.key === activeDrag.accountKey)
    if (group === undefined) return
    const sessionsExpanded = expandedSessionGroups.includes(group.key)
    const renderedSessions = sessionsExpanded ? group.sessions : collapsedSessionRows(group.sessions).rows
    const targetIndex = renderedSessions.findIndex(session => session.id === over.id)
    if (targetIndex === -1) return
    const sourceIndex = renderedSessions.findIndex(session => session.id === activeDrag.sessionId)
    if (over.id === activeDrag.sessionId) return
    const withoutSource = renderedSessions.filter(session => session.id !== activeDrag.sessionId)
    const targetWithoutSourceIndex = withoutSource.findIndex(session => session.id === over.id)
    if (targetWithoutSourceIndex === -1) return
    const visibleInsertAt = over.half === 'before' ? targetWithoutSourceIndex : targetWithoutSourceIndex + 1
    if (sourceIndex !== -1 && visibleInsertAt === sourceIndex) return
    const accountSessionIds = activeDrag.accountKey === UNGROUPED_KEY
      ? orderedUngroupedSessionIds
      : orderedWorkspaces.find(workspace => workspace.workspaceId === activeDrag.accountKey)?.sessionIds
    if (accountSessionIds === undefined) return
    const nextOrder = accountSessionIds.filter(id => id !== activeDrag.sessionId)
    let anchor: SessionId | undefined
    if (sessionsExpanded) {
      anchor = over.half === 'before' ? over.id : renderedSessions[targetIndex + 1]?.id
    } else {
      // A collapsed group may render the blank row after hidden ordinary rows.
      // Place the source at the visible boundary before those hidden account members.
      const previousVisible = withoutSource[visibleInsertAt - 1]?.id
      if (previousVisible === undefined) {
        anchor = nextOrder[0]
      } else {
        const previousIndex = nextOrder.indexOf(previousVisible)
        if (previousIndex === -1) return
        anchor = nextOrder[previousIndex + 1]
      }
    }
    const insertAt = anchor === undefined ? nextOrder.length : nextOrder.indexOf(anchor)
    nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId)
    if (!sessionsExpanded && sourceIndex !== -1) {
      const nodes = new Map(group.sessions.map(node => [node.id, node]))
      const nextGroup = nextOrder.flatMap((id) => {
        const node = nodes.get(id)
        return node === undefined ? [] : [node]
      })
      if (!collapsedSessionRows(nextGroup).rows.some(node => node.id === activeDrag.sessionId)) return
    }
    setSessionOrder(activeDrag.accountKey, nextOrder.map(id => id as string))
    if (orderBy === 'updated' || activeDrag.accountKey === UNGROUPED_KEY) return
    insertSessionBefore(activeDrag.accountKey as WorkspaceId, activeDrag.sessionId, anchor).catch((reason: unknown) => {
      console.warn('session reorder rejected:', reason)
    })
  }
  const commitWorkspaceDrag = (
    activeDrag: WorkspaceDragState,
    over: NonNullable<WorkspaceDragState['over']>,
  ): void => {
    if (workspaceDropCommitted.current) return
    workspaceDropCommitted.current = true
    setWorkspaceDrag(null)
    const rowIndex = workspaces.findIndex(workspace => workspace.workspaceId === over.id)
    if (rowIndex === -1) return
    const anchor = over.half === 'before' ? over.id : workspaces[rowIndex + 1]?.workspaceId
    if (anchor === activeDrag.workspaceId) return
    const sourceIndex = workspaces.findIndex(workspace => workspace.workspaceId === activeDrag.workspaceId)
    const anchorIndex = anchor === undefined
      ? workspaces.length
      : workspaces.findIndex(workspace => workspace.workspaceId === anchor)
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return
    insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason: unknown) => {
      console.warn('workspace reorder rejected:', reason)
    })
  }
  const workspaceDropAtListStart = groups[0]?.workspaceId !== undefined
    && workspaceDrag?.over?.id === groups[0].workspaceId
    && workspaceDrag.over.half === 'before'

  return (
    <div className={clsx(css.treeBody, css.wide)}>
      {workspaceDropAtListStart && <span className={css.listTopDropIndicator} aria-hidden="true" />}
      <div
        className={clsx(css.list, workspaceDropAtListStart && css.listTopDropActive)}
        role="tree"
        aria-label={t('section.sessions')}
      >
        {groups.length === 0 && (
          <div className={css.empty}>{t('empty.none')}</div>
        )}
        {groups.map((group) => {
          const workspaceId = group.workspaceId
          const collapsed = collapsedSessionRows(group.sessions)
          const sessionsExpanded = expandedSessionGroups.includes(group.key)
          const workspaceMarker = workspaceId !== undefined && workspaceDrag?.over?.id === workspaceId
            ? workspaceDrag.over.half
            : null
          const workspaceDragProps = workspaceId === undefined ? undefined : {
            start: () => {
              workspaceDropCommitted.current = false
              setWorkspaceDrag({ workspaceId, over: null })
            },
            end: () => {
              if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) {
                commitWorkspaceDrag(workspaceDrag, workspaceDrag.over)
              } else {
                setWorkspaceDrag(null)
              }
              workspaceDropCommitted.current = false
            },
          }
          const hoverWorkspace = workspaceId === undefined
            ? undefined
            : (half: 'before' | 'after') => {
              setWorkspaceDrag(active => active === null
                ? active
                : { ...active, over: { id: workspaceId, half } })
            }
          const dropWorkspace = workspaceId === undefined
            ? undefined
            : (half: 'before' | 'after') => {
              if (workspaceDrag === null) return
              commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half })
            }
          return (
          // Group section: header row + expanded top-level session rows. The
          // inter-group breathing room is the section's own margin
          // (WorkspaceBrowser.module.css).
            <div
              key={group.key}
              className={clsx(
                css.groupSection,
                workspaceMarker === 'before' && css.workspaceDropBefore,
                workspaceMarker === 'after' && css.workspaceDropAfter,
              )}
              onDragOver={workspaceDrag === null || hoverWorkspace === undefined
                ? undefined
                : (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  hoverWorkspace(workspaceGroupHalf(e))
                }}
              onDrop={workspaceDrag === null || dropWorkspace === undefined
                ? undefined
                : (e) => {
                  e.preventDefault()
                  dropWorkspace(workspaceGroupHalf(e))
                }}
            >
              <ProjectRowItem
                group={group}
                home={home}
                t={t}
                tagger={tagger}
                onToggle={() => {
                  if (group.expanded) {
                    setExpandedSessionGroups(keys => keys.filter(key => key !== group.key))
                  }
                  setGroupExpanded(group.key, !group.expanded)
                }}
                onCreate={() => {
                  if (group.workspaceId !== undefined) {
                    setGroupExpanded(group.key, true)
                    startSession(group.workspaceId)
                  }
                }}
                drag={workspaceDragProps}
                onTogglePin={group.workspaceId === undefined
                  ? undefined
                  : () => { onTogglePinWorkspace(group.workspaceId as WorkspaceId) }}
                onRenameWorkspace={group.workspaceId === undefined
                  ? undefined
                  : (title: string) => onRenameWorkspace(group.workspaceId as WorkspaceId, title)}
                bulkMode={bulkType === 'workspace'}
                bulkSelected={group.workspaceId !== undefined && bulkSelection.has(group.workspaceId)}
                onBulkToggle={group.workspaceId === undefined
                  ? undefined
                  : () => { onBulkToggle(group.workspaceId as WorkspaceId, 'workspace') }}
                actions={group.workspaceId === undefined
                  ? undefined
                  : {
                    rename: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onRenameRequest(group.workspaceId, group.label)
                    },
                    delete: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onDeleteRequest(group.workspaceId, group.label)
                    },
                  }}
              />
              {(sessionsExpanded
                ? group.sessions
                : collapsed.rows
              ).map((node) => {
              // Session drag never leaves its group. Ungrouped writes only the
              // browser-local account; real Workspaces may also write Host order.
                const sameGroupDrag = drag !== null && drag.accountKey === group.key
                const dragProps = {
                  start: () => {
                    sessionDropCommitted.current = false
                    setDrag({ accountKey: group.key, sessionId: node.id, over: null })
                  },
                  active: sameGroupDrag,
                  marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
                  hover: (half: 'before' | 'after') => {
                  /* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
                    setDrag(d => (d === null ? d : { ...d, over: { id: node.id, half } }))
                  },
                  drop: (half: 'before' | 'after') => {
                  /* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
                    if (drag === null) return
                    commitSessionDrag(drag, { id: node.id, half })
                  },
                  end: () => {
                    if (drag?.over !== null && drag?.over !== undefined) commitSessionDrag(drag, drag.over)
                    else setDrag(null)
                    sessionDropCommitted.current = false
                  },
                }
                return (
                  <SessionNodeItem
                    key={node.id}
                    node={node}
                    currentId={current}
                    now={now}
                    onOpen={open}
                    onRename={onSessionRename}
                    onFork={forkSession}
                    onArchive={onSessionArchive}
                    onTogglePin={() => { onTogglePinSession(node.id) }}
                    bulkMode={bulkType === 'session'}
                    bulkSelected={bulkSelection.has(node.id as string)}
                    onBulkToggle={() => { onBulkToggle(node.id as string, 'session') }}
                    drag={dragProps}
                    tagger={tagger}
                    workspaceFront={group.workspaceId !== undefined
                      ? workspaceFrontFor(tagger, group.workspaceId)
                      : undefined}
                    t={t}
                  />
                )
              })}
              {collapsed.hiddenCount > 0 && (
                <button
                  type="button"
                  className={css.sessionOverflowButton}
                  aria-expanded={sessionsExpanded}
                  onClick={() => { setExpandedSessionGroups(keys => toggled(keys, group.key)) }}
                >
                  {sessionsExpanded
                    ? t('sessions.collapse')
                    : t('sessions.expand', { n: collapsed.hiddenCount })}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <span className={css.fade} />
    </div>
  )
}

/** The flat "In one list" body: every session is one draggable top-level row. */
function FlatList({
  useSessions, useSessionPendingInteraction, open, forkSession, onSessionRename, onSessionArchive,
  archivedSessionIds,
  orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, t,
  pinnedSessionIds, onTogglePinSession, bulkType, bulkSelection, onBulkToggle, tagger,
}: Pick<
  SessionTreeProps,
  | 'useSessions'
  | 'useSessionPendingInteraction'
  | 'open'
  | 'forkSession'
  | 'onSessionRename'
  | 'onSessionArchive'
  | 'archivedSessionIds'
  | 'orderBy'
  | 'sessionOrderByAccount'
  | 'sessionUpdatedAtByAccount'
  | 'syncSessionOrderAccount'
  | 'setSessionOrder'
  | 't'
  | 'pinnedSessionIds'
  | 'onTogglePinSession'
  | 'bulkType'
  | 'bulkSelection'
  | 'onBulkToggle'
  | 'tagger'
>) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const baseRows = useMemo(
    () => deriveFlat(list, archivedSessionIds, pendingInteractions, pinnedSessionIds),
    [list, archivedSessionIds, pendingInteractions, pinnedSessionIds],
  )
  const sessionIds = useMemo(() => baseRows.map(row => row.id), [baseRows])
  const previousOrderBy = useRef(orderBy)
  useEffect(() => {
    if (list.phase !== 'ready') return
    const previousOrder = sessionOrderByAccount[FLAT_SESSION_ORDER_KEY]
    const previousUpdatedAt = sessionUpdatedAtByAccount[FLAT_SESSION_ORDER_KEY] ?? {}
    const switchedToUpdated = previousOrderBy.current !== 'updated' && orderBy === 'updated'
    previousOrderBy.current = orderBy
    const next = nextSessionOrderAccount({
      sessionIds,
      previousOrder,
      previousUpdatedAt,
      list,
      orderBy,
      sortByRecency: orderBy === 'updated' && (previousOrder === undefined || switchedToUpdated),
    })
    if (next.changed) {
      syncSessionOrderAccount(FLAT_SESSION_ORDER_KEY, next.order.map(id => id as string), next.updatedAt)
    }
  }, [list, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, sessionIds, syncSessionOrderAccount])
  const rows = useMemo(() => {
    const byId = new Map(baseRows.map(row => [row.id, row]))
    return reconciledSessionOrder(sessionIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY])
      .flatMap((id) => {
        const row = byId.get(id)
        return row === undefined ? [] : [row]
      })
  }, [baseRows, sessionOrderByAccount, sessionIds])
  const [drag, setDrag] = useState<DragState | null>(null)
  const dropCommitted = useRef(false)
  useNativeDragAcceptance(drag !== null)
  const commitDrag = (activeDrag: DragState, over: NonNullable<DragState['over']>): void => {
    if (dropCommitted.current) return
    dropCommitted.current = true
    setDrag(null)
    const targetIndex = rows.findIndex(row => row.id === over.id)
    if (targetIndex === -1) return
    const anchor = over.half === 'before' ? over.id : rows[targetIndex + 1]?.id
    if (anchor === activeDrag.sessionId) return
    const sourceIndex = rows.findIndex(row => row.id === activeDrag.sessionId)
    const anchorIndex = anchor === undefined ? rows.length : rows.findIndex(row => row.id === anchor)
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return
    const nextOrder = rows.map(row => row.id).filter(id => id !== activeDrag.sessionId)
    const insertAt = anchor === undefined ? nextOrder.length : nextOrder.indexOf(anchor)
    nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId)
    setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder.map(id => id as string))
  }
  const now = Date.now()
  return (
    <div className={clsx(css.treeBody, css.wide)}>
      <div className={clsx(css.list, css.flatList)} role="tree" aria-label={t('section.sessions')}>
        {rows.length === 0 && (
          <div className={css.empty}>{t('empty.none')}</div>
        )}
        {rows.map((node) => {
          const active = drag !== null
          return (
            <SessionNodeItem
              key={node.id}
              node={node}
              currentId={list.current}
              now={now}
              onOpen={open}
              onRename={onSessionRename}
              onFork={forkSession}
              onArchive={onSessionArchive}
              onTogglePin={() => { onTogglePinSession(node.id) }}
              bulkMode={bulkType === 'session'}
              bulkSelected={bulkSelection.has(node.id as string)}
              onBulkToggle={() => { onBulkToggle(node.id as string, 'session') }}
              tagger={tagger}
              flat
              drag={{
                start: () => {
                  dropCommitted.current = false
                  setDrag({ accountKey: FLAT_SESSION_ORDER_KEY, sessionId: node.id, over: null })
                },
                active,
                marker: active && drag.over?.id === node.id ? drag.over.half : null,
                hover: (half) => {
                  setDrag(current => current === null ? current : { ...current, over: { id: node.id, half } })
                },
                drop: (half) => {
                  if (drag !== null) commitDrag(drag, { id: node.id, half })
                },
                end: () => {
                  if (drag?.over !== null && drag?.over !== undefined) commitDrag(drag, drag.over)
                  else setDrag(null)
                  dropCommitted.current = false
                },
              }}
              t={t}
            />
          )
        })}
      </div>
      <span className={css.fade} />
    </div>
  )
}

interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly SessionSearchResultItem[]
  hasMore: boolean
}

/** Flat search body: local metadata matches plus the current Host result page. */
function SearchResults({
  useSessions,
  useSessionPendingInteraction,
  open,
  workspaces,
  archivedSessionIds,
  query,
  remote,
  resultLimit,
  tagger,
  t,
}: Pick<SessionTreeProps, 'useSessions' | 'useSessionPendingInteraction' | 'open' | 't' | 'tagger'> & {
  workspaces: readonly WorkspaceView[]
  archivedSessionIds: readonly SessionNode['id'][]
  query: string
  remote: RemoteSearchState
  resultLimit: number
}) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const currentRemote = remote.query === query
    ? remote
    : { query, status: 'loading' as const, items: [], hasMore: false }
  const results = useMemo(
    () => deriveSearchResults(
      list,
      workspaces,
      query,
      archivedSessionIds,
      pendingInteractions,
      currentRemote,
      resultLimit,
    ),
    [list, workspaces, query, archivedSessionIds, pendingInteractions, currentRemote, resultLimit],
  )
  const pending = currentRemote.status === 'loading'
  const failed = currentRemote.status === 'error'

  return (
    <div className={clsx(css.treeBody, css.wide)}>
      <div className={css.list}>
        <div className={css.searchTree} role="tree" aria-label={t('search.results.aria')}>
          {results.items.map(result => (
            <SearchResultItem
              key={result.id}
              result={result}
              currentId={list.current}
              onOpen={open}
              tagger={tagger}
              t={t}
            />
          ))}
        </div>
        {pending && (
          <div className={css.searchStatus} role="status">{t('search.pending')}</div>
        )}
        {failed && (
          <div className={css.searchWarning} role="status">
            {t('search.unavailable')}
          </div>
        )}
        {!pending && results.items.length === 0 && (
          <div className={css.empty}>{t('search.noMatches')}</div>
        )}
        {results.hasMore && (
          <div className={css.searchStatus}>
            {t('search.hasMore', { n: resultLimit })}
          </div>
        )}
      </div>
      <span className={css.fade} />
    </div>
  )
}

/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export function WorkspaceBrowser({
  wide,
  expandSidebar,
  useSessions,
  useSessionPendingInteraction,
  useWorkspaces,
  useStore,
  actions,
  startSession,
  open,
  renameSession,
  forkSession,
  renameWorkspace,
  deleteWorkspace,
  insertWorkspaceBefore,
  archiveSession,
  insertSessionBefore,
  createWorkspace,
  searchSessions,
  searchResultLimit,
  agentPresetDefault,
  useDirectoryFlow,
  useHostInfo,
  useTagger,
  tagger,
  taggerT,
  renderSlot,
  t,
}: WorkspaceBrowserProps) {
  const home = useHostInfo(info => info.home)
  const workspaces = useWorkspaces(state => state.items)
  const workspacePhase = useWorkspaces(state => state.phase)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  // 标签子系统（集成自 dsh-workspace-tagger）：快照 → 行侧注入面。
  const taggerSettings = useTagger(snapshot => snapshot.value)
  const [tagTarget, setTagTarget] = useState<TagTarget | null>(null)
  const rowTagger: RowTaggerProps = {
    settings: taggerSettings,
    t: taggerT,
    onSetTag: setTagTarget,
  }
  // Live occupancy of this surface's directory-flow hole (the same source the
  // flow reads): a composition without a picking affordance can add nothing.
  const directoryFlowAvailable = useDirectoryFlow(occupied => occupied)
  const groupBy = useStore(s => s.groupBy)
  const orderBy = useStore(s => s.orderBy)
  const pinnedWorkspaceIds = useStore(s => s.pinnedWorkspaceIds)
  const pinnedSessionIds = useStore(s => s.pinnedSessionIds)
  const groupExpansion = useStore(s => s.groupExpansion)
  const sessionOrderByAccount = useStore(s => s.sessionOrderByAccount)
  const sessionUpdatedAtByAccount = useStore(s => s.sessionUpdatedAtByAccount)
  const currentBlankSessionId = useSessions((state) => {
    const current = state.current
    return current !== undefined && state.byId[current]?.blank === true ? current : undefined
  })
  const currentBlankAccount = currentBlankSessionId === undefined
    ? undefined
    : (workspaces.find(workspace => workspace.sessionIds.includes(currentBlankSessionId))
      ?.workspaceId as string | undefined) ?? UNGROUPED_KEY
  const promotedBlank = useRef<{ sessionId: SessionId; accountKey: string } | undefined>(undefined)
  useEffect(() => {
    if (currentBlankSessionId === undefined || currentBlankAccount === undefined) {
      promotedBlank.current = undefined
      return
    }
    const promoted = promotedBlank.current
    if (promoted !== undefined && promoted.sessionId === currentBlankSessionId
      && promoted.accountKey === currentBlankAccount) return
    promotedBlank.current = { sessionId: currentBlankSessionId, accountKey: currentBlankAccount }
    for (const accountKey of new Set([currentBlankAccount, FLAT_SESSION_ORDER_KEY])) {
      const previous = sessionOrderByAccount[accountKey] ?? []
      actions.setSessionOrder(accountKey, [
        currentBlankSessionId,
        ...previous.filter(id => id !== currentBlankSessionId),
      ])
    }
  }, [actions.setSessionOrder, currentBlankAccount, currentBlankSessionId, sessionOrderByAccount])
  useEffect(() => {
    if (workspacePhase !== 'ready') return
    actions.retainAccountKeys([
      UNGROUPED_KEY,
      FLAT_SESSION_ORDER_KEY,
      ...workspaces.map(workspace => workspace.workspaceId as string),
    ])
  }, [actions.retainAccountKeys, workspacePhase, workspaces])
  // The query outlives the tree and the input (both wide-only) so collapsing
  // does not silently drop an in-progress filter.
  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const normalizedQuery = sanitizeSearchQuery(query).trim()
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({
    query: '',
    status: 'idle',
    items: [],
    hasMore: false,
  })
  const searchRoot = useRef<HTMLDivElement | null>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)
  // Section-header ＋ opens the picker menu (same popover in wide and rail
  // states; the menu anchors on this button).
  const [wsPickerOpen, setWsPickerOpen] = useState(false)
  const wsPlusRef = useRef<HTMLButtonElement>(null)
  const composingRef = useRef(false)

  // 空白区右键菜单（需求 4）：pointer 坐标定位的自绘浮层。
  const [blankMenu, setBlankMenu] = useState<{ x: number; y: number } | null>(null)

  // 批量操作（需求 5，v3）：点击批量图标弹「批量操作工作区/会话」菜单，选中后
  // 对应类型行显示勾选框；工具条（统计+确认+取消）出现在工作区标题下方。
  const [bulkType, setBulkType] = useState<'workspace' | 'session' | null>(null)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [bulkSelection, setBulkSelection] = useState<ReadonlyMap<string, 'session' | 'workspace'>>(new Map())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDone, setBulkDone] = useState<string | null>(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // 标签筛选器（v0.4.0：标题栏筛选按钮 + 多条件行面板），浏览器本地状态，不持久化。
  const [tagFilter, setTagFilter] = useState<TagFilter>({
    enabled: false,
    rules: [],
  })
  // 筛选命中总数（由 SessionTree 汇报），供筛选面板「已筛选 N 项」展示。
  const [filterResultCount, setFilterResultCount] = useState(0)

  const bulkToggle = (key: string, kind: 'session' | 'workspace'): void => {
    if (bulkType !== null && bulkType !== kind) return
    setBulkSelection((prev) => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, kind)
      return next
    })
  }
  const bulkExit = (): void => {
    setBulkType(null)
    setBulkMenuOpen(false)
    setBulkSelection(new Map())
    setBulkDone(null)
    setBulkError(null)
    setBulkConfirmOpen(false)
  }
  // 一键折叠所有工作区（需求 7）：遍历真实 Workspace，将各自 groupExpansion 置 false。
  const collapseAllWorkspaces = (): void => {
    if (groupBy === 'flat') return
    for (const ws of workspaces) actions.setGroupExpanded(ws.workspaceId, false)
  }
  const sessionSelection = [...bulkSelection.entries()]
    .filter(([, kind]) => kind === 'session').map(([key]) => key)
  const workspaceSelection = [...bulkSelection.entries()]
    .filter(([, kind]) => kind === 'workspace').map(([key]) => key)
  // 批量归档：逐会话 archiveSession（无删除 API，归档即最接近删除的语义）。
  const runBulkArchive = async (): Promise<void> => {
    if (bulkBusy || sessionSelection.length === 0) return
    setBulkBusy(true)
    setBulkError(null)
    try {
      let failed = 0
      for (const id of sessionSelection) {
        try { await archiveSession(id as SessionId) } catch { failed += 1 }
      }
      setBulkDone(t('bulk.archiveDone', { n: sessionSelection.length - failed }))
      setBulkSelection(new Map())
    } finally {
      setBulkBusy(false)
    }
  }
  // 批量删除工作区：先归档其中全部会话（避免 未分组 orphans），再删除注册。
  const runBulkDelete = async (): Promise<void> => {
    if (bulkBusy || workspaceSelection.length === 0) return
    setBulkConfirmOpen(false)
    setBulkBusy(true)
    setBulkError(null)
    try {
      let failed = 0
      for (const workspaceId of workspaceSelection) {
        try {
          const target = workspaces.find(w => w.workspaceId === workspaceId)
          if (target !== undefined) {
            for (const sessionId of target.sessionIds) {
              try { await archiveSession(sessionId) } catch { /* 会话归档失败不阻断删除注册 */ }
            }
          }
          await deleteWorkspace(workspaceId as WorkspaceId)
        } catch { failed += 1 }
      }
      setBulkDone(t('bulk.deleteDone', { n: workspaceSelection.length - failed }))
      setBulkSelection(new Map())
    } finally {
      setBulkBusy(false)
    }
  }

  // Rail search = expand + land in the search box: the flag arms before the
  // expand request; once the shell flips wide the input mounts and takes focus.
  const [searchOnExpand, setSearchOnExpand] = useState(false)
  useEffect(() => {
    if (wide && searchOnExpand) {
      const timer = window.setTimeout(() => {
        searchInput.current?.focus({ preventScroll: true })
        setSearchOnExpand(false)
      }, EXPAND_SLIDE_MS)
      return () => { window.clearTimeout(timer) }
    }
  }, [wide, searchOnExpand])

  useEffect(() => {
    if (!wide || !searchExpanded || searchOnExpand) return
    searchInput.current?.focus({ preventScroll: true })
  }, [wide, searchExpanded, searchOnExpand])

  // Outside-click dismissal stays off while the rail gesture is in flight
  // (searchOnExpand): the rail click flips the shell wide and mounts this
  // listener during its own dispatch, then keeps bubbling to document with
  // the now-unmounted rail button as its target — outside searchRoot, so the
  // listener would dismiss the search that click just opened.
  useEffect(() => {
    if (!wide || !searchExpanded || searchOnExpand) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return
      searchInput.current?.blur()
      if (normalizedQuery !== '') return
      setSearchExpanded(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [normalizedQuery, wide, searchExpanded, searchOnExpand])

  useEffect(() => {
    if (normalizedQuery === '') {
      setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemoteSearch({
      query: normalizedQuery,
      status: 'loading',
      items: [],
      hasMore: false,
    })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: normalizedQuery,
          status: 'ready',
          items: result.items,
          hasMore: result.hasMore,
        })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: normalizedQuery,
          status: 'error',
          items: [],
          hasMore: false,
        })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Rename dialog (browser-owned so it outlives row unmounts during collapse).
  const [renameTarget, setRenameTarget] = useState<{ workspaceId: WorkspaceId; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
    && workspaces.some(w => w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === ''
    || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate
  const closeRename = () => {
    if (renaming) return
    setRenameTarget(null)
    setRenameError(null)
  }
  const confirmRename = () => {
    if (renameBlocked) return
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Session rename dialog (same browser-owned pattern as workspace rename;
  // sessions have no client-side name-conflict rule — the host normalizes).
  // Unlike workspace rename, an unchanged title is NOT blocked: confirming
  // the current automatic title is the gesture that pins it.
  const [sessionRenameTarget, setSessionRenameTarget] = useState<{ sessionId: SessionNode['id']; currentTitle: string } | null>(null)
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionRenameError, setSessionRenameError] = useState<string | null>(null)
  const sessionRenameTrimmed = sessionRenameDraft.trim()
  const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === '' || sessionRenameTarget === null
  const closeSessionRename = () => {
    if (sessionRenaming) return
    setSessionRenameTarget(null)
    setSessionRenameError(null)
  }
  const confirmSessionRename = () => {
    if (sessionRenameBlocked) return
    setSessionRenaming(true)
    setSessionRenameError(null)
    renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
      setSessionRenaming(false)
      setSessionRenameTarget(null)
    }).catch((reason: unknown) => {
      setSessionRenaming(false)
      setSessionRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onSessionRename = (sessionId: SessionNode['id'], currentTitle: string) => {
    setSessionRenameTarget({ sessionId, currentTitle })
    setSessionRenameDraft(currentTitle)
    setSessionRenameError(null)
  }

  // Archive is dialog-free: not destructive (the log and the accounting slot
  // remain), so the menu action commits directly; the row disappears when the
  // archive-set echo lands. Failures are non-fatal console diagnostics, the
  // same posture as reorder rejections.
  const onSessionArchive = (sessionId: SessionNode['id']) => {
    archiveSession(sessionId).catch((reason: unknown) => {
      console.warn('session archive rejected:', reason)
    })
  }

  // Delete dialog is separate from the row so a successful removal can
  // unmount that row without tearing down the in-flight confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<{ workspaceId: WorkspaceId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteCommittedId, setDeleteCommittedId] = useState<WorkspaceId | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  useEffect(() => {
    if (deleteCommittedId === null
      || workspaces.some(workspace => workspace.workspaceId === deleteCommittedId)) return
    setDeleting(false)
    setDeleteCommittedId(null)
    setDeleteTarget(null)
  }, [deleteCommittedId, workspaces])
  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }
  const confirmDelete = () => {
    /* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteCommittedId(null)
    setDeleteError(null)
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      // Keep the confirmation pending until this component has rendered the
      // committed list projection without the deleted id. Closing earlier
      // exposes one stale React frame to the next Create Workspace gesture.
      setDeleteCommittedId(deleteTarget.workspaceId)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <div className={clsx(css.root, !wide && css.rail)}>
      {/* 需求 6（v4）：默认模式选择器置于侧栏品牌文字下方、新会话按钮下方（浏览区顶部），
          全宽输入框风格（与 newSession 按钮同款：高 38、圆角 12、带边框）。
          收缩边栏（rail）时只显示模式图标。 */}
      {groupBy === 'workspace' && (
        <AgentPresetDefaultSelector
          list={agentPresetDefault.list}
          current={agentPresetDefault.current}
          setDefault={agentPresetDefault.setDefault}
          t={t}
          compact={!wide}
        />
      )}
      <div className={css.sectionHeader}>
        {wide && (
          <span className={clsx(css.sectionLabel, css.wide, searchExpanded && css.sectionLabelHidden)}>
            {groupBy === 'flat' ? t('section.sessions') : t('section.workspaces')}
          </span>
        )}
        {wide && (
          <div className={clsx(css.searchSlot, searchExpanded && css.searchSlotExpanded)}>
            <div
              ref={searchRoot}
              className={clsx(css.search, searchExpanded && css.searchExpanded)}
              onClick={() => {
                setWsPickerOpen(false)
                setSearchExpanded(true)
                searchInput.current?.focus()
              }}
            >
              <Tooltip label={t('search')} side="bottom" delayMs={500} disabled={searchExpanded}>
                <button
                  type="button"
                  className={css.searchButton}
                  aria-label={t('search.sessions.aria')}
                  aria-expanded={searchExpanded}
                  onClick={() => {
                    setWsPickerOpen(false)
                    setSearchExpanded(true)
                  }}
                >
                  <IconSearchOutline16 size={searchExpanded ? 11 : 14} />
                </button>
              </Tooltip>
              <input
                ref={searchInput}
                className={css.searchInput}
                type="text"
                placeholder={t('search.placeholder')}
                maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
                value={query}
                tabIndex={searchExpanded ? 0 : -1}
                onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  setQuery('')
                  setSearchExpanded(false)
                }}
              />
              {searchExpanded && (
                <button
                  type="button"
                  className={css.clearButton}
                  aria-label={t('search.clear')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setQuery('')
                    setSearchExpanded(false)
                  }}
                >
                  <IconCloseFill14 />
                </button>
              )}
            </div>
          </div>
        )}
        <div className={clsx(css.headerActions, wide && searchExpanded && css.headerActionsHidden)}>
          {/* 需求 7：一键折叠所有工作区（仅分组视图）。 */}
          {wide && groupBy === 'workspace' && (
            <Tooltip label={t('collapseAll.aria')} side="bottom" delayMs={500}>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('collapseAll.aria')}
                onClick={collapseAllWorkspaces}
              >
                <IconChevronUpOutline14 size={14} />
              </button>
            </Tooltip>
          )}
          {/* 需求 5（v3）：批量图标点击弹菜单——批量操作工作区 / 批量操作会话。 */}
          {wide && (
            <Menu
              open={bulkMenuOpen}
              onClose={() => { setBulkMenuOpen(false) }}
              items={[
                { id: 'workspace', label: t('bulk.workspaces') },
                { id: 'session', label: t('bulk.sessions') },
              ]}
              onSelect={(kind) => {
                setBulkMenuOpen(false)
                setBulkSelection(new Map())
                setBulkDone(null)
                setBulkError(null)
                setBulkConfirmOpen(false)
                setBulkType(kind as 'workspace' | 'session')
              }}
              align="end"
              portal
              anchor={(
                <Tooltip label={t('bulk.enter')} side="bottom" delayMs={500}>
                  <button
                    type="button"
                    className={clsx(css.iconButton, bulkType !== null && css.bulkActiveIcon)}
                    aria-label={t('bulk.enter')}
                    aria-expanded={bulkMenuOpen || bulkType !== null}
                    aria-pressed={bulkType !== null}
                    onClick={() => { if (bulkType !== null) bulkExit(); else setBulkMenuOpen(v => !v) }}
                  >
                    <IconChecklistOutline14 size={14} />
                  </button>
                </Tooltip>
              )}
            />
          )}
          {wide && (
            <ViewOptionsMenu
              groupBy={groupBy}
              orderBy={orderBy}
              onGroupPick={(mode) => { actions.setGroupBy(mode) }}
              onOrderPick={(mode) => { actions.setOrderBy(mode) }}
              t={t}
            />
          )}
          {/* 标签筛选（v0.4.0）：仅宽侧栏显示；点击弹出多条件筛选面板（portal）。 */}
          {wide && taggerSettings !== undefined && (
            <FilterButton
              settings={taggerSettings}
              t={taggerT}
              filter={tagFilter}
              onChange={setTagFilter}
              resultCount={filterResultCount}
            />
          )}
          {/* Adding is the button's one action, so a composition with no
              picking affordance has nothing to offer here: the region hides the
              button rather than leaving a dead one in the header. */}
          {directoryFlowAvailable && (
            <Tooltip label={t('workspace.add')} side="bottom" delayMs={500}>
              <button
                ref={wsPlusRef}
                type="button"
                className={css.iconButton}
                aria-label={t('workspace.add')}
                onClick={() => {
                  setWsPickerOpen(v => !v)
                }}
              >
                <IconProjectAddOutline16 size={wide ? 16 : 18} />
              </button>
            </Tooltip>
          )}
        </div>
        {/* Add flow + its error dialog (same package — direct composition). */}
        <WorkspacePickFlow
          t={t}
          open={wsPickerOpen}
          anchorRef={wsPlusRef}
          useWorkspaces={useWorkspaces}
          createWorkspace={createWorkspace}
          useDirectoryFlow={useDirectoryFlow}
          renderDirectoryFlow={owner => renderSlot('sidebar.workspaces.directoryFlow', owner)}
          addOnly
          side="right"
          onPick={(workspaceId) => {
            setWsPickerOpen(false)
            startSession(workspaceId)
          }}
          onClose={() => { setWsPickerOpen(false) }}
        />
      </div>

      {/* The collapsed rail keeps search as its own 36px control. */}
      {!wide && <div className={css.search}>
        <Tooltip label={t('search')}>
          <button
            type="button"
            className={css.searchButton}
            aria-label={t('search.sessions.aria')}
            onClick={() => {
              setSearchExpanded(true)
              setSearchOnExpand(true)
              expandSidebar()
            }}
          >
            <IconSearchOutline16 size={18} />
          </button>
        </Tooltip>
      </div>}

      {/* 批量操作工具条（需求 5，v3）：位于工作区标题下方、列表上方。
          统计（已选 n 项）在上，确认/取消在下。确认执行所选类型操作：
          session → 归档；workspace → 打开删除确认弹窗。 */}
      {bulkType !== null && (
        <div className={css.bulkToolbar} role="toolbar" aria-label={t('bulk.enter')}>
          <span className={css.bulkCount} role="status">
            {bulkType === 'workspace'
              ? t('bulk.selectedWorkspaces', { n: workspaceSelection.length })
              : t('bulk.selectedSessions', { n: sessionSelection.length })}
          </span>
          <div className={css.bulkActions}>
            <Button
              variant="primary"
              size="sm"
              disabled={bulkBusy || bulkSelection.size === 0}
              onClick={() => {
                if (bulkType === 'workspace') setBulkConfirmOpen(true)
                else void runBulkArchive()
              }}
            >
              {t('bulk.confirm')}
            </Button>
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={bulkExit}>
              {t('bulk.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Always-mounted seat keeps the region's flex slot while the list
          itself is wide-only. */}
      <div
        className={css.listArea}
        onContextMenu={(e) => {
          // 空白区右键（需求 4）：目标是行（treeitem）时不触发（行有自己的右键）。
          if (e.target instanceof Element && e.target.closest('[role="treeitem"]') !== null) return
          e.preventDefault()
          setBlankMenu({ x: e.clientX, y: e.clientY })
        }}
        onClick={() => {
          if (blankMenu !== null) setBlankMenu(null)
        }}
      >
        {wide && (normalizedQuery !== ''
          ? (
            <SearchResults
              useSessions={useSessions}
              useSessionPendingInteraction={useSessionPendingInteraction}
              open={open}
              workspaces={workspaces}
              archivedSessionIds={archivedSessionIds}
              query={normalizedQuery}
              remote={remoteSearch}
              resultLimit={searchResultLimit}
              tagger={rowTagger}
              t={t}
            />
          )
          : groupBy === 'flat'
            ? (
              <FlatList
                useSessions={useSessions} useSessionPendingInteraction={useSessionPendingInteraction}
                open={open} forkSession={forkSession}
                onSessionRename={onSessionRename} onSessionArchive={onSessionArchive}
                archivedSessionIds={archivedSessionIds}
                orderBy={orderBy}
                sessionOrderByAccount={sessionOrderByAccount}
                sessionUpdatedAtByAccount={sessionUpdatedAtByAccount}
                syncSessionOrderAccount={actions.syncSessionOrderAccount}
                setSessionOrder={actions.setSessionOrder}
                pinnedSessionIds={pinnedSessionIds}
                onTogglePinSession={actions.togglePinSession}
                bulkType={bulkType}
                bulkSelection={bulkSelection}
                onBulkToggle={bulkToggle}
                tagger={rowTagger}
                t={t}
              />
            )
            : (
              <SessionTree
                useSessions={useSessions}
                useSessionPendingInteraction={useSessionPendingInteraction}
                onSessionRename={onSessionRename}
                onSessionArchive={onSessionArchive}
                forkSession={forkSession}
                workspaces={workspaces}
                groupExpansion={groupExpansion}
                setGroupExpanded={actions.setGroupExpanded}
                sessionOrderByAccount={sessionOrderByAccount}
                sessionUpdatedAtByAccount={sessionUpdatedAtByAccount}
                syncSessionOrderAccount={actions.syncSessionOrderAccount}
                setSessionOrder={actions.setSessionOrder}
                archivedSessionIds={archivedSessionIds}
                startSession={startSession}
                open={open}
                insertWorkspaceBefore={insertWorkspaceBefore}
                insertSessionBefore={insertSessionBefore}
                orderBy={orderBy}
                home={home}
                t={t}
                pinnedWorkspaceIds={pinnedWorkspaceIds}
                pinnedSessionIds={pinnedSessionIds}
                onTogglePinWorkspace={actions.togglePinWorkspace}
                onTogglePinSession={actions.togglePinSession}
                bulkType={bulkType}
                bulkSelection={bulkSelection}
                onBulkToggle={bulkToggle}
                tagger={rowTagger}
                tagFilter={groupBy === 'workspace' ? tagFilter : undefined}
                onFilteredCountChange={setFilterResultCount}
                onRenameRequest={(workspaceId, currentTitle) => {
                  setRenameTarget({ workspaceId, currentTitle })
                  setRenameDraft(currentTitle)
                  setRenameError(null)
                }}
                onDeleteRequest={(workspaceId, title) => {
                  setDeleteTarget({ workspaceId, title })
                  setDeleteError(null)
                }}
                onRenameWorkspace={renameWorkspace}
              />
            ))}
      </div>


      <Modal
        open={renameTarget !== null}
        onClose={closeRename}
        closeLabel={t('close')}
        title={t('rename.workspace.title')}
        footer={(
          <>
            <Button variant="outline" disabled={renaming} onClick={closeRename}>{t('cancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('rename')}</Button>
          </>
        )}
      >
        <input
          className={css.renameInput}
          value={renameDraft}
          aria-label={t('field.workspaceName')}
          autoFocus
          disabled={renaming}
          onFocus={(e) => { e.target.select() }}
          onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null) }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !composingRef.current) {
              e.preventDefault()
              confirmRename()
            }
          }}
        />
        {renameDuplicate && (
          <div className={css.renameError} role="alert">{t('conflict.named', { name: renameTrimmed })}</div>
        )}
        {renameError !== null && <div className={css.renameError} role="alert">{renameError}</div>}
      </Modal>

      <Modal
        open={sessionRenameTarget !== null}
        onClose={closeSessionRename}
        closeLabel={t('close')}
        title={t('rename.session.title')}
        footer={(
          <>
            <Button variant="outline" disabled={sessionRenaming} onClick={closeSessionRename}>{t('cancel')}</Button>
            <Button variant="primary" disabled={sessionRenameBlocked} onClick={confirmSessionRename}>{t('rename')}</Button>
          </>
        )}
      >
        <input
          className={css.renameInput}
          value={sessionRenameDraft}
          aria-label={t('field.sessionName')}
          autoFocus
          disabled={sessionRenaming}
          onFocus={(e) => { e.target.select() }}
          onChange={(e) => { setSessionRenameDraft(e.target.value); setSessionRenameError(null) }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !composingRef.current) {
              e.preventDefault()
              confirmSessionRename()
            }
          }}
        />
        {sessionRenameError !== null && <div className={css.renameError} role="alert">{sessionRenameError}</div>}
      </Modal>
      <Modal
        open={deleteTarget !== null}
        onClose={closeDelete}
        closeLabel={t('close')}
        title={t('delete.workspace')}
        {...deleteTarget === null
          ? {}
          : { description: t('delete.desc', { name: deleteTarget.title }) }}
        footer={(
          <>
            <Button variant="outline" disabled={deleting} onClick={closeDelete}>{t('cancel')}</Button>
            <Button
              variant="outline"
              className={css.deleteAction}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {t('delete.workspace')}
            </Button>
          </>
        )}
      >
        {deleting && <div className={css.deleteStatus} role="status">{t('delete.pending')}</div>}
        {deleteError !== null && <div className={css.renameError} role="alert">{deleteError}</div>}
      </Modal>

      {/* 标签子系统（集成自 dsh-workspace-tagger）：设置工作区/会话标签弹窗。
          条件渲染：仅在 tagTarget 非空时挂载，弹窗关闭即卸载（内部 state 随打开重置）。 */}
      {tagTarget !== null && (
        <TagDialog
          title={tagTarget.kind === 'workspace' ? taggerT('dialog.workspaceTitle') : taggerT('dialog.sessionTitle')}
          settings={rowTagger.settings}
          current={tagTarget.kind === 'workspace'
            ? (rowTagger.settings?.workspaceTags[tagTarget.id] ?? null)
            : (rowTagger.settings?.sessionTags[tagTarget.id] ?? null)}
          t={taggerT}
          controller={tagger}
          onAssign={async (tagId) => {
            if (tagTarget.kind === 'workspace') await tagger.assignWorkspaceTag(tagTarget.id, tagId)
            else await tagger.assignSessionTag(tagTarget.id, tagId)
          }}
          onClose={() => { setTagTarget(null) }}
        />
      )}

      {/* 批量删除工作区确认（需求 5）：诚实说明「会话先归档、数据保留在磁盘」。 */}
      <Modal
        open={bulkConfirmOpen}
        onClose={() => { setBulkConfirmOpen(false) }}
        closeLabel={t('close')}
        title={t('bulk.confirmDeleteTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={bulkBusy} onClick={() => { setBulkConfirmOpen(false) }}>{t('bulk.cancel')}</Button>
            <Button
              variant="outline"
              className={css.deleteAction}
              disabled={bulkBusy}
              onClick={() => { void runBulkDelete() }}
            >
              {t('bulk.confirmDelete')}
            </Button>
          </>
        )}
      >
        <div className={css.bulkConfirmBody}>
          {t('bulk.confirmDeleteBody', { n: workspaceSelection.length })}
        </div>
        {bulkBusy && <div className={css.deleteStatus} role="status">{t('delete.pending')}</div>}
        {bulkError !== null && <div className={css.renameError} role="alert">{bulkError}</div>}
      </Modal>

      {/* 批量执行完成提示（非阻塞，点击退出）。 */}
      {bulkDone !== null && bulkType !== null && (
        <div className={css.bulkDone} role="status">
          <span>{bulkDone}</span>
          <button type="button" className={css.iconButton} aria-label={t('close')} onClick={bulkExit}>
            <IconCloseFill14 />
          </button>
        </div>
      )}

      {/* 空白区右键菜单（需求 4，修改 3）：与 ··· 菜单同一 Menu 组件，
          锚点为鼠标位置（左上角），视觉/交互与行菜单完全一致。 */}
      {blankMenu !== null && (
        <Menu
          open={blankMenu !== null}
          onClose={() => { setBlankMenu(null) }}
          items={[
            { id: 'new-workspace', label: t('blank.newWorkspace'), icon: <IconProjectAddOutline16 size={16} /> },
            { id: 'new-session', label: t('blank.newSession'), icon: <IconNewChatOutline16 size={16} /> },
          ]}
          onSelect={(id) => {
            setBlankMenu(null)
            if (id === 'new-workspace') setWsPickerOpen(true)
            if (id === 'new-session') startSession(undefined)
          }}
          align="start"
          side="bottom"
          portal
          getAnchorRect={() => new DOMRect(blankMenu.x, blankMenu.y, 0, 0)}
          anchor={null}
        />
      )}
    </div>
  )
}
