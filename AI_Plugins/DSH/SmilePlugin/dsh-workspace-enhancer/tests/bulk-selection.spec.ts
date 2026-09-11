import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconcileBulkSelection, selectBulkRow, readVisibleBulkKeys, permitsBulkSelectAll, type BulkSelectionState } from '../src/client/browser/bulk-selection.ts'

//#region Windows 批量选择行为
const order = ['a', 'b', 'c', 'd', 'e']
const empty: BulkSelectionState = { keys: [], anchor: null }

describe('批量选择手势', () => {
  it('普通点击替换选区并建立新锚点', () => {
    expect(selectBulkRow({ keys: ['a', 'e'], anchor: 'a' }, order, 'c', {})).toEqual({ keys: ['c'], anchor: 'c' })
  })
  it('Ctrl 点击追加或取消单项，不丢失其他选择', () => {
    const first = selectBulkRow({ keys: ['a'], anchor: 'a' }, order, 'c', { ctrlKey: true })
    expect(first).toEqual({ keys: ['a', 'c'], anchor: 'c' })
    expect(selectBulkRow(first, order, 'a', { ctrlKey: true })).toEqual({ keys: ['c'], anchor: 'a' })
  })
  it('兼容 Meta 追加手势', () => {
    expect(selectBulkRow({ keys: ['a'], anchor: 'a' }, order, 'e', { metaKey: true }).keys).toEqual(['a', 'e'])
  })
  it('Shift 双向连续选择且保持最初锚点', () => {
    const first = selectBulkRow({ keys: ['c'], anchor: 'c' }, order, 'e', { shiftKey: true })
    expect(first).toEqual({ keys: ['c', 'd', 'e'], anchor: 'c' })
    expect(selectBulkRow(first, order, 'a', { shiftKey: true })).toEqual({ keys: ['a', 'b', 'c'], anchor: 'c' })
  })
  it('Ctrl+Shift 追加连续范围且去重', () => {
    expect(selectBulkRow({ keys: ['a', 'c'], anchor: 'c' }, order, 'e', { ctrlKey: true, shiftKey: true })).toEqual({ keys: ['a', 'c', 'd', 'e'], anchor: 'c' })
  })
  it('复选框直接点击逐项勾选或取消', () => {
    const first = selectBulkRow({ keys: ['a'], anchor: 'a' }, order, 'e', { checkbox: true })
    expect(first.keys).toEqual(['a', 'e'])
    expect(selectBulkRow(first, order, 'a', { checkbox: true }).keys).toEqual(['e'])
  })
  it('复选框 Shift 优先执行范围替换', () => {
    expect(selectBulkRow({ keys: ['a', 'c'], anchor: 'c' }, order, 'e', { checkbox: true, shiftKey: true }).keys).toEqual(['c', 'd', 'e'])
  })
  it('复选框 Ctrl+Shift 优先执行追加范围', () => {
    expect(selectBulkRow({ keys: ['a', 'c'], anchor: 'c' }, order, 'e', { checkbox: true, ctrlKey: true, shiftKey: true }).keys).toEqual(['a', 'c', 'd', 'e'])
  })
  it('无锚点的 Shift 只选择当前项，包括复选框', () => {
    expect(selectBulkRow({ keys: ['a'], anchor: null }, order, 'e', { checkbox: true, shiftKey: true })).toEqual({ keys: ['e'], anchor: 'e' })
  })
  it('无锚点 Ctrl+Shift 保留旧选择并建立锚点', () => {
    expect(selectBulkRow({ keys: ['a'], anchor: null }, order, 'e', { ctrlKey: true, shiftKey: true })).toEqual({ keys: ['a', 'e'], anchor: 'e' })
  })
  it('排序后按新显示顺序计算范围', () => {
    expect(selectBulkRow({ keys: ['a'], anchor: 'a' }, ['c', 'a', 'e', 'b', 'd'], 'b', { shiftKey: true }).keys).toEqual(['a', 'e', 'b'])
  })
  it('点击不可操作项不建立选择或锚点', () => {
    expect(selectBulkRow(empty, order, 'blank', {})).toEqual(empty)
  })
  it('空列表保持空选区', () => {
    expect(selectBulkRow(empty, [], 'a', { shiftKey: true })).toEqual(empty)
  })
})

describe('显示范围变化', () => {
  it('折叠、筛选、显示更少和归档后剔除隐藏选项和锚点', () => {
    expect(reconcileBulkSelection({ keys: ['a', 'b', 'e'], anchor: 'b' }, ['a', 'e'])).toEqual({ keys: ['a', 'e'], anchor: null })
  })
  it('保留仍在显示范围的锚点，避免数据更新打断连续选择', () => {
    expect(reconcileBulkSelection({ keys: ['a', 'b'], anchor: 'b' }, ['b', 'a', 'e'])).toEqual({ keys: ['a', 'b'], anchor: 'b' })
  })
  it('隐藏锚点后 Shift 不把旧位置用作范围起点', () => {
    expect(selectBulkRow({ keys: ['a', 'b'], anchor: 'b' }, ['a', 'c', 'e'], 'e', { shiftKey: true })).toEqual({ keys: ['e'], anchor: 'e' })
  })
  it('切换到无工作区行的搜索列表时清空工作区选择', () => {
    expect(reconcileBulkSelection({ keys: ['workspace-a'], anchor: 'workspace-a' }, [])).toEqual(empty)
  })
  it('读取当前挂载行顺序、区分种类、去重，并排除显式隐藏项', () => {
    const row = (key: string, kind: string, hidden = false) => ({ dataset: { bulkKey: key, bulkKind: kind }, closest: () => hidden ? {} : null })
    const root = { querySelectorAll: () => [row('w', 'workspace'), row('c', 'session'), row('a', 'session'), row('c', 'session'), row('hidden', 'session', true)] } as unknown as ParentNode
    expect(readVisibleBulkKeys(root, 'session')).toEqual(['c', 'a'])
    expect(readVisibleBulkKeys(root, 'workspace')).toEqual(['w'])
  })
})
//#endregion

//#region 快捷键焦点边界契约
// 用最小 DOM 接口测试事件边界；真实宿主焦点恢复与门户交互由界面验收覆盖。
class FocusTarget {
  isContentEditable = false
  protectedAncestor: object | null = null
  closest(): object | null { return this.protectedAncestor }
}
afterEach(() => { vi.unstubAllGlobals() })
describe('Ctrl+A 焦点边界', () => {
  const setup = (inside = true) => {
    vi.stubGlobal('HTMLElement', FocusTarget)
    const target = new FocusTarget()
    const root = { contains: () => inside } as unknown as HTMLElement
    return { root, target, asEventTarget: target as unknown as EventTarget }
  }
  it('列表内普通行允许全选', () => {
    const { root, asEventTarget } = setup()
    expect(permitsBulkSelectAll(root, asEventTarget)).toBe(true)
  })
  it('列表外焦点及 React 门户目标禁止截获', () => {
    const { root, asEventTarget } = setup(false)
    expect(permitsBulkSelectAll(root, asEventTarget)).toBe(false)
  })
  it('可编辑节点保留原生全选', () => {
    const { root, target, asEventTarget } = setup()
    target.isContentEditable = true
    expect(permitsBulkSelectAll(root, asEventTarget)).toBe(false)
  })
  it('输入框、编辑区或菜单弹窗祖先命中时禁止截获', () => {
    const { root, target, asEventTarget } = setup()
    target.protectedAncestor = {}
    expect(permitsBulkSelectAll(root, asEventTarget)).toBe(false)
  })
  it('没有元素目标时不处理快捷键', () => {
    const { root } = setup()
    expect(permitsBulkSelectAll(root, null)).toBe(false)
  })
})
//#endregion
