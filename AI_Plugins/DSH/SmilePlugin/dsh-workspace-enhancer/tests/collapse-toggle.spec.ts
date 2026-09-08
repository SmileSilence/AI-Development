/**
 * 一键折叠/展开（v0.6.0）纯函数单测：allWorkspacesCollapsed + shouldShowCollapseToggle。
 * 覆盖：全折叠判定、全展开、混合状态、无工作区、flat 模式。
 */
import { describe, expect, it } from 'vitest'
import { allWorkspacesCollapsed, shouldShowCollapseToggle } from '../src/client/tree.ts'

describe('allWorkspacesCollapsed 全折叠判定', () => {
  it('无工作区：不算全部折叠（false）', () => {
    expect(allWorkspacesCollapsed([], {})).toBe(false)
  })

  it('全部显式折叠（false）：true', () => {
    expect(allWorkspacesCollapsed(['w1', 'w2'], { w1: false, w2: false })).toBe(true)
  })

  it('全部缺失记录（视为折叠）：true', () => {
    expect(allWorkspacesCollapsed(['w1', 'w2'], {})).toBe(true)
  })

  it('全部展开（true）：false', () => {
    expect(allWorkspacesCollapsed(['w1', 'w2'], { w1: true, w2: true })).toBe(false)
  })

  it('混合状态（部分折叠部分展开）：false（按未全部折叠处理）', () => {
    expect(allWorkspacesCollapsed(['w1', 'w2'], { w1: false, w2: true })).toBe(false)
  })

  it('单一工作区展开：false', () => {
    expect(allWorkspacesCollapsed(['w1'], { w1: true })).toBe(false)
  })

  it('单一工作区折叠：true', () => {
    expect(allWorkspacesCollapsed(['w1'], { w1: false })).toBe(true)
  })

  it('多余记录（非当前工作区）不影响判定', () => {
    expect(allWorkspacesCollapsed(['w1'], { w1: false, stale: true })).toBe(true)
  })
})

describe('shouldShowCollapseToggle 按钮显隐', () => {
  it('分组视图 + 有工作区：显示', () => {
    expect(shouldShowCollapseToggle('workspace', ['w1', 'w2'])).toBe(true)
  })

  it('分组视图 + 无工作区：不显示', () => {
    expect(shouldShowCollapseToggle('workspace', [])).toBe(false)
  })

  it('flat 模式 + 有工作区：不显示', () => {
    expect(shouldShowCollapseToggle('flat', ['w1'])).toBe(false)
  })

  it('flat 模式 + 无工作区：不显示', () => {
    expect(shouldShowCollapseToggle('flat', [])).toBe(false)
  })
})
