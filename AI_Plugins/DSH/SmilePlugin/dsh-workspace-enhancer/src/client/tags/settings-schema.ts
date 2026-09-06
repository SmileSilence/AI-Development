/**
 * dsh-workspace-tagger — Host settings 命名空间 schema（workspace-tagger）。
 *
 * 唯一真源位于 Host 侧 settings 域；Client 经 settingsScope 镜像读取。
 * 仅 Host 半部 import（依赖 schemastery，client bundle 外部化 @deepseek-ai/*，
 * 客户端不得引入本文件的值）。
 */
import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_SPLIT_RATIO,
  SPLIT_RATIO_MAX,
  SPLIT_RATIO_MIN,
  type WorkspaceTaggerSettings,
} from './settings-types.ts'

export type { TagDefinition, WorkspaceTaggerSettings } from './settings-types.ts'
export {
  CUSTOM_COLORS_LIMIT,
  DEFAULT_SPLIT_RATIO,
  DEFAULT_TAG_COLOR,
  SETTINGS_NAMESPACE,
  SPLIT_RATIO_MAX,
  SPLIT_RATIO_MIN,
} from './settings-types.ts'

/** 默认设置。 */
export const DEFAULT_SETTINGS: WorkspaceTaggerSettings = {
  tags: [],
  workspaceTags: {},
  sessionTags: {},
  runningTagId: null,
  splitRatio: DEFAULT_SPLIT_RATIO,
  customColors: [],
}

/** schemastery schema（Host ctx.settings.register 使用）。 */
export const WorkspaceTaggerSettingsSchema = z.object({
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
  })).default([]),
  workspaceTags: z.dict(z.string()).default({}),
  sessionTags: z.dict(z.string()).default({}),
  runningTagId: z.union([z.string(), z.const(null)]).default(null),
  splitRatio: z.number().min(SPLIT_RATIO_MIN).max(SPLIT_RATIO_MAX).default(DEFAULT_SETTINGS.splitRatio),
  customColors: z.array(z.string()).default([]),
})
