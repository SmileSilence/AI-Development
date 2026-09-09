/**
 * 原生 UI 组件测试桩：让组件测试自包含，不依赖未安装的 @deepseek-ai/dsh-client-ui-primitives。
 * 仅用于测试；发布与浏览器运行时使用 DSH 模块加载器提供的真实包。
 */
export function Menu({ open, items, selectedIds = [], onSelect, onClose, anchor }) {
  return (
    <span data-menu>
      {anchor}
      {open ? (
        <div data-menu-list>
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              data-testid="menu-item"
              data-selected={selectedIds.includes(item.id)}
              onClick={() => onSelect(item.id)}
            >
              {item.icon}
              {typeof item.label === 'string' ? item.label : null}
            </button>
          ))}
          <button type="button" data-testid="menu-close" onClick={onClose}>close</button>
        </div>
      ) : null}
    </span>
  )
}
export function IconCloseFill14() { return <span data-testid="icon-close" /> }
export function IconCheckOutline16() { return <span data-testid="icon-check" /> }
export function IconChevronRightOutline14() { return <span data-icon="chevron" /> }
export function IconChevronDownOutline14() { return <span data-icon="chevron-down" /> }
export function ReferenceIcon({ kind }) { return <span data-icon="ref" data-kind={String(kind)} /> }
export function useAnchoredMaxHeight() { return 320 }
export function useAnchoredPosition() { return {} }
export function StateDot() { return null }
export function DisclosureRow() { return null }
export function Button({ children }) { return <button type="button">{children}</button> }
export function Pill({ children }) { return <span>{children}</span> }
export function Input() { return <input /> }
export function HoverCard({ children }) { return <span>{children}</span> }
export function Modal({ children }) { return <span>{children}</span> }
export function OnboardingSurface({ children }) { return <span>{children}</span> }
export function RiskConfirmation() { return null }
export function ConnectionIndicator() { return null }
export function PinnedEvidence() { return null }
export function Tooltip() { return null }