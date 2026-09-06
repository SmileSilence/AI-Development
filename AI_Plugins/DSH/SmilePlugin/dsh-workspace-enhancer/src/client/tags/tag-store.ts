/**
 * dsh-workspace-tagger — 纯函数业务层（无 React / @deepseek-ai 依赖，便于单元测试）。
 *
 * 职责：颜色转换与亮度、标签 id/名称校验、生效标签规则（运行覆盖/折叠覆盖）、
 * 删除标签的原子清理操作构造、双色比例边界。组件只消费本层函数与 TaggerController。
 */
import type { TagDefinition, WorkspaceTaggerSettings } from './settings-types.ts'
import { SPLIT_RATIO_MIN, SPLIT_RATIO_MAX, DEFAULT_TAG_COLOR } from './settings-types.ts'

/** JSON 值（与 @deepseek-ai/dsh-util-values 的 JsonValue 结构等价，保持本层零依赖）。 */
export type TagJsonValue =
  | null
  | boolean
  | number
  | string
  | TagJsonValue[]
  | { [key: string]: TagJsonValue }

/** mutate 操作（与 dsh-api-remotes 的 SettingsPathOpView 形状一致，结构兼容）。 */
/**
 * mutate 操作（与 dsh-api-remotes 的 SettingsPathOpView 形状一致，业务层宽松值、
 * 交线处由 controller 转型为 JsonValue——标签/数组等域对象本就不是窄 JSON 联合）。
 */
export type TagMutateOp =
  | { op: 'set'; path: string[]; value: TagJsonValue }
  | { op: 'unset'; path: string[] }

// ---------------------------------------------------------------------------
// 颜色工具
// ---------------------------------------------------------------------------

/** #RRGGBB → {r,g,b}（0-255）；非法输入返回 null。 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (m === null) return null
  const n = Number.parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

/** 相对亮度（WCAG 近似）；> 0.6 视为浅色，其上使用深色文本。 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (rgb === null) return 0
  const linear = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
}

/** 依据背景亮度返回胶囊文本色（深/浅）。 */
export function textColorOn(hex: string): string {
  return relativeLuminance(hex) > 0.6 ? '#101418' : '#ffffff'
}

/** 归一化颜色输入为 #rrggbb；非法返回 null。 */
export function normalizeHex(input: string): string | null {
  const rgb = hexToRgb(input)
  if (rgb === null) return null
  return '#' + [rgb.r, rgb.g, rgb.b].map(v => v.toString(16).padStart(2, '0')).join('').toLowerCase()
}

/** HSV（h: 0–360, s/v: 0–1）→ #rrggbb。 */
export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) { r = c; g = x }
  else if (hue < 120) { r = x; g = c }
  else if (hue < 180) { g = c; b = x }
  else if (hue < 240) { g = x; b = c }
  else if (hue < 300) { r = x; b = c }
  else { r = c; b = x }
  const to255 = (v2: number): number => Math.round((v2 + m) * 255)
  return '#' + [to255(r), to255(g), to255(b)].map(n => n.toString(16).padStart(2, '0')).join('')
}

/** #rrggbb → HSV（h: 0–360, s/v: 0–1）；非法输入回退黑色。 */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const rgb = hexToRgb(hex)
  if (rgb === null) return { h: 0, s: 0, v: 0 }
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255
  const d = max - min
  let h = 0
  if (d !== 0) {
    const rr = rgb.r / 255
    const gg = rgb.g / 255
    const bb = rgb.b / 255
    if (max === rr) h = 60 * (((gg - bb) / d) % 6)
    else if (max === gg) h = 60 * ((bb - rr) / d + 2)
    else h = 60 * ((rr - gg) / d + 4)
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max }
}

/** hex → rgba 字符串（背景微着色用；color-mix 不可用时的退化路径）。 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (rgb === null) return `rgba(0, 0, 0, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

// ---------------------------------------------------------------------------
// 标签业务
// ---------------------------------------------------------------------------

/** 生成下一个标签 id：tag-<最大序号+1>（数字后缀递增，防重）。 */
export function nextTagId(tags: readonly TagDefinition[]): string {
  let max = 0
  for (const tag of tags) {
    const m = /^tag-(\d+)$/.exec(tag.id)
    if (m !== null) max = Math.max(max, Number.parseInt(m[1], 10))
  }
  return `tag-${max + 1}`
}

/** 校验标签名称：非空 + 全局唯一；返回错误文案或 null。 */
export function tagNameError(
  name: string,
  tags: readonly TagDefinition[],
  excludeId?: string,
): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'empty'
  const duplicate = tags.some(tag => tag.id !== excludeId && tag.name === trimmed)
  return duplicate ? 'duplicate' : null
}

/** 双色比例边界钳制。 */
export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.35
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, value))
}

/** 按 id 查标签。 */
export function tagById(settings: Pick<WorkspaceTaggerSettings, 'tags'>, id: string): TagDefinition | undefined {
  return settings.tags.find(tag => tag.id === id)
}

// ---------------------------------------------------------------------------
// 生效规则（§八：运行标签覆盖 + 折叠覆盖）
// ---------------------------------------------------------------------------

/**
 * 工作区行生效标签 id：
 * 该工作区存在运行中的会话且其已折叠（!expanded）时，使用运行会话标签；
 * 否则使用工作区自身标签。无匹配返回 undefined。
 */
export function effectiveWorkspaceTagId(
  settings: Pick<WorkspaceTaggerSettings, 'workspaceTags' | 'runningTagId'>,
  workspaceId: string,
  expanded: boolean,
  hasRunning: boolean,
): string | undefined {
  if (settings.runningTagId !== null && hasRunning && !expanded) return settings.runningTagId
  const own = settings.workspaceTags[workspaceId]
  return own === undefined ? undefined : own
}

/** 会话行生效标签 id：运行中会话使用运行会话标签；否则用会话自身标签。 */
export function effectiveSessionTagId(
  settings: Pick<WorkspaceTaggerSettings, 'sessionTags' | 'runningTagId'>,
  sessionId: string,
  running: boolean,
): string | undefined {
  if (settings.runningTagId !== null && running) return settings.runningTagId
  const own = settings.sessionTags[sessionId]
  return own === undefined ? undefined : own
}

// ---------------------------------------------------------------------------
// 删除标签的原子清理操作
// ---------------------------------------------------------------------------

/**
 * 构造删除一个标签所需的全部 mutate 操作：
 * 1) tags 数组移除该条目（set 整数组）；2) 所有引用它的 workspaceTags /
 * sessionTags 条目 unset；3) runningTagId 指向它时 set null。
 * 一次 mutate 提交，原子生效。
 */
export function deleteTagOps(
  settings: WorkspaceTaggerSettings,
  tagId: string,
): { ops: TagMutateOp[]; nextTags: TagDefinition[] } {
  const nextTags = settings.tags.filter(tag => tag.id !== tagId)
  const ops: TagMutateOp[] = []
  if (nextTags.length !== settings.tags.length) {
    ops.push({ op: 'set', path: ['tags'], value: nextTags as unknown as TagJsonValue })
  }
  for (const [key, id] of Object.entries(settings.workspaceTags)) {
    if (id === tagId) ops.push({ op: 'unset', path: ['workspaceTags', key] })
  }
  for (const [key, id] of Object.entries(settings.sessionTags)) {
    if (id === tagId) ops.push({ op: 'unset', path: ['sessionTags', key] })
  }
  if (settings.runningTagId === tagId) {
    ops.push({ op: 'set', path: ['runningTagId'], value: null })
  }
  return { ops, nextTags }
}

/** 构造写入/清除某个分配（workspace 或 session）的操作。 */
export function assignmentOps(
  map: 'workspaceTags' | 'sessionTags',
  targetId: string,
  tagId: string | null,
): TagMutateOp[] {
  if (tagId === null) return [{ op: 'unset', path: [map, targetId] }]
  return [{ op: 'set', path: [map, targetId], value: tagId }]
}

/** 构造追加标签的操作。 */
export function appendTagOps(settings: WorkspaceTaggerSettings, tag: TagDefinition): TagMutateOp[] {
  return [{ op: 'set', path: ['tags'], value: [...settings.tags, tag] as unknown as TagJsonValue }]
}

/** 构造更新标签（名称/颜色）的操作。 */
export function updateTagOps(settings: WorkspaceTaggerSettings, tagId: string, patch: Partial<Pick<TagDefinition, 'name' | 'color'>>): TagMutateOp[] {
  return [{
    op: 'set',
    path: ['tags'],
    value: settings.tags.map(tag => tag.id === tagId ? { ...tag, ...patch } : tag) as unknown as TagJsonValue,
  }]
}

// ---------------------------------------------------------------------------
// 渲染辅助
// ---------------------------------------------------------------------------

/** 胶囊默认色（标签无颜色时的兜底，正常不会发生）。 */
export const FALLBACK_TAG_COLOR = DEFAULT_TAG_COLOR

/** 行背景微着色透明度（8%）。 */
export const ROW_TINT_ALPHA = 0.08
