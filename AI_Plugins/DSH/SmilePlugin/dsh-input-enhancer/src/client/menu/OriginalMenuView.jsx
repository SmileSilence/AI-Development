/**
 * 原生命令菜单兼容分支。
 *
 * 基于目标 DSH 提交（0.1.2-alpha.4, 4e84901e64）@deepseek-ai/dsh-client-ui-input-trigger
 * src/client/MenuView.tsx 提取的独立兼容模块：保持面包屑、钻取、加载骨架、焦点、
 * 滚动、外部关闭与无障碍行为。中文文案本地内置；样式复用全局注入的 dsh-ie-* 类。
 *
 * 源文件版权归 DeepSeek 所有，保留 MIT 许可；本模块以 MIT 许可分发。
 */
import { Fragment, useEffect, useRef, useSyncExternalStore } from 'react'
import { IconChevronRightOutline14, ReferenceIcon, useAnchoredMaxHeight } from '@deepseek-ai/dsh-client-ui-primitives'

/** 设计上限：菜单列表高度（对应原生 MAX_HEIGHT）。 */
const MAX_HEIGHT = 320

/** 无障碍选项 id（aria-activedescendant 目标）。 */
function optionId(source, index) {
  return `dsh-ie-slash-option-${source}-${index}`
}

/**
 * 渲染覆盖层命令菜单；关闭时返回 null（覆盖层插槽保持挂载）。
 * @param {object} props - 注入面：menu/headers 快照 + pick/crumb/hover/dismiss 路由。
 */
export function OriginalMenuView({ menu, headers, onPick, onCrumb, onHover, onDismiss }) {
  const state = useSyncExternalStore(
    (fn) => menu.subscribe(fn),
    () => menu.getSnapshot(),
  )
  const crumbs = useSyncExternalStore(
    (fn) => headers.subscribe(fn),
    () => headers.getSnapshot(),
  )
  const listRef = useRef(null)
  // 贴近输入栏上方展开；每次更新重测（输入栏长高时锚点会移动）
  const maxHeight = useAnchoredMaxHeight(listRef, MAX_HEIGHT, state)
  const highlight = state.open ? state.highlight : null

  // 焦点停留在输入框（combobox 模式），键盘移动后由浏览器滚动高亮行
  useEffect(() => {
    if (highlight === null) return
    document.getElementById(optionId(highlight.source, highlight.index))
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  // 外部点击关闭：菜单之外且输入栏卡片之外（textarea/底部栏点击不关闭）
  useEffect(() => {
    if (!state.open) return
    const onPointerDown = (event) => {
      if (!(event.target instanceof Node)) return
      if (listRef.current?.contains(event.target)) return
      const composerCard = listRef.current?.closest('[data-composer-card]')
      if (composerCard?.contains(event.target)) return
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [state.open, onDismiss])

  if (!state.open) return null

  return (
    <div ref={listRef} className="dsh-ie-menu" style={{ maxHeight }} data-trigger-menu="">
      {state.groups.map((group) => {
        const trail = crumbs.get(group.source)
        if (trail === undefined) return null
        return (
          <nav key={group.source} className="dsh-ie-menu-crumbs" aria-label="面包屑">
            {trail.map((crumb, index) => (
              <Fragment key={`${String(index)}-${crumb.value}`}>
                {index > 0 && <span className="dsh-ie-menu-crumb-sep" aria-hidden><IconChevronRightOutline14 /></span>}
                <button
                  type="button"
                  className={'dsh-ie-menu-crumb' + (crumb.current === true ? ' dsh-ie-menu-crumb-current' : '')}
                  aria-current={crumb.current === true ? 'location' : undefined}
                  disabled={crumb.current === true}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onCrumb(group.source, index)
                  }}
                >
                  {crumb.label}
                </button>
              </Fragment>
            ))}
          </nav>
        )
      })}
      <div
        className="dsh-ie-menu-viewport"
        role="listbox"
        aria-label="命令建议"
        aria-activedescendant={highlight !== null ? optionId(highlight.source, highlight.index) : undefined}
      >
        {state.groups.map((group) => (
          group.status === 'ready' && group.items.length === 0
            ? null
            : (
              <Fragment key={group.source}>
                {group.showGroupTitle === false || group.items.some(item => item.section !== undefined)
                  ? null
                  : <div className="dsh-ie-menu-group-title" role="presentation" data-source={group.source}>{group.source}</div>}
                {group.status === 'pending' && group.items.length === 0
                  ? (
                    <div role="status" aria-label="加载中" data-source={group.source}>
                      <div className="dsh-ie-menu-skeleton-row"><span className="dsh-ie-menu-skeleton-bar" style={{ width: '32%' }} /></div>
                      <div className="dsh-ie-menu-skeleton-row"><span className="dsh-ie-menu-skeleton-bar" style={{ width: '48%' }} /></div>
                    </div>
                  )
                  : group.items.map((item, index) => {
                    const active = highlight !== null && highlight.source === group.source && highlight.index === index
                    return (
                      <Fragment key={optionId(group.source, index)}>
                        {item.section !== undefined && item.section !== group.items[index - 1]?.section
                          ? <div className="dsh-ie-menu-section" role="presentation">{item.section}</div>
                          : null}
                        <button
                          id={optionId(group.source, index)}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={'dsh-ie-menu-item' + (active ? ' dsh-ie-active' : '')}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            onPick(group.source, index)
                          }}
                          onMouseMove={active ? undefined : () => { onHover(group.source, index) }}
                        >
                          {item.icon !== undefined && (
                            <span style={{ display: 'inline-flex', flex: 'none', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-label-tertiary)' }} aria-hidden>
                              <ReferenceIcon kind={item.icon} size={16} />
                            </span>
                          )}
                          <span className="dsh-ie-menu-name">{item.name}</span>
                          {item.description !== undefined && <span className="dsh-ie-menu-desc">{item.description}</span>}
                          {item.drill === true && (
                            <span className="dsh-ie-menu-trailing">
                              <kbd className="dsh-ie-menu-hint" aria-hidden>Tab</kbd>
                              <span
                                role="button"
                                aria-label="向下钻取（Tab）"
                                className="dsh-ie-menu-drill"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  onPick(group.source, index, 'drill')
                                }}
                              >
                                <IconChevronRightOutline14 />
                              </span>
                            </span>
                          )}
                        </button>
                      </Fragment>
                    )
                  })}
              </Fragment>
            )
        ))}
      </div>
    </div>
  )
}
