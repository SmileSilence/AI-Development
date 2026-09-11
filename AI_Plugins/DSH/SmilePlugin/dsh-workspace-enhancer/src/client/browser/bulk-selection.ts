//#region 批量选择状态与手势
export type BulkKind = 'workspace' | 'session'
export interface BulkGesture {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  checkbox?: boolean
}
export interface BulkSelectionState {
  keys: readonly string[]
  anchor: string | null
}

/** 对照当前显示顺序剔除隐藏项；锚点消失后不继续选择旧范围。 */
export function reconcileBulkSelection(state: BulkSelectionState, visible: readonly string[]): BulkSelectionState {
  const allowed = new Set(visible)
  return { keys: state.keys.filter(key => allowed.has(key)), anchor: state.anchor !== null && allowed.has(state.anchor) ? state.anchor : null }
}

/** Windows 风格行选择；复选框无修饰键时保留逐项勾选。 */
export function selectBulkRow(state: BulkSelectionState, visible: readonly string[], key: string, gesture: BulkGesture): BulkSelectionState {
  const current = reconcileBulkSelection(state, visible)
  const target = visible.indexOf(key)
  if (target < 0) return current
  const additive = gesture.ctrlKey || gesture.metaKey
  if (gesture.shiftKey && current.anchor === null) {
    return { keys: additive ? [...new Set([...current.keys, key])] : [key], anchor: key }
  }
  if (gesture.shiftKey && current.anchor !== null) {
    const anchorIndex = visible.indexOf(current.anchor)
    const range = visible.slice(Math.min(anchorIndex, target), Math.max(anchorIndex, target) + 1)
    return { keys: [...new Set(additive ? [...current.keys, ...range] : range)], anchor: current.anchor }
  }
  if (additive || gesture.checkbox) {
    return { keys: current.keys.includes(key) ? current.keys.filter(id => id !== key) : [...current.keys, key], anchor: key }
  }
  return { keys: [key], anchor: key }
}

/** 当前列表未使用虚拟化，挂载行顺序即显示顺序，包含滚动区域外的行。 */
export function readVisibleBulkKeys(root: ParentNode, kind: BulkKind): string[] {
  return [...new Set(Array.from(root.querySelectorAll<HTMLElement>('[data-bulk-key]'))
    .filter(row => row.dataset.bulkKind === kind && !row.closest('[hidden], [aria-hidden="true"]'))
    .map(row => row.dataset.bulkKey!))]
}

/** 输入和弹窗保留浏览器原生全选；React 门户事件也不越过列表边界。 */
export function permitsBulkSelectAll(root: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof HTMLElement && root.contains(target)
    && !target.isContentEditable
    && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="menu"]') === null
}
//#endregion
