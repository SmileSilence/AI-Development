/**
 * smilexx-workspace-enhancer — Client 半部（M1 fork 移植版）。
 *
 * 复刻上游 @deepseek-ai/dsh-client-ui-workspace 的 index.ts 注册逻辑：
 *   - 替换 sidebar.workspaces single slot（我们的 fork WorkspaceBrowser）
 *   - 保留 WorkspacePicker（conversation.hero.workspace）注册，否则新建工作区流程缺失
 *   - inject 工厂从 ctx.sessions / ctx.workspaces / ctx.remote 提供全部 Host actions
 *     （startSession / open / search / rename / fork / archive / delete / create / reorder）
 *
 * 后续里程碑在 fork 组件上叠加增强（置顶/右键/批量/默认模式），入口本身只需增加
 * 相应的 inject 字段与注册参数。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteHostFacts } from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the Controller service merges.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session root standard-hook merge.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the settingsScope service merge (ctx.settingsScope).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WorkspaceBrowserInjected, WorkspacePickerInjected } from './contract/slots.ts'
import { UiWorkspaceService } from './navigation.ts'
import { createWorkspaceViewStore } from './stores.ts'
import { WorkspaceBrowser } from './browser/WorkspaceBrowser.tsx'
import { WorkspacePicker } from './WorkspacePicker.tsx'
import { en, zh, type WorkspaceKey } from './locales.ts'
import {
  WorkspaceBrowserRaw, RowsRaw, WorkspacePickerRaw, TagDialogRaw, TagsSettingsTabRaw,
} from './styles/raw.ts'
// ——— 标签子系统（集成自 dsh-workspace-tagger）———
import { SETTINGS_NAMESPACE } from './tags/settings-types.ts'
import type { WorkspaceTaggerSettings } from './tags/settings-types.ts'
import { createTaggerController, type TaggerController } from './tags/tagger-controller.ts'
import { en as taggerEn, zh as taggerZh, type TaggerKey } from './tags/locales.ts'
import { TagsSettingsTab, type TagsSettingsTabInjected } from './tags/settings/TagsSettingsTab.tsx'

export type {
  DirectoryFlowOwnerProps, DirectoryFlowSlotName, DirectoryPickingHooks, DirectoryPickingInjected,
  WorkspaceBrowserInjected, WorkspaceBrowserProps, WorkspacePickerInjected, WorkspacePickerProps,
} from './contract/slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface GlobalStandardProps {
    /** Selector hook over the pure Workspace Controller snapshot. */
    useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>
  }

  interface LocaleNamespaceMap {
    /** The workspace browsing region and pick/create flow copy (独立 NS，避免与
     * 官方 ui-workspace / dsh-archive-manager 的 `workspace` 冲突)。 */
    'workspace-enhancer': WorkspaceKey
    /** 标签子系统文案（集成自 dsh-workspace-tagger）。 */
    'workspace-tagger': TaggerKey
  }
}

/** Dictionary namespace owned by this plugin（独立 NS，不与官方 workspace 冲突）。 */
const NS = 'workspace-enhancer'

/** 单实例工作区插槽的后备优先级；常规插件默认 0，因此会自然覆盖本界面。 */
export const WORKSPACE_FALLBACK_PRIORITY = 10_000

/**
 * Required services (cordis fiber inject). Same set as upstream ui-workspace,
 * plus the two remote namespaces the default-mode selector (需求 6) reads:
 * `remote.agentPresets` (roster) and `remote.settings` (current default read
 * and write). Cordis denies accessing an undeclared ctx property, so each
 * remote namespace used must be injected.
 */
export const inject = [
  'slots', 'sessions', 'workspaces', 'locale', 'remote', 'remote.directoryPicker',
  'remote.agentPresets', 'remote.settings', 'settingsScope',
]

/**
 * Register the browser and picker once their slot declarations are on the
 * ledger. Inject factories return plain callbacks; data reads use the
 * framework's global hooks.
 */
export function apply(ctx: Context): void {
  // 注入 fork 的 CSS（加载器不支持 CSS import；同 rewind/chat-import 的
  // <style> 注入模式，effect 持有清理）。
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.pluginCss = 'smilexx-workspace-enhancer'
    style.textContent = `${WorkspaceBrowserRaw}\n${RowsRaw}\n${WorkspacePickerRaw}\n${TagDialogRaw}\n${TagsSettingsTabRaw}`
    document.head.appendChild(style)
    return () => style.remove()
  }, 'workspace-enhancer: styles')

  const sessions = ctx.get('sessions') as ISessions
  const workspaces = ctx.get('workspaces') as IWorkspaces
  const uiWorkspace = new UiWorkspaceService(
    ctx, ctx.remote.directoryPicker, workspaces, sessions)
  ctx.slots.provideRoot({ hooks: { workspaces: workspaces.list } })
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workspace-enhancer: dictionaries')
  // 标签子系统文案（集成自 dsh-workspace-tagger，独立命名空间）。
  ctx.effect(() => ctx.locale.register(SETTINGS_NAMESPACE, { zh: taggerZh, en: taggerEn }), 'workspace-enhancer: tagger dictionaries')

  // 标签子系统（集成自 dsh-workspace-tagger）：settingsScope 绑定 → TaggerController。
  // Host config.tags.enabled=false 时不注册 schema → 本 scope 无数据 → 控制器不可用，
  // Client 侧标签 UI 进入不可用态（开关语义由 Host 侧 schema 注册与否体现）。
  const taggerScope = ctx.settingsScope.bind<WorkspaceTaggerSettings>({ namespace: SETTINGS_NAMESPACE })
  const taggerController: TaggerController = createTaggerController(taggerScope)
  const taggerObservable: HostObservable<SettingsScopeSnapshot<WorkspaceTaggerSettings>> = {
    getSnapshot: () => taggerScope.getSnapshot(),
    subscribe: listener => taggerScope.subscribe(listener),
  }
  const taggerT = ctx.locale.bind(SETTINGS_NAMESPACE)

  const searchSessions: WorkspaceBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  // Stable per-surface occupancy sources.
  const flowSource = (hole: 'sidebar.workspaces.directoryFlow' | 'conversation.hero.workspace.directoryFlow'): HostObservable<boolean> => ({
    getSnapshot: () => ctx.slots.entries(hole).length > 0,
    subscribe: listener => ctx.slots.subscribe(hole, listener),
  })
  const hostInfo: HostObservable<RemoteHostFacts> = {
    getSnapshot: () => ctx.remote.$host,
    subscribe: listener => ctx.on('connection/reset', listener),
  }
  const pickerFlowSource = flowSource('conversation.hero.workspace.directoryFlow')
  const browserInjected = (): WorkspaceBrowserInjected => ({
    startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId) },
    open: (sessionId) => { sessions.open(sessionId) },
    searchSessions,
    searchResultLimit: sessions.searchResultLimit,
    renameSession: async (sessionId, title) => {
      const session = sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    forkSession: (sessionId) => {
      sessions.fork({ sessionId, increaseTitle: true })
        .then((childId) => { sessions.open(childId) })
        .catch(() => { /* fork or child-rename failure keeps the current selection */ })
    },
    renameWorkspace: async (workspaceId, title) => { await workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    archiveSession: async (sessionId) => { await uiWorkspace.archiveSession(sessionId) },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => workspaces.create(input),
    pickDirectory: () => uiWorkspace.pickDirectory(),
    agentPresetDefault,
    // 标签子系统（集成自 dsh-workspace-tagger）：快照 observable → useTagger hook、
    // 动作面控制器、标签命名空间文案。
    tagger: taggerController,
    taggerT,
    hooks: { hostInfo, tagger: taggerObservable },
  })
  // 需求 6：会话默认模式（写 settings `agent-presets.default`，绝不 agentPresets.select）。
  const agentPresetDefault: WorkspaceBrowserInjected['agentPresetDefault'] = {
    list: async () => {
      const result = await ctx.remote.agentPresets.list()
      if (!result.ok) {
        if (result.error.code === 'gateway/invocation-unavailable') return []
        throw new Error(result.error.message)
      }
      return result.value.presets
        .filter(preset => preset.broken === undefined)
        .map(preset => ({
          id: preset.id,
          ...(preset.name === undefined ? {} : { name: preset.name }),
          trust: preset.trust,
        }))
    },
    current: async () => {
      const describe = await ctx.remote.settings.describe()
      if (!describe.ok) return undefined
      const view = describe.value.namespaces.find(ns => ns.ns === 'agent-presets')
      const value = view?.value as { default?: unknown } | undefined
      return typeof value?.default === 'string' ? value.default : undefined
    },
    setDefault: async (id) => {
      const result = await ctx.remote.settings.update('agent-presets', { default: id }, undefined)
      if (!result.ok) throw new Error(result.error.message)
    },
  }
  const pickerInjected = (): WorkspacePickerInjected => ({
    createWorkspace: input => workspaces.create(input),
    hooks: { directoryFlow: pickerFlowSource },
  })
  // 兼容其它工作区插件：不声明公共 directoryFlow 子插槽，并以高数值优先级
  // 作为后备项注册。宿主 single slot 取最低优先级，常规插件默认 0 会自然接管，
  // 两者仍可同时加载，不再发生子插槽重复声明错误。
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      store: createWorkspaceViewStore(),
      inject: browserInjected,
      locale: NS,
      priority: WORKSPACE_FALLBACK_PRIORITY,
    },
    WorkspaceBrowser,
  ))
  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register(
    {
      name: 'conversation.hero.workspace',
      children: { 'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' } },
      inject: pickerInjected,
      locale: NS,
      priority: -100,
    },
    WorkspacePicker,
  ))
  // 标签子系统：设置 → 插件 → 「标签管理」页（集成自 dsh-workspace-tagger，
  // 原 id='tags' / order=20 保持不变，兼容既有数据与入口位置）。
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register(
    {
      name: 'settings.plugins.tab',
      id: 'tags',
      order: 20,
      label: () => ctx.locale.bind(SETTINGS_NAMESPACE)('settings.tab'),
      locale: SETTINGS_NAMESPACE,
      inject: (): TagsSettingsTabInjected => ({
        hooks: { tagger: taggerObservable },
        tagger: taggerController,
      }),
    },
    TagsSettingsTab,
  ))
}
