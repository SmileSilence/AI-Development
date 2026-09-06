/**
 * dsh-workspace-tagger — TaggerController：settingsScope 的领域封装。
 *
 * 同时扮演两个角色：
 *  - HostObservable 面（getSnapshot/subscribe）——供插槽渲染器绑定为
 *    useTagger 选择器 hook（行组件/设置页读快照）。
 *  - 动作面——供行菜单/弹窗/设置页发起原子写入（全部走 scope.mutate，
 *    修订栅栏与冲突恢复由 settings 域负责）。
 */
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { TagDefinition, WorkspaceTaggerSettings } from './settings-types.ts'
import {
  appendTagOps,
  assignmentOps,
  clampSplitRatio,
  deleteTagOps,
  nextTagId,
  updateTagOps,
  type TagMutateOp,
} from './tag-store.ts'

/** 控制器对外接口（hooks + 动作）。 */
export interface TaggerController {
  // —— HostObservable 面 ——
  getSnapshot(): SettingsScopeSnapshot<WorkspaceTaggerSettings>
  subscribe(listener: () => void): () => void

  // —— 动作面 ——
  /** 写入/清除工作区标签分配（tagId=null 清除）。 */
  assignWorkspaceTag(workspaceId: string, tagId: string | null): Promise<void>
  /** 写入/清除会话标签分配。 */
  assignSessionTag(sessionId: string, tagId: string | null): Promise<void>
  /** 新增标签并返回它（供下拉自动选中）。 */
  addTag(name: string, color: string): Promise<TagDefinition>
  /** 更新标签名称/颜色。 */
  updateTag(tagId: string, patch: Partial<Pick<TagDefinition, 'name' | 'color'>>): Promise<void>
  /** 删除标签（原子清理全部引用）。 */
  deleteTag(tagId: string): Promise<void>
  /** 设置/清除运行会话标签。 */
  setRunningTag(tagId: string | null): Promise<void>
  /** 设置双色胶囊前段占比（0.1–0.9）。 */
  setSplitRatio(ratio: number): Promise<void>
  /** 保存一个自定义预设颜色（去重、上限）。 */
  saveCustomColor(hex: string): Promise<void>
}

/** 构造控制器。 */
export function createTaggerController(scope: SettingsScope<WorkspaceTaggerSettings>): TaggerController {
  /** 当前已接受的设置（未就绪时以默认空对象兜底，动作在未就绪时被上层禁用）。 */
  const current = (): WorkspaceTaggerSettings => scope.getSnapshot().value ?? {
    tags: [], workspaceTags: {}, sessionTags: {}, runningTagId: null, splitRatio: 0.35, customColors: [],
  }

  const mutate = (ops: TagMutateOp[]): Promise<void> =>
    // 业务层 ops → 线上 SettingsPathOpView（值本就 JSON 形状）。
    scope.mutate(ops as readonly SettingsPathOpView[])

  return {
    getSnapshot: () => scope.getSnapshot(),
    subscribe: (listener) => scope.subscribe(listener),

    async assignWorkspaceTag(workspaceId, tagId) {
      await mutate(assignmentOps('workspaceTags', workspaceId, tagId))
    },

    async assignSessionTag(sessionId, tagId) {
      await mutate(assignmentOps('sessionTags', sessionId, tagId))
    },

    async addTag(name, color) {
      const settings = current()
      const tag: TagDefinition = { id: nextTagId(settings.tags), name: name.trim(), color }
      await mutate(appendTagOps(settings, tag))
      return tag
    },

    async updateTag(tagId, patch) {
      await mutate(updateTagOps(current(), tagId, patch))
    },

    async deleteTag(tagId) {
      const { ops } = deleteTagOps(current(), tagId)
      if (ops.length === 0) return
      await mutate(ops)
    },

    async setRunningTag(tagId) {
      await mutate(tagId === null
        ? [{ op: 'set', path: ['runningTagId'], value: null }]
        : [{ op: 'set', path: ['runningTagId'], value: tagId }])
    },

    async setSplitRatio(ratio) {
      await mutate([{ op: 'set', path: ['splitRatio'], value: clampSplitRatio(ratio) }])
    },

    async saveCustomColor(hex) {
      const settings = current()
      const next = [hex, ...settings.customColors.filter(c => c !== hex)].slice(0, 12)
      if (next.length === settings.customColors.length && next.every((c, i) => c === settings.customColors[i])) return
      await mutate([{ op: 'set', path: ['customColors'], value: next }])
    },
  }
}
