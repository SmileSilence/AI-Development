/**
 * dsh-workspace-tagger — 纯函数业务层单元测试（tag-store.ts）。
 *
 * 覆盖：颜色工具（hex/RGB/HSV/亮度/文本色）、标签 id/名称校验、比例钳制、
 * 生效标签规则（运行覆盖 + 折叠覆盖）、删除标签原子清理、分配/追加/更新操作。
 */
import { describe, expect, it } from 'vitest'
import type { TagDefinition, WorkspaceTaggerSettings } from '../src/tags/settings-types.ts'
import {
  appendTagOps,
  assignmentOps,
  clampSplitRatio,
  deleteTagOps,
  effectiveSessionTagId,
  effectiveWorkspaceTagId,
  hexToHsv,
  hexToRgb,
  hexToRgba,
  hsvToHex,
  nextTagId,
  normalizeHex,
  ROW_TINT_ALPHA,
  tagNameError,
  textColorOn,
  updateTagOps,
} from '../src/client/tags/tag-store.ts'

const tag = (id: string, name: string, color = '#4f7cff'): TagDefinition => ({ id, name, color })

const settings = (patch: Partial<WorkspaceTaggerSettings> = {}): WorkspaceTaggerSettings => ({
  tags: [tag('tag-1', '设计'), tag('tag-2', '开发')],
  workspaceTags: { 'ws-1': 'tag-1' },
  sessionTags: { 's-1': 'tag-2' },
  runningTagId: null,
  splitRatio: 0.35,
  customColors: [],
  ...patch,
})

describe('颜色工具', () => {
  it('hexToRgb 解析 #RRGGBB（含无 # 前缀与大小写）', () => {
    expect(hexToRgb('#4f7cff')).toEqual({ r: 79, g: 124, b: 255 })
    expect(hexToRgb('4F7CFF')).toEqual({ r: 79, g: 124, b: 255 })
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb('red')).toBeNull()
  })

  it('normalizeHex 归一化（小写、补零）', () => {
    expect(normalizeHex('#FFF')).toBeNull()
    expect(normalizeHex('#abcdef')).toBe('#abcdef')
    expect(normalizeHex('ABCDEF')).toBe('#abcdef')
  })

  it('hsvToHex / hexToHsv 往返一致（关键色相）', () => {
    // 红 0 / 绿 120 / 蓝 240
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000')
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00')
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff')
    // 饱和度 0 → 灰阶
    expect(hsvToHex(300, 0, 0.5)).toBe('#808080')
    // 往返：给定 hex → hsv → hex
    for (const c of ['#4f7cff', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#000000', '#ffffff']) {
      const hsv = hexToHsv(c)
      expect(hexToHsv(hsvToHex(hsv.h, hsv.s, hsv.v))).toEqual(hsv)
    }
  })

  it('hexToRgba 输出 8% 微着色（ROW_TINT_ALPHA）', () => {
    expect(hexToRgba('#4f7cff', ROW_TINT_ALPHA)).toBe('rgba(79, 124, 255, 0.08)')
    expect(hexToRgba('bad', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })

  it('textColorOn 浅底深字 / 深底白字', () => {
    expect(textColorOn('#ffffff')).toBe('#101418')
    expect(textColorOn('#000000')).toBe('#ffffff')
    expect(textColorOn('#4f7cff')).toBe('#ffffff')
  })
})

describe('标签业务', () => {
  it('nextTagId 数字后缀递增', () => {
    expect(nextTagId([])).toBe('tag-1')
    expect(nextTagId([tag('tag-1', 'a'), tag('tag-3', 'b')])).toBe('tag-4')
    expect(nextTagId([tag('x-7', 'a', '#111')])).toBe('tag-1')
  })

  it('tagNameError：空名 / 重名（排除自身）/ 合法', () => {
    expect(tagNameError('', settings().tags)).toBe('empty')
    expect(tagNameError('   ', settings().tags)).toBe('empty')
    expect(tagNameError('设计', settings().tags)).toBe('duplicate')
    expect(tagNameError('设计', settings().tags, 'tag-1')).toBeNull()
    expect(tagNameError('部署', settings().tags)).toBeNull()
  })

  it('clampSplitRatio 边界钳制 + 非法回退', () => {
    expect(clampSplitRatio(0.05)).toBe(0.1)
    expect(clampSplitRatio(0.95)).toBe(0.9)
    expect(clampSplitRatio(0.35)).toBe(0.35)
    expect(clampSplitRatio(Number.NaN)).toBe(0.35)
  })
})

describe('生效标签规则', () => {
  it('工作区：折叠 + 有运行 → 运行标签；否则自身标签', () => {
    const base = settings()
    expect(effectiveWorkspaceTagId(base, 'ws-1', false, false)).toBe('tag-1')
    expect(effectiveWorkspaceTagId(base, 'ws-1', true, false)).toBe('tag-1')
    // 无自身标签 + 无运行 → undefined
    expect(effectiveWorkspaceTagId(base, 'ws-2', false, false)).toBeUndefined()
    // 折叠 + 运行 → 运行标签覆盖
    const withRunning = settings({ runningTagId: 'tag-2' })
    expect(effectiveWorkspaceTagId(withRunning, 'ws-1', false, true)).toBe('tag-2')
    // 展开时不覆盖（折叠覆盖规则只在折叠态生效）
    expect(effectiveWorkspaceTagId(withRunning, 'ws-1', true, true)).toBe('tag-1')
  })

  it('会话：运行中 → 运行标签；否则自身标签', () => {
    const base = settings()
    expect(effectiveSessionTagId(base, 's-1', false)).toBe('tag-2')
    expect(effectiveSessionTagId(base, 's-2', false)).toBeUndefined()
    const withRunning = settings({ runningTagId: 'tag-1' })
    expect(effectiveSessionTagId(withRunning, 's-1', true)).toBe('tag-1')
    expect(effectiveSessionTagId(withRunning, 's-1', false)).toBe('tag-2')
  })
})

describe('删除标签原子清理', () => {
  it('同时清理 tags / workspaceTags / sessionTags / runningTagId', () => {
    const st = settings({
      runningTagId: 'tag-1',
      tags: [tag('tag-1', '设计'), tag('tag-2', '开发')],
      workspaceTags: { 'ws-1': 'tag-1', 'ws-2': 'tag-2' },
      sessionTags: { 's-1': 'tag-2', 's-2': 'tag-1' },
    })
    const { ops, nextTags } = deleteTagOps(st, 'tag-1')
    expect(nextTags.map(t => t.id)).toEqual(['tag-2'])
    const setOps = ops.filter(o => o.op === 'set' && o.path[0] === 'tags')
    const unsetPaths = ops.filter(o => o.op === 'unset').map(o => o.path.join('.'))
    const runningOp = ops.find(o => o.path[0] === 'runningTagId')
    expect(setOps).toHaveLength(1)
    expect(unsetPaths).toEqual(expect.arrayContaining(['workspaceTags.ws-1', 'sessionTags.s-2']))
    expect(runningOp).toEqual({ op: 'set', path: ['runningTagId'], value: null })
    // 不引用该标签的条目不产生操作
    expect(unsetPaths).not.toContain('workspaceTags.ws-2')
    expect(unsetPaths).not.toContain('sessionTags.s-1')
  })

  it('删除不存在的标签：仅 tags 不变，无操作', () => {
    const st = settings()
    const { ops } = deleteTagOps(st, 'tag-99')
    expect(ops).toEqual([])
  })
})

describe('分配/追加/更新操作', () => {
  it('assignmentOps：set 与 unset', () => {
    expect(assignmentOps('workspaceTags', 'ws-1', 'tag-2')).toEqual([{ op: 'set', path: ['workspaceTags', 'ws-1'], value: 'tag-2' }])
    expect(assignmentOps('sessionTags', 's-1', null)).toEqual([{ op: 'unset', path: ['sessionTags', 's-1'] }])
  })

  it('appendTagOps 追加到 tags 尾部', () => {
    const st = settings()
    const ops = appendTagOps(st, tag('tag-3', '部署', '#22c55e'))
    expect(ops).toHaveLength(1)
    const value = ops[0] as unknown as { value: TagDefinition[] }
    expect(value.value.map(t => t.id)).toEqual(['tag-1', 'tag-2', 'tag-3'])
  })

  it('updateTagOps 更新名称/颜色，其余标签不变', () => {
    const st = settings()
    const ops = updateTagOps(st, 'tag-1', { name: 'UI 设计', color: '#8b5cf6' })
    const value = (ops[0] as unknown as { value: TagDefinition[] }).value
    expect(value[0]).toEqual({ id: 'tag-1', name: 'UI 设计', color: '#8b5cf6' })
    expect(value[1]).toEqual({ id: 'tag-2', name: '开发', color: '#4f7cff' })
  })
})
