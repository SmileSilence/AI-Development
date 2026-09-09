/**
 * 分类命令菜单：仅在 launcher==='command'（点击 + 打开）时渲染。
 *
 * - 数据来自原生控制器候选快照（含宿主与客户端插件贡献）；
 * - 视觉按固定分类排序（空组隐藏，未知命令进“其他”保留原始相对顺序）；
 * - 每一行携带 (source, originalIndex)；选择通过 controller.pick 原生管道，
 *   模型/权限选择器、参数认领与命令执行全部保持原生行为；
 * - 菜单打开期间接管上下方向键（按视觉排序移动原生高亮）；Enter/Tab/Escape
 *   走原生仲裁；输入法组合期间放行；关闭/切换会话/停用即解除监听。
 */
import { Fragment, useEffect, useRef, useSyncExternalStore } from 'react'
import { IconChevronRightOutline14, useAnchoredMaxHeight } from '@deepseek-ai/dsh-client-ui-primitives'
import { attachCategoryKeys } from './keyboard.js'
import { buildCategorizedModel } from './viewModel.js'

/** 设计上限：菜单列表高度。 */
const MAX_HEIGHT = 320

/** 无障碍选项 id（原始索引，与原生高亮一一对应）。 */
function optionId(source, index) {
  return `dsh-ie-cat-option-${source}-${index}`
}

/** 分类菜单组件。 */
export function CategorizedMenu({ menu, headers, onPick, onCrumb, onHover, onDismiss, ownerResolver }) {
  const snapshot = useSyncExternalStore(
    (fn) => menu.subscribe(fn),
    () => menu.getSnapshot(),
  )
  const crumbs = useSyncExternalStore(
    (fn) => headers.subscribe(fn),
    () => headers.getSnapshot(),
  )
  const listRef = useRef(null)
  const maxHeight = useAnchoredMaxHeight(listRef, MAX_HEIGHT, snapshot)

  // 每次快照（含代次）重建插件视图模型：提交前以 (source, originalIndex) 校验
  const model = buildCategorizedModel(snapshot, { ownerResolver })
  const highlight = snapshot.open ? snapshot.highlight : null

  // 高亮行滚动进可视区（焦点保持在输入框，combobox 模式）
  useEffect(() => {
    if (highlight === null) return
    document.getElementById(optionId(highlight.source, highlight.index))
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  // 每次打开（新代次）置顶：滚动回顶部 + 高亮同步到视觉首行。
  // 原生首高亮是“首个原生候选”，经分类重排后可能位于列表中部，scrollIntoView
  // 会把视口拖到中部；同步后 Enter 直接触发所见首项，键盘导航起点也与视觉一致。
  const syncedGenerationRef = useRef(-1)
  useEffect(() => {
    if (!snapshot.open) return
    if (model.rows.length === 0) return
    if (syncedGenerationRef.current === snapshot.generation) return
    syncedGenerationRef.current = snapshot.generation
    const viewport = listRef.current?.querySelector('.dsh-ie-menu-viewport')
    if (viewport !== null && viewport !== undefined) viewport.scrollTop = 0
    const first = model.rows[0]
    const firstKey = `${first.source}:${first.index}`
    if (model.highlightKey !== firstKey) onHover(first.source, first.index)
  }, [snapshot.open, snapshot.generation, model, onHover])

  // 外部点击关闭（菜单之外且输入栏卡片之外）
  useEffect(() => {
    if (!snapshot.open) return
    const onPointerDown = (event) => {
      if (!(event.target instanceof Node)) return
      if (listRef.current?.contains(event.target)) return
      const composerCard = listRef.current?.closest('[data-composer-card]')
      if (composerCard?.contains(event.target)) return
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [snapshot.open, onDismiss])

  // 上下方向键接管：按视觉排序移动原生高亮；分类关闭/卸载即解除
  useEffect(() => {
    if (!snapshot.open) return
    return attachCategoryKeys({
      enabled: () => true,
      viewOf: () => model,
      onHover,
    })
  }, [snapshot.open, model, onHover])

  if (!snapshot.open) return null

  return (
    <div ref={listRef} className="dsh-ie-menu" style={{ maxHeight }} data-trigger-menu="" data-categorized-menu="">
      {[...crumbs.entries()].some(([, trail]) => trail.length > 0) && (
        <nav className="dsh-ie-menu-crumbs" aria-label="面包屑">
          {[...crumbs.entries()].flatMap(([source, trail]) =>
            trail.map((crumb, index) => (
              <Fragment key={`${source}-${String(index)}-${crumb.value}`}>
                {index > 0 && <span className="dsh-ie-menu-crumb-sep" aria-hidden><IconChevronRightOutline14 /></span>}
                <button
                  type="button"
                  className={'dsh-ie-menu-crumb' + (crumb.current === true ? ' dsh-ie-menu-crumb-current' : '')}
                  aria-current={crumb.current === true ? 'location' : undefined}
                  disabled={crumb.current === true}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onCrumb(source, index)
                  }}
                >
                  {crumb.label}
                </button>
              </Fragment>
            )),
          )}
        </nav>
      )}
      <div
        className="dsh-ie-menu-viewport"
        role="listbox"
        aria-label="分类命令"
        aria-activedescendant={highlight !== null ? optionId(highlight.source, highlight.index) : undefined}
      >
        {model.categories.map((category) => {
          const rows = model.rows.filter(row => row.categoryLabel === category.label)
          return (
            <Fragment key={category.label}>
              <div className="dsh-ie-cat-title" role="presentation">{category.label}</div>
              {rows.map((row) => {
                const active = highlight !== null && highlight.source === row.source && highlight.index === row.index
                return (
                  <button
                    key={optionId(row.source, row.index)}
                    id={optionId(row.source, row.index)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={'dsh-ie-menu-item' + (active ? ' dsh-ie-active' : '')}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onPick(row.source, row.index)
                    }}
                    onMouseMove={active ? undefined : () => { onHover(row.source, row.index) }}
                  >
                    <span className="dsh-ie-menu-name">{row.name}</span>
                    {row.description !== undefined && <span className="dsh-ie-menu-desc">{row.description}</span>}
                    {row.hint !== undefined && <span className="dsh-ie-menu-desc">（参数）</span>}
                    {row.drill === true && (
                      <span className="dsh-ie-menu-trailing">
                        <kbd className="dsh-ie-menu-hint" aria-hidden>Tab</kbd>
                        <span
                          role="button"
                          aria-label="向下钻取（Tab）"
                          className="dsh-ie-menu-drill"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onPick(row.source, row.index, 'drill')
                          }}
                        >
                          <IconChevronRightOutline14 />
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
            </Fragment>
          )
        })}
        {model.rows.length === 0 && (
          <div role="status" aria-label="暂无命令" style={{ padding: '8px 10px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>
            暂无可用命令
          </div>
        )}
      </div>
    </div>
  )
}