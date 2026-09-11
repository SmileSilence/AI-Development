/**
 * The workspace browser's viewing store: the session-list grouping mode and
 * the enhancer's pin state, persisted across reloads. Module level exports
 * the factory only (a module-level handle would pin the store identity across
 * plugin reloads); register() receives the factory and the browser derives
 * its PropsStore share from the return type.
 *
 * persist 键用插件自己的命名空间（smilexx-workspace-enhancer:view.v1），不复用官方
 * `dsh.workspace.view.v5`——避免与官方/其他插件共享 LocalStorage（见 PLAN §5.1）。
 * 0.7.3 包改名：createWorkspaceViewStore 首次运行会把旧键
 * dsh-workspace-enhancer:view.v1 的已存视图状态迁移到新键并清理旧键。
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Browser-local order account for the hierarchy-free flat Session list. */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** Session-list grouping mode: workspace sections or one flat recency list. */
export type SessionGroupBy = 'workspace' | 'flat'
/** Session order: user-arranged only, or user-arranged plus activity promotion. */
export type SessionOrderBy = 'manual' | 'updated'

/** Workspace browser viewing state persisted across surface remounts and reloads. */
type WorkspaceViewState = {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  /** Explicit zero-or-five-session state keyed by Workspace group identity. */
  groupExpansion: Record<string, boolean>
  /** Shared editable order per Workspace group plus the browser-local flat-list account. */
  sessionOrderByAccount: Record<string, string[]>
  /** Last observed update timestamps per order account for one-time promotion events. */
  sessionUpdatedAtByAccount: Record<string, Record<string, number>>
  /** 置顶的工作区 id（渲染时排前）。 */
  pinnedWorkspaceIds: string[]
  /** 置顶的会话 id（渲染时排前）。 */
  pinnedSessionIds: string[]
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkspaceViewActions = {
  setGroupBy: (draft: WorkspaceViewState, mode: SessionGroupBy) => void
  setOrderBy: (draft: WorkspaceViewState, mode: SessionOrderBy) => void
  setGroupExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  retainAccountKeys: (draft: WorkspaceViewState, workspaceKeys: readonly string[]) => void
  syncSessionOrderAccount: (
    draft: WorkspaceViewState,
    accountKey: string,
    order: string[],
    updatedAt: Record<string, number>,
  ) => void
  setSessionOrder: (draft: WorkspaceViewState, accountKey: string, order: string[]) => void
  /** Toggle a workspace's pin state; returns the new pinned boolean. */
  togglePinWorkspace: (draft: WorkspaceViewState, workspaceId: string) => boolean
  /** Toggle a session's pin state; returns the new pinned boolean. */
  togglePinSession: (draft: WorkspaceViewState, sessionId: string) => boolean
}

/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  migrateLegacyPersist()
  return defineStore({
    init: (): WorkspaceViewState => ({
      groupBy: 'workspace',
      orderBy: 'updated',
      groupExpansion: {},
      sessionOrderByAccount: {},
      sessionUpdatedAtByAccount: {},
      pinnedWorkspaceIds: [],
      pinnedSessionIds: [],
    }),
    persist: 'smilexx-workspace-enhancer:view.v1',
    actions: {
      setGroupBy: (d, mode: SessionGroupBy) => { d.groupBy = mode },
      setOrderBy: (d, mode: SessionOrderBy) => { d.orderBy = mode },
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainAccountKeys: (d, workspaceKeys: readonly string[]) => {
        const retained = new Set(workspaceKeys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)),
        )
        d.sessionUpdatedAtByAccount = Object.fromEntries(
          Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)),
        )
      },
      syncSessionOrderAccount: (d, accountKey: string, order: string[], updatedAt: Record<string, number>) => {
        d.sessionOrderByAccount[accountKey] = order
        d.sessionUpdatedAtByAccount[accountKey] = updatedAt
      },
      setSessionOrder: (d, accountKey: string, order: string[]) => {
        d.sessionOrderByAccount[accountKey] = order
      },
      togglePinWorkspace: (d, workspaceId: string): boolean => {
        const pinned = d.pinnedWorkspaceIds.includes(workspaceId)
        d.pinnedWorkspaceIds = pinned
          ? d.pinnedWorkspaceIds.filter(id => id !== workspaceId)
          : [...d.pinnedWorkspaceIds, workspaceId]
        return !pinned
      },
      togglePinSession: (d, sessionId: string): boolean => {
        const pinned = d.pinnedSessionIds.includes(sessionId)
        d.pinnedSessionIds = pinned
          ? d.pinnedSessionIds.filter(id => id !== sessionId)
          : [...d.pinnedSessionIds, sessionId]
        return !pinned
      },
    },
  })
}

/**
 * 一次性迁移：0.7.3 包改名后首次创建视图 store 时，把旧 persist 键
 * `dsh-workspace-enhancer:view.v1` 的已存状态搬移到新键并删除旧键。
 * 无旧数据、新键已存在（避免覆盖更新数据）或迁移失败时静默返回。
 */
const LEGACY_VIEW_STORAGE_KEY = 'dsh-workspace-enhancer:view.v1'
const VIEW_STORAGE_KEY = 'smilexx-workspace-enhancer:view.v1'

function migrateLegacyPersist(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const legacy = localStorage.getItem(LEGACY_VIEW_STORAGE_KEY)
    if (legacy === null) return
    if (localStorage.getItem(VIEW_STORAGE_KEY) === null) {
      localStorage.setItem(VIEW_STORAGE_KEY, legacy)
    }
    localStorage.removeItem(LEGACY_VIEW_STORAGE_KEY)
  } catch {
    // 隐私模式 / 配额：静默放弃迁移，store 从 init 起步。
  }
}
