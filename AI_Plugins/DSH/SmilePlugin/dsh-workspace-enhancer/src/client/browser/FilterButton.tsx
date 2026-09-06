/**
 * dsh-workspace-enhancer — 标签筛选器（v0.4.0 改造）。
 *
 * 由「标题栏右侧一个筛选图标按钮」+「点击弹出的筛选面板」组成（飞书多维表格式）：
 *  - 仅宽侧栏（wide）挂载；rail 窄侧栏保持现状不加筛选按钮。
 *  - 面板支持多条件行，行间 AND；每行独立选择范围（全部/工作区/会话）、
 *    条件（包含/不包含/等于）与标签（等于单选、包含/不包含多选），可增删行。
 *  - 面板打开时回显当前生效筛选，修改实时生效；筛选生效时按钮高亮。
 *  - 面板用 portal 固定定位（useAnchoredPosition），点击外部 / Esc 关闭。
 */
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import {
  Button, IconChevronDownOutline14, IconCloseFill14, IconPlusOutline16,
  Menu, Tooltip, useAnchoredPosition, useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceTaggerSettings } from '../tags/settings-types.ts'
import {
  TAG_FILTER_NO_TAG, isTagFilterInactive,
  type TagFilter, type TagFilterCondition, type TagFilterRule, type TagFilterScope,
} from '../tree.ts'
import css from './WorkspaceBrowser.module.css'

export interface FilterButtonProps {
  /** 标签设置快照（父层只在就绪后渲染本组件）。 */
  settings: WorkspaceTaggerSettings
  t: TranslateNS<'workspace-tagger'>
  filter: TagFilter
  onChange: (filter: TagFilter) => void
  /** 当前筛选命中总数（工作区组 + 会话行），未启用时为 0。 */
  resultCount: number
}

/** 本组件自带的漏斗形「筛选」图标（图标集无 IconFilter，按 IconProps 约定绘制）。 */
export function FilterGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.6 2.4c0-.55.45-1 1-1h10.8c.55 0 1 .45 1 1 0 .27-.1.52-.29.72l-4.31 4.6v4.16c0 .38-.21.73-.55.9l-2.6 1.3c-.52.26-1.15-.12-1.15-.71V7.72L1.89 3.12c-.19-.2-.29-.45-.29-.72Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 条件行 id 生成（会话内唯一即可）。 */
let ruleSeq = 0
function nextRuleId(): string {
  ruleSeq += 1
  return `r${ruleSeq}`
}

/** 标签选择锚点文案：空=全部标签；单选=该标签名（含「无标签」）；多选=计数。 */
function tagSelectionLabel(
  rule: TagFilterRule,
  settings: WorkspaceTaggerSettings,
  t: TranslateNS<'workspace-tagger'>,
): string {
  if (rule.tagIds.length === 0) return t('filter.allTags')
  if (rule.tagIds.length === 1) {
    const tagId = rule.tagIds[0]
    if (tagId === TAG_FILTER_NO_TAG) return t('dialog.noTag')
    return settings.tags.find(tag => tag.id === tagId)?.name ?? tagId
  }
  return t('filter.tagsCount', { n: String(rule.tagIds.length) })
}

/** 条件行内的单选小下拉（范围 / 条件）。 */
function RuleSelect({ value, options, label, onPick, anchorClass }: {
  value: string
  options: readonly { id: string; label: string }[]
  label: string
  onPick: (id: string) => void
  anchorClass: string
}) {
  const [open, setOpen] = useState(false)
  const picked = options.find(option => option.id === value)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={options.map(option => ({ id: option.id, label: option.label }))}
      selectedId={value}
      onSelect={(id) => { setOpen(false); onPick(id) }}
      align="start"
      side="bottom"
      dense
      anchor={(
        <button
          type="button"
          className={anchorClass}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={() => { setOpen(v => !v) }}
        >
          <span className={css.filterRuleSelectText}>{picked?.label ?? value}</span>
          <IconChevronDownOutline14 className={css.filterChevron} />
        </button>
      )}
    />
  )
}

export function FilterButton({ settings, t, filter, onChange, resultCount }: FilterButtonProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition({ open, anchorRef: buttonRef, panelRef, side: 'bottom', gap: 6, margin: 8 })
  useDismissOnOutsidePointer(buttonRef, open, setOpen, panelRef)
  // Esc 关闭面板（与点击外部关闭一致；面板内的行内下拉自身处理 Esc）。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [open])

  const active = !isTagFilterInactive(filter)

  /** 规则编辑（实时生效；一旦任一行选入标签即视为启用筛选）。 */
  const updateRule = (ruleId: string, patch: Partial<Omit<TagFilterRule, 'id'>>): void => {
    const rules = filter.rules.map(rule => rule.id === ruleId ? { ...rule, ...patch } : rule)
    onChange({ enabled: rules.some(rule => rule.tagIds.length > 0), rules })
  }
  const addRule = (): void => {
    onChange({ ...filter, rules: [...filter.rules, { id: nextRuleId(), scope: 'all', condition: 'include', tagIds: [] }] })
  }
  const removeRule = (ruleId: string): void => {
    onChange({ ...filter, rules: filter.rules.filter(rule => rule.id !== ruleId) })
  }
  const clearAll = (): void => {
    onChange({ enabled: false, rules: [] })
  }

  return (
    <>
      <Tooltip label={t('filter.title')} side="bottom" delayMs={500}>
        <button
          ref={buttonRef}
          type="button"
          className={clsx(css.iconButton, css.filterButton, active && css.filterButtonActive)}
          aria-label={t('filter.title')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={active}
          onClick={() => { setOpen(v => !v) }}
        >
          <FilterGlyph size={14} />
          {active && <span className={css.filterBadge} aria-hidden="true" />}
        </button>
      </Tooltip>
      {open && createPortal(
        <div
          ref={panelRef}
          className={css.filterPanel}
          style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog"
          aria-label={t('filter.title')}
          onClick={(e) => { e.stopPropagation() }}
        >
          <div className={css.filterPanelHeader}>
            <span className={css.filterPanelTitle}>{t('filter.title')}</span>
            {active && <span className={css.filterPanelCount}>{t('filter.filtered', { n: String(resultCount) })}</span>}
          </div>
          <div className={css.filterRules}>
            {filter.rules.length === 0 ? (
              <div className={css.filterEmpty}>{t('filter.empty')}</div>
            ) : filter.rules.map(rule => (
              <div key={rule.id} className={css.filterRuleRow}>
                {/* 本行范围 */}
                <RuleSelect
                  value={rule.scope}
                  options={[
                    { id: 'all', label: t('filter.scopeAll') },
                    { id: 'workspace', label: t('filter.scopeWorkspace') },
                    { id: 'session', label: t('filter.scopeSession') },
                  ]}
                  label={t('filter.scopeAll')}
                  onPick={(id) => { updateRule(rule.id, { scope: id as TagFilterScope }) }}
                  anchorClass={css.filterRuleSelect}
                />
                {/* 本行条件 */}
                <RuleSelect
                  value={rule.condition}
                  options={[
                    { id: 'include', label: t('filter.conditionInclude') },
                    { id: 'exclude', label: t('filter.conditionExclude') },
                    { id: 'equals', label: t('filter.conditionEquals') },
                  ]}
                  label={t('filter.conditionInclude')}
                  onPick={(id) => {
                    // 「等于」只能指定单个标签：切换条件时截断多选。
                    const condition = id as TagFilterCondition
                    updateRule(rule.id, condition === 'equals'
                      ? { condition, tagIds: rule.tagIds.slice(0, 1) }
                      : { condition })
                  }}
                  anchorClass={css.filterRuleSelect}
                />
                {/* 本行标签（等于单选 / 包含、不包含多选） */}
                <TagRuleSelect
                  rule={rule}
                  settings={settings}
                  t={t}
                  onToggle={(tagId) => {
                    if (rule.condition === 'equals') {
                      updateRule(rule.id, { tagIds: [tagId] })
                    } else {
                      const has = rule.tagIds.includes(tagId)
                      updateRule(rule.id, {
                        tagIds: has ? rule.tagIds.filter(existing => existing !== tagId) : [...rule.tagIds, tagId],
                      })
                    }
                  }}
                />
                {/* 删除本行 */}
                <button
                  type="button"
                  className={css.filterRuleDelete}
                  aria-label={t('filter.removeRule')}
                  title={t('filter.removeRule')}
                  onClick={() => { removeRule(rule.id) }}
                >
                  <IconCloseFill14 />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={css.filterAddRule} onClick={addRule}>
            <IconPlusOutline16 /> {t('filter.addRule')}
          </button>
          <div className={css.filterPanelFooter}>
            <Button variant="outline" size="sm" disabled={!active && filter.rules.length === 0} onClick={clearAll}>
              {t('filter.clearAll')}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/** 条件行内的标签下拉（含「无标签」+ 全部标签色块）。 */
function TagRuleSelect({ rule, settings, t, onToggle }: {
  rule: TagFilterRule
  settings: WorkspaceTaggerSettings
  t: TranslateNS<'workspace-tagger'>
  onToggle: (tagId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (tagId: string): void => {
    onToggle(tagId)
    if (rule.condition === 'equals') setOpen(false)
  }
  const anchorText = tagSelectionLabel(rule, settings, t)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { id: TAG_FILTER_NO_TAG, label: t('dialog.noTag') },
        ...settings.tags.map(tag => ({
          id: tag.id,
          label: tag.name,
          icon: <span className={css.filterSwatch} style={{ backgroundColor: tag.color }} />,
        })),
      ]}
      selectedIds={rule.tagIds}
      onSelect={pick}
      align="start"
      side="bottom"
      dense
      anchor={(
        <button
          type="button"
          className={clsx(css.filterRuleSelect, css.filterRuleTagSelect)}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => { setOpen(v => !v) }}
        >
          <span className={css.filterRuleSelectText}>{anchorText}</span>
          <IconChevronDownOutline14 className={css.filterChevron} />
        </button>
      )}
    />
  )
}
