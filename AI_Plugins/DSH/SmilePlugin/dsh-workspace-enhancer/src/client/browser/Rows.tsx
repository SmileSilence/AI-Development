/**
 * Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
 * all data and callbacks arrive via props. Hover swaps (folder->chevron,
 * time->ellipsis, action buttons) are CSS-only. Row ... menus are visual-only
 * except workspace Rename/Delete and session Rename/Fork/Archive; the session
 * and workspace hover cards are suppressed while a menu is open.
 */
import { useState } from 'react'
import clsx from 'clsx'
import type { BulkGesture } from './bulk-selection.ts'
import {
  HoverCard, IconAlarmClockOutline16, IconArchiveOutline20, IconBranchOutline16,
  IconCheckOutline16, IconEditOutline16, IconEllipsisOutline16, IconFolderClose16, IconFolderOpen16,
  IconFolderOpenOutline16, IconPersonalizationOutline16, IconPlusOutline16, IconTrashOutline16,
  IconTriangleRightFill14, Menu, relativeTime, StateDot, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { abbreviateHomePath } from '@deepseek-ai/dsh-util-workspace-path'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type { GroupNode, SearchResultNode, SessionNode } from '../tree.ts'
import { openDirectory } from '../open-directory.ts'
// ——— 标签子系统（集成自 dsh-workspace-tagger）———
import { DualTagPill, TagPill, type TagSegment } from '../tags/ui/TagPill.tsx'
import type { WorkspaceTaggerSettings } from '../tags/settings-types.ts'
import {
  getRunningTag, hexToRgba, ROW_TINT_ALPHA, tagById,
} from '../tags/tag-store.ts'
import { RunningRowEffect, RUNNING_ROW_CLASS, runningRowStyle } from './RunningRowEffect.tsx'
import css from './Rows.module.css'

/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t']

/**
 * 标签子系统行侧注入面（集成自 dsh-workspace-tagger）：每行拿到设置快照、
 * 标签文案与「设置标签」打开回调。
 */
export interface RowTaggerProps {
  /** 标签设置快照；未就绪（Host 未注册 schema / 仍在加载）时 undefined → 不渲染标签 UI。 */
  settings: WorkspaceTaggerSettings | undefined
  t: (key: 'menu.setTag') => string
  /** 打开「设置标签」弹窗。 */
  onSetTag: (target: TagTarget) => void
}

/** 标签目标：会话或工作区。 */
export type TagTarget = { kind: 'workspace'; id: string } | { kind: 'session'; id: string }

/** Row display title: blank rows show the localized New Session label. */
function displayTitle(node: SessionNode, t: RowTranslate): string {
  return node.blank ? t('session.new') : node.title
}

/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
function timeLabel(updatedAt: number, now: number, t: RowTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
function hoverTimeLabel(updatedAt: number, now: number, t: RowTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/**
 * Absolute creation time through the dictionary's date template (the message
 * clock pattern): `toLocaleString` would follow the browser language, not the
 * app locale, and produce mixed-language text after a switch.
 */
function createdLabel(createdAt: number, t: RowTranslate): string {
  const d = new Date(createdAt)
  const pad2 = (v: number): string => String(v).padStart(2, '0')
  const date = t('date.ymd', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() })
  return t('hover.created', { time: `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` })
}

/**
 * Hover-card body（需求 2）：三行 dsh 风格信息卡。
 *   行1 标题栏：双击变为输入框，可修改工作区名称（Enter/失焦提交，Esc 取消）。
 *   行2 路径：单击复制路径（✓ 反馈），双击在系统文件管理器打开目录。
 *   行3 日期：纯展示。
 * 深度契合 dsh 配色与 UI 风格（卡片/标题/次级文本均用 dsw-alias 令牌）。
 */
function WorkspaceHoverContent({ label, cwd, createdAt, t, onRename, sessionCount, ownTag, runningTag, runningCount }: {
  label: string
  cwd: string | undefined
  createdAt: number
  sessionCount: number
  ownTag?: TagSegment | undefined
  runningTag?: TagSegment | undefined
  runningCount: number
  t: RowTranslate
  /** 卡内双击标题改名：直接提交 Host（Promise 拒绝时恢复标题并展示失败）。 */
  onRename?: ((title: string) => Promise<void>) | undefined
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  const path = cwd ?? ''

  const commitRename = (): void => {
    if (onRename === undefined || renaming) return
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed === '' || trimmed === label) {
      setDraft(label)
      return
    }
    setRenaming(true)
    setRenameError(false)
    void onRename(trimmed).then(() => {
      setRenaming(false)
    }).catch(() => {
      setRenaming(false)
      setDraft(label)
      setRenameError(true)
    })
  }

  const copyPath = (): void => {
    if (path === '' || copied) return
    void writeClipboard(path).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1200)
    })
  }

  return (
    <div className={css.hoverCard}>
      {/* 行1 标题栏：双击进入编辑。 */}
      {editing ? (
        <input
          className={css.hoverRenameInput}
          value={draft}
          aria-label={t('rename.workspace.title')}
          autoFocus
          disabled={renaming}
          onChange={(e) => { setDraft(e.target.value); setRenameError(false) }}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            if (e.key === 'Escape') { setDraft(label); setEditing(false) }
          }}
        />
      ) : (
        <div
          className={css.hoverTitleRow}
          title={onRename === undefined ? undefined : t('hover.renameHint')}
          onDoubleClick={() => { if (onRename !== undefined) { setDraft(label); setEditing(true) } }}
        >
          <span className={css.hoverTitle}>{label}</span>
          {onRename !== undefined && (
            <span className={css.hoverEditIcon} aria-hidden="true">
              <IconEditOutline16 size={14} />
            </span>
          )}
        </div>
      )}
      {renameError && <div className={css.hoverRenameError} role="alert">{t('hover.renameFailed')}</div>}

      {/* 行2 路径：单击复制，双击打开。 */}
      {path !== '' && (
        <button
          type="button"
          className={clsx(css.hoverPathButton, failed && css.hoverPathFailed)}
          title={t('hover.pathHint')}
          disabled={opening}
          onClick={copyPath}
          onDoubleClick={() => {
            if (opening) return
            setOpening(true)
            setFailed(false)
            void openDirectory(path).then((result) => {
              setOpening(false)
              if (!result.opened) setFailed(true)
            })
          }}
        >
          {copied
            ? <IconCheckOutline16 size={14} />
            : <IconFolderOpenOutline16 size={14} />}
          <span className={css.hoverPath}>{copied ? t('hover.copied') : path}</span>
        </button>
      )}

      {/* 行3 日期：纯展示。 */}
      <div className={css.hoverTime}>{createdLabel(createdAt, t)}</div>
      <div className={css.hoverTime}>{t('hover.sessionCount', { n: sessionCount })}</div>
      {(ownTag !== undefined || (runningTag !== undefined && runningCount > 0)) && (
        <div className={css.workspaceHoverTags}>
          {ownTag !== undefined && <TagPill tag={ownTag} />}
          {runningTag !== undefined && runningCount > 0 && <TagPill tag={runningTag} count={runningCount} />}
        </div>
      )}
      {failed && <div className={css.hoverOpenError}>{t('hover.openFailed')}</div>}
    </div>
  )
}

/** Inline pin glyph（primitives 无 pin 图标；自绘 14px，匹配菜单 icon 槽）。
 * `active`（已置顶）= 实心；否则空心描边。修正了旧图标向右旋转 45° 的问题
 * （图标正立：针尖朝下、头朝上）。 */
function PinGlyph({ size = 14, active = false, className }: {
  size?: number
  /** 已置顶时为实心，否则空心描边。 */
  active?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
    >
      {active ? (
        <path
          fill="currentColor"
          d="M9.5 1.5a.5.5 0 0 1 .5.5v.5h1.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-.19l.44 3.06a1 1 0 0 1-.99 1.14H9V14a1 1 0 1 1-2 0v-4.3H5.24a1 1 0 0 1-.99-1.14l.44-3.06H4.5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1H6V2a.5.5 0 0 1 1 0v.5h2V2a.5.5 0 0 1 .5-.5Z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          d="M9.5 1.5a.5.5 0 0 1 .5.5v.5h1.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-.19l.44 3.06a1 1 0 0 1-.99 1.14H9V14a1 1 0 1 1-2 0v-4.3H5.24a1 1 0 0 1-.99-1.14l.44-3.06H4.5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1H6V2a.5.5 0 0 1 1 0v.5h2V2a.5.5 0 0 1 .5-.5Z"
        />
      )}
    </svg>
  )
}

/**
 * Row drag wiring supplied by the tree owner. `drop` reports the half of the
 * row where the pointer released so the owner can resolve an insert anchor.
 */
export interface RowDragProps {
  /** Start dragging this row. */
  start: () => void
  /** A compatible row drag is in flight. */
  active: boolean
  /** Current marker on this row: insert line above, below, or none. */
  marker: 'before' | 'after' | null
  /** Report the hovered half while a compatible drag passes over this row. */
  hover: (half: 'before' | 'after') => void
  drop: (half: 'before' | 'after') => void
  end: () => void
}

/** Drag lifecycle owned by a workspace row; its enclosing group owns hit testing. */
interface WorkspaceRowDragProps {
  start: () => void
  end: () => void
}

/** Pointer-position half of a row (insert line above or below). */
function rowHalf(e: { clientY: number; currentTarget: HTMLElement }): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/**
 * Project (workspace) header row: folder + title;
 * hover reveals the chevron and create button, and dwelling on a real
 * Workspace shows its hover card (the ungrouped bucket has none).
 * `containsCurrent` arrives on the node (derivation fact, no renderer scan).
 * @param props.group - derived group node.
 * @param props.onToggle - expand/collapse the group.
 * @param props.onCreate - start a frontend Session inside this Workspace.
 * @param props.drag - optional workspace-row drag wiring.
 * @param props.home - host account home for POSIX hover-path abbreviation.
 * @param props.t - the browser root's locale seat.
 * @returns the row element.
 */
export function ProjectRowItem({ group, onToggle, onCreate, actions, drag, home, t, onTogglePin, onRenameWorkspace, bulkMode, bulkActive, bulkSelected, onBulkToggle, tagger }: {
  group: GroupNode
  onToggle: () => void
  onCreate: () => void
  /** Real-Workspace actions; absent for the ungrouped bucket (no menu shown). */
  actions?: { rename: () => void; delete: () => void } | undefined
  /** Present only for real Workspace rows in the grouped view. */
  drag?: WorkspaceRowDragProps | undefined
  /** Host account home; POSIX home-rooted hover paths display as `~`. */
  home?: string | undefined
  t: RowTranslate
  /** Toggle the workspace's pin state (enhancer). */
  onTogglePin?: (() => void) | undefined
  /** 悬停卡内双击标题直接改名（需求 2）。 */
  onRenameWorkspace?: ((title: string) => Promise<void>) | undefined
  /** 批量模式（需求 5）显示勾选框。 */
  bulkMode?: boolean | undefined
  bulkActive?: boolean | undefined
  bulkSelected?: boolean | undefined
  onBulkToggle?: ((gesture: BulkGesture) => void) | undefined
  /** 标签子系统行侧注入面（集成自 dsh-workspace-tagger）。 */
  tagger?: RowTaggerProps | undefined
}) {
  const row = group
  // The ungrouped bucket has no workspace title: its label is dictionary copy.
  const label = row.workspaceId === undefined ? t('group.ungrouped') : row.label
  const active = group.expanded && group.containsCurrent
  const [menuOpen, setMenuOpen] = useState(false)
  // 标签子系统：行生效标签（运行覆盖 + 折叠覆盖）。折叠且有运行中会话时，
  // 显示「运行标签名×N」（任务 B 扩展1）；计数只出现在折叠态的工作区行。
  const tagView = tagger === undefined || tagger.settings === undefined || row.workspaceId === undefined
    ? undefined
    : (() => {
      const hasRunning = row.runningSessionCount > 0
      const running = !row.expanded && hasRunning ? getRunningTag(tagger.settings) : undefined
      const id = tagger.settings.workspaceTags[row.workspaceId]
      const tag = running ?? (id === undefined ? undefined : tagById(tagger.settings, id))
      if (tag === undefined) return undefined
      // 仅当折叠、有运行中会话且配置了运行标签时附加计数（否则显示自身标签，无计数）。
      const count = running !== undefined
        ? row.runningSessionCount
        : undefined
      return { tag, count, running: running !== undefined }
    })()
  const runningRowTag = tagView?.running === true ? tagView.tag : undefined
  const ordinaryTint = tagView === undefined || tagView.running
    ? undefined : hexToRgba(tagView.tag.color, ROW_TINT_ALPHA)
  const workspaceMenuItems = [
    ...(onTogglePin === undefined
      ? []
      : [{ id: 'pin', label: row.pinned ? t('menu.unpin') : t('menu.pin'), icon: <PinGlyph active={row.pinned} /> }]),
    // 需求 3：工作区菜单含「打开工作区」（仅真实工作区有目录）。
    ...(row.cwd === undefined || row.cwd === ''
      ? []
      : [{ id: 'open', label: t('menu.openWorkspace'), icon: <IconFolderOpenOutline16 /> }]),
    // 标签子系统（集成自 dsh-workspace-tagger）：仅真实工作区行 + 标签可用时。
    ...(tagger !== undefined && tagger.settings !== undefined && row.workspaceId !== undefined
      ? [{ id: 'setTag', label: tagger.t('menu.setTag'), icon: <IconPersonalizationOutline16 /> }]
      : []),
    { id: 'rename', label: t('rename'), icon: <IconEditOutline16 /> },
    { id: 'delete', label: t('delete.workspace'), icon: <IconTrashOutline16 />, danger: true },
  ]
  const ownRow = (
    <div
      className={clsx(css.projectRow, menuOpen && css.menuOpen, bulkSelected && css.bulkSelected,
        runningRowTag !== undefined && RUNNING_ROW_CLASS)}
      role="treeitem"
      aria-expanded={row.expanded}
      aria-selected={bulkMode ? bulkSelected === true : undefined}
      data-bulk-key={bulkMode && onBulkToggle ? row.workspaceId : undefined}
      data-bulk-kind={bulkMode && onBulkToggle ? 'workspace' : undefined}
      style={runningRowTag !== undefined ? runningRowStyle(runningRowTag)
        : ordinaryTint === undefined ? undefined : { boxShadow: `inset 0 0 0 1000px ${ordinaryTint}` }}
      onClick={(e) => { if (bulkMode && onBulkToggle) onBulkToggle(e); else if (!bulkActive) onToggle() }}
      onContextMenu={actions === undefined
        ? undefined
        : (e) => {
          // 右键 = ···菜单（需求 3）：阻止浏览器菜单并打开行菜单。
          e.preventDefault()
          setMenuOpen(true)
        }}
      draggable={drag !== undefined && !bulkActive}
      onDragStart={drag === undefined
        ? undefined
        : (e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', row.key)
          drag.start()
        }}
      onDragEnd={drag?.end}
    >
      <RunningRowEffect tag={runningRowTag} />
      {bulkMode === true && onBulkToggle !== undefined && (
        <span className={css.bulkCheckbox} onClick={(e) => { e.stopPropagation() }}>
          <input
            type="checkbox"
            aria-label={t('bulk.aria.checkWorkspace')}
            checked={bulkSelected === true}
            onChange={() => { /* 点击事件统一处理修饰键，避免重复切换。 */ }}
            onClick={(e) => { e.stopPropagation(); onBulkToggle({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, checkbox: true }) }}
          />
        </span>
      )}
      <span className={clsx(css.slot, css.folder, active && css.folderActive)}>
        {row.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
      </span>
      <button type="button" className={clsx(css.slot, css.chevron, css.expandButton)} aria-label={row.expanded ? "折叠工作区" : "展开工作区"} onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <IconTriangleRightFill14 className={clsx(css.arrow, row.expanded && css.arrowOpen)} />
      </button>
      {tagView !== undefined && (
        <span className={css.rowPillSlot}>
          <TagPill
            tag={tagView.tag}
            count={tagView.count}
          />
        </span>
      )}
      <span className={css.projectText}>
        <span className={css.title}>{label}</span>
      </span>
      <span className={css.rowActions}>
        {actions !== undefined && (
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={workspaceMenuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              // Unknown ids leave before the dispatch: a future menu row must
              // not inherit the destructive branch as an else fallback.
              if (id === 'pin') {
                onTogglePin?.()
                return
              }
              // 打开工作区（需求 3）：目录在系统文件管理器中打开。
              if (id === 'open') {
                if (row.cwd !== undefined && row.cwd !== '') void openDirectory(row.cwd)
                return
              }
              // 设置标签（集成自 dsh-workspace-tagger）。
              if (id === 'setTag') {
                if (row.workspaceId !== undefined) tagger?.onSetTag({ kind: 'workspace', id: row.workspaceId })
                return
              }
              if (id !== 'rename' && id !== 'delete') return
              if (id === 'rename') actions.rename()
              else actions.delete()
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('actions.workspace.aria', { name: label })}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              >
                <IconEllipsisOutline16 />
              </button>
            )}
          />
        )}
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('actions.newSession.aria', { name: label })}
          onClick={(e) => { e.stopPropagation(); onCreate() }}
        >
          <IconPlusOutline16 />
        </button>
      </span>
    </div>
  )
  // The ungrouped bucket has no backing Workspace: no card to show.
  if (row.createdAt === undefined) return ownRow
  // copyText 不再传给 HoverCard：卡内路径行自管「单击复制 / 双击打开」（需求 2），
  // 整卡复制会吞掉路径行的双击打开手势。（copyLabel/copiedLabel 是必填 prop，
  // 保留传值但不启用整卡复制行为。）
  return (
    <HoverCard
      anchor={ownRow}
      content={<WorkspaceHoverContent
        label={row.label}
        cwd={row.cwd === undefined ? undefined : abbreviateHomePath(row.cwd, home)}
        createdAt={row.createdAt}
        sessionCount={row.totalSessionCount}
        runningCount={row.runningSessionCount}
        ownTag={tagger?.settings === undefined || row.workspaceId === undefined
          ? undefined : tagById(tagger.settings, tagger.settings.workspaceTags[row.workspaceId] ?? '')}
        runningTag={tagger?.settings === undefined ? undefined : getRunningTag(tagger.settings)}
        t={t}
        onRename={onRenameWorkspace}
      />}
      disabled={menuOpen}
      copyLabel={t('copy')}
      copiedLabel={t('hover.copied')}
    />
  )
}

/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
function assertNever(value: never): never {
  throw new Error(`unknown pending interaction: ${String(value)}`)
}

interface SessionStatus {
  state: StateDotState
  label: string
}

/**
 * Session status presentation; pending interaction is primary and live activity
 * outranks completion reminders.
 */
function sessionStatuses(
  node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>,
  t: RowTranslate,
): readonly [SessionStatus, ...SessionStatus[]] {
  const subagents: SessionStatus | undefined = node.runningSubagentCount === 0
    ? undefined
    : {
      state: 'ongoing',
      label: t(
        node.runningSubagentCount === 1
          ? 'status.subagentsRunning.one'
          : 'status.subagentsRunning.other',
        { n: node.runningSubagentCount },
      ),
    }
  let pending: SessionStatus | undefined
  switch (node.pendingInteraction) {
    case 'approval':
      pending = { state: 'warning', label: t('status.waitingApproval') }
      break
    case 'plan-review':
      pending = { state: 'warning', label: t('status.planReview') }
      break
    case 'question':
      pending = { state: 'warning', label: t('status.waitingAnswer') }
      break
    case undefined: break
    /* v8 ignore next -- closed PendingInteractionStatus union */
    default: return assertNever(node.pendingInteraction)
  }
  if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents]
  if (node.running) {
    const primary: SessionStatus = { state: 'ongoing', label: t('status.running') }
    return subagents === undefined ? [primary] : [primary, subagents]
  }
  if (subagents !== undefined) return [subagents]
  if (node.completed) return [{ state: 'done', label: t('status.completed') }]
  return [{ state: 'done', label: t('status.idle') }]
}

/** Primary status dot plus every status's screen-reader label, shared by the search and session rows. */
function SessionStatusDots({ statuses }: { statuses: readonly [SessionStatus, ...SessionStatus[]] }) {
  return (
    <>
      <StateDot state={statuses[0].state} />
      {statuses.map(status => (
        <span className={css.visuallyHidden} key={status.label}>{status.label}</span>
      ))}
    </>
  )
}

/** Non-interactive active-Schedule marker; the enclosing row remains the only action. */
function ActiveScheduleIndicator({ t, search = false }: { t: RowTranslate; search?: boolean }) {
  const label = t('schedule.active')
  return (
    <span
      className={clsx(css.scheduleIndicator, search && css.searchScheduleIndicator)}
      role="img"
      aria-label={label}
      title={label}
    >
      <IconAlarmClockOutline16 />
    </span>
  )
}

/** Hover-card body: full title, relative time, and every relevant live status. */
function SessionHoverContent({ node, now, t }: { node: SessionNode; now: number; t: RowTranslate }) {
  const statuses = sessionStatuses(node, t)
  return (
    <div className={css.hoverContent}>
      <div className={css.hoverTitle}>{displayTitle(node, t)}</div>
      {/* Same placeholder rule as the row's trailing cell: no timestamp
          before the first prompt. */}
      {!node.blank && <div className={css.hoverTime}>{hoverTimeLabel(node.updatedAt, now, t)}</div>}
      {statuses.map(status => (
        <div className={css.hoverStatus} key={status.label}>
          <StateDot state={status.state} />
          <span>{status.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * One flat search result: title, Workspace context, and optional content
 * excerpt. Search navigation opens the session only; it does not address an
 * event inside the conversation.
 * @param props.result - merged local/content search row.
 * @param props.currentId - selected session id.
 * @param props.onOpen - open the selected session.
 * @param props.t - Workspace-browser translation seat.
 * @returns the result button.
 */
export function SearchResultItem({ result, currentId, onOpen, tagger, t, bulkMode, bulkActive, bulkSelected, onBulkToggle }: {
  bulkMode?: boolean
  bulkActive?: boolean
  bulkSelected?: boolean
  onBulkToggle?: (gesture: BulkGesture) => void
  result: SearchResultNode
  currentId: string | undefined
  onOpen: (id: SearchResultNode['id']) => void
  tagger?: RowTaggerProps | undefined
  t: RowTranslate
}) {
  const selected = result.id === currentId
  const statuses = sessionStatuses(result, t)
  const primaryStatus = statuses[0]
  // 标签子系统：搜索结果会话生效标签（单色胶囊）。
  const backTag = tagger === undefined || tagger.settings === undefined
    ? undefined
    : (() => {
      const id = tagger.settings.sessionTags[result.id]
      return (result.running ? getRunningTag(tagger.settings) : undefined)
        ?? (id === undefined ? undefined : tagById(tagger.settings, id))
    })()
  const runningRowTag = result.running && tagger?.settings !== undefined
    ? getRunningTag(tagger.settings) : undefined
  const ordinaryTint = backTag === undefined || runningRowTag !== undefined
    ? undefined : hexToRgba(backTag.color, ROW_TINT_ALPHA)
  return (
    <div
      tabIndex={0}
      className={clsx(css.searchResultRow, selected && !bulkMode && css.selected, bulkSelected && css.bulkSelected,
        runningRowTag !== undefined && RUNNING_ROW_CLASS)}
      style={runningRowTag !== undefined ? runningRowStyle(runningRowTag)
        : ordinaryTint === undefined ? undefined : { boxShadow: `inset 0 0 0 1000px ${ordinaryTint}` }}
      role="treeitem"
      aria-selected={bulkMode ? bulkSelected === true : selected}
      data-bulk-key={bulkMode ? result.id : undefined}
      data-bulk-kind={bulkMode ? 'session' : undefined}
      onClick={(e) => { if (bulkMode) onBulkToggle?.(e); else if (!bulkActive) onOpen(result.id) }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        if (bulkMode) onBulkToggle?.(e); else if (!bulkActive) onOpen(result.id)
      }}
    >
      <RunningRowEffect tag={runningRowTag} />
      <span className={css.searchResultHeading}>
        {bulkMode && onBulkToggle && (
          <span className={css.bulkCheckbox} onClick={(e) => { e.stopPropagation() }}>
            <input type="checkbox" aria-label={t('bulk.aria.checkSession')} checked={bulkSelected === true}
              onChange={() => { /* 点击统一处理。 */ }}
              onClick={(e) => { e.stopPropagation(); onBulkToggle({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, checkbox: true }) }} />
          </span>
        )}
        <span className={css.slot}>
          {(primaryStatus.state !== 'done' || result.completed) && (
            <SessionStatusDots statuses={statuses} />
          )}
        </span>
        {backTag !== undefined && (
          <span className={css.rowPillSlot}>
            <TagPill tag={backTag} />
          </span>
        )}
        <span className={css.searchResultTitle}>{result.title}</span>
        {result.hasActiveSchedule && <ActiveScheduleIndicator t={t} search />}
      </span>
      <span className={css.searchResultMeta}>
        <span className={css.searchResultWorkspace}>{result.workspace || t('group.ungrouped')}</span>
        {result.snippet !== undefined && (
          <span className={css.searchResultSnippet}>{result.snippet}</span>
        )}
      </span>
    </div>
  )
}

/**
 * One top-level 34px session row: status dot (pending user interaction outranks
 * own or descendant activity), title, relative time, and the row actions menu.
 * @param props.node - derived session node.
 * @param props.currentId - selected session id (row highlight).
 * @param props.now - epoch ms for relative-time formatting.
 * @param props.onOpen - open a session by id.
 * @param props.onRename - open the session rename dialog (id + current title).
 * @param props.onFork - fork a session at its last completed turn.
 * @param props.onArchive - archive a session by id.
 * @param props.drag - optional draggable-row wiring.
 * @param props.flat - omit the empty status slot in the hierarchy-free flat list.
 * @param props.t - the browser root's locale seat.
 * @returns the session row.
 */
export function SessionNodeItem({ node, currentId, now, onOpen, onRename, onFork, onArchive, onTogglePin, drag, flat = false, t, bulkMode, bulkActive, bulkSelected, onBulkToggle, tagger, workspaceFront }: {
  node: SessionNode
  currentId: string | undefined
  now: number
  onOpen: (id: SessionNode['id']) => void
  /** Open the browser-owned session rename dialog (row menu action). */
  onRename: (id: SessionNode['id'], currentTitle: string) => void
  /** Fork a session at its last completed turn (row menu action). */
  onFork: (id: SessionNode['id']) => void
  /** Archive this session (row menu action; commits without a dialog). */
  onArchive: (id: SessionNode['id']) => void
  /** Toggle this session's pin state (enhancer). */
  onTogglePin?: (() => void) | undefined
  /** Present only on draggable rows (workspace-group sessions outside search). */
  drag?: RowDragProps | undefined
  /** The row is rendered without a parent Workspace header. */
  flat?: boolean | undefined
  t: RowTranslate
  /** 批量模式（需求 5）显示勾选框。 */
  bulkMode?: boolean | undefined
  bulkActive?: boolean | undefined
  bulkSelected?: boolean | undefined
  onBulkToggle?: ((gesture: BulkGesture) => void) | undefined
  /** 标签子系统行侧注入面（集成自 dsh-workspace-tagger）。 */
  tagger?: RowTaggerProps | undefined
  /** 双色胶囊前段 = 工作区自身标签（会话行内展示）。 */
  workspaceFront?: TagSegment | undefined
}) {
  const row = node
  const title = displayTitle(node, t)
  const selected = node.id === currentId
  const statuses = sessionStatuses(node, t)
  const primaryStatus = statuses[0]
  const showStatus = primaryStatus.state !== 'done' || row.completed
  const [menuOpen, setMenuOpen] = useState(false)
  // 标签子系统：会话行生效标签（运行中会话用运行标签）+ 微着色。
  const backTag = tagger === undefined || tagger.settings === undefined
    ? undefined
    : (() => {
      const id = tagger.settings.sessionTags[node.id]
      return (row.running ? getRunningTag(tagger.settings) : undefined)
        ?? (id === undefined ? undefined : tagById(tagger.settings, id))
    })()
  const runningRowTag = row.running && tagger?.settings !== undefined
    ? getRunningTag(tagger.settings) : undefined
  const tint = backTag === undefined || runningRowTag !== undefined
    ? undefined : hexToRgba(backTag.color, ROW_TINT_ALPHA)
  // Archive hides the row through the registry-global archive set and never
  // touches the session log, so it is not styled as destructive and needs no
  // confirmation dialog.
  const sessionMenuItems = [
    ...(onTogglePin === undefined
      ? []
      : [{ id: 'pin', label: row.pinned ? t('menu.unpin') : t('menu.pin'), icon: <PinGlyph active={row.pinned} /> }]),
    // 标签子系统（集成自 dsh-workspace-tagger）：标签可用时。
    ...(tagger !== undefined && tagger.settings !== undefined
      ? [{ id: 'setTag', label: tagger.t('menu.setTag'), icon: <IconPersonalizationOutline16 /> }]
      : []),
    { id: 'rename', label: t('rename'), icon: <IconEditOutline16 /> },
    { id: 'fork', label: t('menu.fork'), icon: <IconBranchOutline16 /> },
    // 20-native glyph in the menu's 16px icon slot (Menu.module.css .itemIcon).
    { id: 'archive', label: t('menu.archiveSession'), icon: <IconArchiveOutline20 size={16} /> },
  ]
  // Figma session cell: pad 8, status slot 16, then a 4px title gap.
  const ownRow = (
    <div
      className={clsx(
        css.sessionRow, selected && !bulkMode && css.selected, menuOpen && css.menuOpen, bulkSelected && css.bulkSelected,
        runningRowTag !== undefined && RUNNING_ROW_CLASS,
        flat && !showStatus && css.flatSessionRowWithoutStatus,
        drag?.marker === 'before' && css.dropBefore, drag?.marker === 'after' && css.dropAfter,
      )}
      style={runningRowTag !== undefined ? runningRowStyle(runningRowTag)
        : tint === undefined ? undefined : { boxShadow: `inset 0 0 0 1000px ${tint}` }}
      role="treeitem"
      aria-selected={bulkMode ? bulkSelected === true : selected}
      data-bulk-key={bulkMode && !node.blank ? node.id : undefined}
      data-bulk-kind={bulkMode && !node.blank ? 'session' : undefined}
      onClick={(e) => { if (bulkMode) { if (!node.blank) onBulkToggle?.(e) } else if (!bulkActive) onOpen(node.id) }}
      onContextMenu={(e) => {
        // 右键 = ···菜单（需求 3）。
        e.preventDefault()
        setMenuOpen(true)
      }}
      draggable={drag !== undefined && !bulkActive}
      onDragStart={drag === undefined
        ? undefined
        : (e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
          drag.start()
        }}
      onDragEnd={drag?.end}
      onDragOver={drag === undefined
        ? undefined
        : (e) => {
          if (!drag.active) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          drag.hover(rowHalf(e))
        }}
      onDrop={drag === undefined
        ? undefined
        : (e) => {
          if (!drag.active) return
          e.preventDefault()
          drag.drop(rowHalf(e))
        }}
    >
      <RunningRowEffect tag={runningRowTag} />
      {bulkMode === true && !node.blank && onBulkToggle !== undefined && (
        <span className={css.bulkCheckbox} onClick={(e) => { e.stopPropagation() }}>
          <input
            type="checkbox"
            aria-label={t('bulk.aria.checkSession')}
            checked={bulkSelected === true}
            onChange={() => { /* 点击事件统一处理修饰键，避免重复切换。 */ }}
            onClick={(e) => { e.stopPropagation(); onBulkToggle({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, checkbox: true }) }}
          />
        </span>
      )}
      {/* Pending interaction and own or descendant activity outrank the
          finished-but-unviewed reminder, which returns after activity stops
          and is cleared by opening the session. */}
      {(!flat || showStatus) && (
        <span className={css.slot}>
          {showStatus && <SessionStatusDots statuses={statuses} />}
        </span>
      )}
      {/* 标签子系统（集成自 dsh-workspace-tagger）：标签固定显示在会话名称左侧。 */}
      {!row.blank && backTag !== undefined && tagger !== undefined && tagger.settings !== undefined && (
        <span className={css.rowPillSlot}>
          <DualTagPill
            front={workspaceFront}
            back={backTag}
            splitRatio={tagger.settings.splitRatio}
          />
        </span>
      )}
      <span className={css.title}>{title}</span>
      {row.hasActiveSchedule && <ActiveScheduleIndicator t={t} />}
      {/* A blank New Session row is a provisional placeholder: nothing has
          happened in it yet, so a "now" timestamp and the row verbs
          (rename/fork/archive) would all act on content that does not
          exist — both trailing cells stay off until the first prompt. */}
      {!row.blank && <span className={css.time}>{timeLabel(row.updatedAt, now, t)}</span>}
      {!row.blank && (
        <span className={css.rowActions}>
          {/* 置顶快捷按钮（需求 1）：Menu 触发器左侧。 */}
          {onTogglePin !== undefined && (
            <button
              type="button"
              className={clsx(css.iconButton, row.pinned && css.pinActive)}
              aria-label={row.pinned ? t('menu.unpin') : t('menu.pin')}
              aria-pressed={row.pinned}
              onClick={(e) => { e.stopPropagation(); onTogglePin() }}
            >
              <PinGlyph size={14} active={row.pinned} />
            </button>
          )}
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={sessionMenuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'pin') { onTogglePin?.(); return }
              if (id === 'setTag') { tagger?.onSetTag({ kind: 'session', id: node.id }); return }
              if (id === 'rename') onRename(node.id, row.title)
              if (id === 'fork') onFork(node.id)
              if (id === 'archive') onArchive(node.id)
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('actions.session.aria', { name: title })}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              >
                <IconEllipsisOutline16 />
              </button>
            )}
          />
        </span>
      )}
    </div>
  )
  return (
    <HoverCard
      anchor={ownRow}
      content={<SessionHoverContent node={node} now={now} t={t} />}
      disabled={menuOpen || drag?.active === true}
      copyText={row.blank ? undefined : row.title}
      copyLabel={t('copy')}
      copiedLabel={t('hover.copied')}
    />
  )
}
