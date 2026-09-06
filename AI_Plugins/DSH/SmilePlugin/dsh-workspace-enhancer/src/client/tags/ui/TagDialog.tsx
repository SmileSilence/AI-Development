/**
 * dsh-workspace-tagger — 标签设置弹窗（M2，任务 A 优化版）。
 *
 * 三行布局：
 *  1) 标签选择：单个下拉菜单（无标签 + 各普通标签；会话运行中标签 runningTagId
 *     不出现，只能在设置页「标签管理」里单独配置）
 *  2) 管理模式：增加（行内输入）/ 编辑 / 删除（行内二次确认 + 使用计数）；
 *     编辑/删除只针对下拉框当前选中的普通标签
 *  3) 颜色：选中标签的 Unity 风格颜色选择器（[应用颜色] 提交持久化）
 *  4) 按钮：取消 | 确定（确定只提交分配，增/删/色各自确认后即时持久化）
 *
 * 目标（工作区/会话）由父层决定：current 为当前分配，onAssign 提交分配。
 */
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import {
  Button, IconChevronDownOutline14, IconEditOutline16, IconPlusOutline16, IconTrashOutline16,
  Menu, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TagDefinition, WorkspaceTaggerSettings } from '../settings-types.ts'
import { tagNameError } from '../tag-store.ts'
import type { TaggerController } from '../tagger-controller.ts'
import { ColorPicker } from './ColorPicker.tsx'
import css from './TagDialog.module.css'

export interface TagDialogProps {
  /** 弹窗标题（设置工作区标签 / 设置会话标签）。 */
  title: string
  /** 当前标签设置快照（未就绪时为 undefined → 不可用态）。 */
  settings: WorkspaceTaggerSettings | undefined
  /** 目标当前分配的标签 id（无标签 = null）。 */
  current: string | null
  t: TranslateNS<'workspace-tagger'>
  /** 标签控制器（增/删/改色/自定义预设）。 */
  controller: TaggerController
  /** 提交分配（确定）：tagId=null 清除。 */
  onAssign: (tagId: string | null) => Promise<void>
  /** 关闭弹窗。 */
  onClose: () => void
}

/** 下拉里「无标签」选项的哨兵 id（与 nextTagId 的 tag-N 命名不冲突）。 */
const NO_TAG_OPTION = '__no_tag__'

/** 使用计数（删除确认文案）。 */
function usageOf(settings: WorkspaceTaggerSettings, tagId: string): { workspaces: number; sessions: number } {
  let workspaces = 0
  let sessions = 0
  for (const id of Object.values(settings.workspaceTags)) if (id === tagId) workspaces++
  for (const id of Object.values(settings.sessionTags)) if (id === tagId) sessions++
  return { workspaces, sessions }
}

export function TagDialog({ title, settings, current, t, controller, onAssign, onClose }: TagDialogProps) {
  const [selected, setSelected] = useState<string | null>(current)
  const [selectOpen, setSelectOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [colorDraft, setColorDraft] = useState<string | null>(null)

  const tags: readonly TagDefinition[] = settings?.tags ?? []
  // 下拉只列普通标签：会话运行中标签（runningTagId）由设置页单独配置。
  const selectableTags: readonly TagDefinition[] = settings === undefined
    ? []
    : tags.filter(tag => tag.id !== settings.runningTagId)
  // 当前选中若不在下拉集合（运行中标签 / 已被删除）→ 归一化为「无标签」。
  const effectiveSelected = selected !== null && selectableTags.some(tag => tag.id === selected)
    ? selected
    : null
  const selectedTag = effectiveSelected === null ? undefined : tags.find(tag => tag.id === effectiveSelected)
  const colorDraftChanged = selectedTag !== undefined && colorDraft !== null && colorDraft !== selectedTag.color

  const usedBy = useMemo(
    () => deleteId !== null && settings !== undefined ? usageOf(settings, deleteId) : { workspaces: 0, sessions: 0 },
    [deleteId, settings],
  )

  const closeManagement = (): void => {
    setAdding(false)
    setEditingId(null)
    setDeleteId(null)
    setAddName('')
    setEditName('')
    setFieldError(null)
  }

  const confirmAdd = async (): Promise<void> => {
    if (settings === undefined) return
    const error = tagNameError(addName, settings.tags)
    if (error !== null) { setFieldError(error); return }
    setBusy(true)
    setFieldError(null)
    try {
      const tag = await controller.addTag(addName, '#4f7cff')
      setSelected(tag.id)
      setAdding(false)
      setAddName('')
    } catch (reason: unknown) {
      setFieldError('save')
    } finally {
      setBusy(false)
    }
  }

  const confirmEdit = async (): Promise<void> => {
    if (settings === undefined || editingId === null) return
    const error = tagNameError(editName, settings.tags, editingId)
    if (error !== null) { setFieldError(error); return }
    setBusy(true)
    setFieldError(null)
    try {
      await controller.updateTag(editingId, { name: editName.trim() })
      setEditingId(null)
    } catch (reason: unknown) {
      setFieldError('save')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (settings === undefined || deleteId === null) return
    setBusy(true)
    setFieldError(null)
    try {
      await controller.deleteTag(deleteId)
      if (effectiveSelected === deleteId) setSelected(null)
      setDeleteId(null)
    } catch (reason: unknown) {
      setFieldError('save')
    } finally {
      setBusy(false)
    }
  }

  const confirmColor = async (): Promise<void> => {
    if (selectedTag === undefined || colorDraft === null) return
    setBusy(true)
    setFieldError(null)
    try {
      await controller.updateTag(selectedTag.id, { color: colorDraft })
      setColorDraft(null)
    } catch (reason: unknown) {
      setFieldError('save')
    } finally {
      setBusy(false)
    }
  }

  const confirmAssign = async (): Promise<void> => {
    if (settings === undefined) return
    setBusy(true)
    setFieldError(null)
    try {
      await onAssign(effectiveSelected)
      onClose()
    } catch (reason: unknown) {
      setFieldError('save')
    } finally {
      setBusy(false)
    }
  }

  const showManagement =
    adding || editingId !== null || deleteId !== null

  const inputError = fieldError === 'empty' ? t('dialog.nameEmpty')
    : fieldError === 'duplicate' ? t('dialog.nameDuplicate')
    : fieldError === 'save' ? t('error.saveFailed', { error: '' })
    : null

  /** 下拉选择：切换普通标签或「无标签」，同时关闭管理模式。 */
  const pickOption = (id: string): void => {
    if (busy) return
    setSelectOpen(false)
    closeManagement()
    setSelected(id === NO_TAG_OPTION ? null : id)
    setColorDraft(null)
  }

  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose() }}
      closeLabel={t('dialog.cancel')}
      title={title}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button variant="primary" disabled={busy || settings === undefined} onClick={confirmAssign}>{t('dialog.confirm')}</Button>
        </>
      )}
    >
      <div className={css.dialogBody}>
        {settings === undefined ? (
          <div className={css.managementHint}>{t('dialog.unavailable')}</div>
        ) : (
          <>
            {/* 第 1 行：标签选择（单个下拉菜单；运行中标签不出现） */}
            <Menu
              open={selectOpen}
              onClose={() => { setSelectOpen(false) }}
              items={[
                { id: NO_TAG_OPTION, label: t('dialog.noTag') },
                ...selectableTags.map(tag => ({
                  id: tag.id,
                  label: tag.name,
                  icon: <span className={css.tagSwatch} style={{ backgroundColor: tag.color }} />,
                })),
              ]}
              selectedId={effectiveSelected ?? NO_TAG_OPTION}
              onSelect={pickOption}
              align="start"
              side="bottom"
              dense
              portal
              anchor={(
                <button
                  type="button"
                  className={css.tagSelect}
                  aria-haspopup="listbox"
                  aria-expanded={selectOpen}
                  disabled={busy}
                  onClick={() => { if (!busy) setSelectOpen(v => !v) }}
                >
                  {selectedTag !== undefined && (
                    <span className={css.tagSwatch} style={{ backgroundColor: selectedTag.color }} />
                  )}
                  <span className={css.tagSelectText}>{selectedTag?.name ?? t('dialog.noTag')}</span>
                  <IconChevronDownOutline14 className={css.tagSelectChevron} />
                </button>
              )}
            />

            {/* 第 2 行：管理模式 */}
            <div className={css.managementRow}>
              {deleteId !== null && settings !== undefined ? (
                <div className={css.confirmRow}>
                  <span className={css.confirmText}>
                    {t('dialog.deleteBody', { name: tags.find(tag => tag.id === deleteId)?.name ?? '' })}
                    {(usedBy.workspaces > 0 || usedBy.sessions > 0) && ' ' + t('dialog.usedBy', {
                      workspaces: String(usedBy.workspaces),
                      sessions: String(usedBy.sessions),
                    })}
                  </span>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleteId(null)}>{t('dialog.deleteCancel')}</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={confirmDelete}>{t('dialog.deleteOk')}</Button>
                </div>
              ) : adding || editingId !== null ? (
                <>
                  <input
                    className={css.addInput}
                    value={adding ? addName : editName}
                    placeholder={adding ? t('dialog.addPlaceholder') : undefined}
                    aria-label={adding ? t('dialog.add') : t('dialog.edit')}
                    autoFocus
                    disabled={busy}
                    onChange={(e) => {
                      setFieldError(null)
                      if (adding) setAddName(e.target.value)
                      else setEditName(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void (adding ? confirmAdd() : confirmEdit())
                      }
                      if (e.key === 'Escape') closeManagement()
                    }}
                  />
                  <Button variant="outline" size="sm" disabled={busy} onClick={closeManagement}>{t('dialog.cancel')}</Button>
                  <Button variant="primary" size="sm" disabled={busy} onClick={adding ? confirmAdd : confirmEdit}>{t('dialog.confirm')}</Button>
                </>
              ) : (
                <>
                  <span className={css.managementHint}>{t('settings.stats', {
                    total: String(tags.length),
                    workspaces: String(Object.keys(settings.workspaceTags).length),
                    sessions: String(Object.keys(settings.sessionTags).length),
                  })}</span>
                  <Tooltip label={t('dialog.add')}>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => { setAdding(true); setFieldError(null) }}>
                      <IconPlusOutline16 /> {t('dialog.add')}
                    </Button>
                  </Tooltip>
                  {/* 编辑/删除只针对下拉框当前选中的普通标签（无标签时禁用）。 */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || effectiveSelected === null}
                    onClick={() => {
                      if (effectiveSelected === null || selectedTag === undefined) return
                      closeManagement()
                      setEditingId(effectiveSelected)
                      setEditName(selectedTag.name)
                    }}
                  >
                    <IconEditOutline16 /> {t('dialog.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || effectiveSelected === null}
                    onClick={() => {
                      if (effectiveSelected === null) return
                      closeManagement()
                      setDeleteId(effectiveSelected)
                    }}
                  >
                    <IconTrashOutline16 /> {t('dialog.delete')}
                  </Button>
                </>
              )}
            </div>
            {inputError !== null && <div className={css.fieldError} role="alert">{inputError}</div>}

            {/* 第 3 行：颜色（选中真实标签时；新增标签不可设置/修改颜色） */}
            {selectedTag !== undefined && !adding && (
              <div className={css.colorSection}>
                <div className={css.colorSectionHeader}>
                  <span className={css.colorTarget}>
                    <span className={css.tagSwatch} style={{ backgroundColor: colorDraft ?? selectedTag.color }} />
                    {selectedTag.name}
                  </span>
                  <Button variant="outline" size="sm" disabled={busy || !colorDraftChanged} onClick={confirmColor}>
                    {t('dialog.confirm')}
                  </Button>
                </div>
                <ColorPicker
                  value={colorDraft ?? selectedTag.color}
                  customPresets={settings.customColors}
                  t={t}
                  onPick={setColorDraft}
                  onSaveCustom={(hex) => { void controller.saveCustomColor(hex) }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
