/**
 * 分类菜单键盘接管：仅在本菜单所属输入栏范围内接管上下方向键。
 *
 * - 在原生编辑器消费方向键之前生效（document 捕获阶段）；
 * - 输入法组合期间放行（isComposing / keyCode 229）；
 * - 按视觉排序计算下一项，并经 controller.hover 更新原生高亮；
 * - 关闭分类菜单、切换会话或停用插件即解除监听；
 * - Enter / Tab / Escape 继续走原生仲裁，不拦截。
 */

/**
 * 挂接方向键接管。
 * @param {object} opts
 * @param {() => boolean} opts.enabled - 是否处于分类菜单接管状态（launcher==='command' 且打开）。
 * @param {() => import('./viewModel.js').CategorizedModel | null} opts.viewOf - 当前视图模型。
 * @param {(source: string, index: number) => void} opts.onHover - 原生 hover 路由（controller.hover）。
 * @returns {() => void} 解除挂接。
 */
export function attachCategoryKeys({ enabled, viewOf, onHover }) {
  const onKeyDown = (event) => {
    if (!enabled()) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    // 输入法组合期间放行键盘事件
    if (event.isComposing || event.keyCode === 229) return
    const view = viewOf()
    if (view === null || view.rows.length === 0) return
    event.preventDefault()
    event.stopPropagation()

    const current = view.highlightKey !== null ? view.indexByKey.get(view.highlightKey) : undefined
    const rows = view.rows
    let next
    if (current === undefined) {
      next = event.key === 'ArrowDown' ? 0 : rows.length - 1
    } else if (event.key === 'ArrowDown') {
      next = (current + 1) % rows.length
    } else {
      next = (current - 1 + rows.length) % rows.length
    }
    const row = rows[next]
    onHover(row.source, row.index)
  }

  document.addEventListener('keydown', onKeyDown, true)
  return () => document.removeEventListener('keydown', onKeyDown, true)
}
