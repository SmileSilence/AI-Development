/**
 * dsh-workspace-tagger — 共享设置类型与常量（Host/Client 两侧共用）。
 *
 * 本文件零依赖（不 import schemastery）：Client bundle 外部化所有
 * @deepseek-ai/*，若引入 schemastery 值会导致运行时
 * “missed the module table” 加载失败；schema 本体在 settings-schema.ts。
 */

/** 一个标签定义。name 全局唯一（非空）；color 为 #RRGGBB。 */
export interface TagDefinition {
  id: string
  name: string
  color: string
}

/** workspace-tagger 命名空间完整设置。 */
export interface WorkspaceTaggerSettings {
  /** 全部标签定义（数组序即下拉展示序）。 */
  tags: TagDefinition[]
  /** workspaceId -> tagId（无标签 = 无条目）。 */
  workspaceTags: Record<string, string>
  /** sessionId -> tagId（无标签 = 无条目）。 */
  sessionTags: Record<string, string>
  /** 运行会话标签；null = 关闭。 */
  runningTagId: string | null
  /** 双色胶囊前段（工作区色）占比 0.1–0.9。 */
  splitRatio: number
  /** 颜色选择器自定义预设（上限 ~12 个）。 */
  customColors: string[]
}

/** 命名空间名（settings 命名空间正则 ^[a-z][a-z0-9-]*$）。 */
export const SETTINGS_NAMESPACE = 'workspace-tagger'

/** 单标签颜色默认值（DSH 主题协调的中性蓝）。 */
export const DEFAULT_TAG_COLOR = '#4f7cff'

/** 双色比例边界。 */
export const SPLIT_RATIO_MIN = 0.1
export const SPLIT_RATIO_MAX = 0.9

/** 自定义预设上限。 */
export const CUSTOM_COLORS_LIMIT = 12

/** 双色比例默认值。 */
export const DEFAULT_SPLIT_RATIO = 0.35
