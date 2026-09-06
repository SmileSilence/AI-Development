/**
 * dsh-workspace-tagger — 设置 → 插件 → 「标签管理」标签页（M5）。
 *
 * 内容（R4）：
 *  1) 统计条：标签总数 · 已用于工作区数 · 已用会话数
 *  2) 标签 CRUD：列表行（色块/名称/使用计数 + 编辑/删除），删除二次确认
 *     + 使用计数文案；「增加」行内输入。
 *  3) 运行会话标签：Menu 下拉（无 + 各标签），说明文案。
 *  4) 双色胶囊比例：滑杆 10%–90% + 实时双色预览胶囊。
 *
 * 持久化：每项动作各自确认后即提交（add/delete/rename/runningTag/splitRatio
 * 均走 controller → settingsScope.mutate，revision fence 由 settings 域负责）。
 */
import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  Button, IconEditOutline16, IconPlusOutline16, IconTrashOutline16, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceTaggerSettings } from '../settings-types.ts'
import {
  clampSplitRatio, tagNameError, tagById,
} from '../tag-store.ts'
import type { TaggerController } from '../tagger-controller.ts'
import { DualTagPill, type TagSegment } from '../ui/TagPill.tsx'
import { ColorPicker } from '../ui/ColorPicker.tsx'
import css from './TagsSettingsTab.module.css'

/** 设置页注入面：标签控制器（hooks 绑定为 useTagger）。 */
export interface TagsSettingsTabInjected {
  hooks: { tagger: HostObservable<SettingsScopeSnapshot<WorkspaceTaggerSettings>> }
  tagger: TaggerController
}

/** 无标签时双色预览的占位色。 */
const PREVIEW_FALLBACK: readonly [string, string] = ['#4f7cff', '#ef4444']

export function TagsSettingsTab({ t, useTagger, tagger }: {
  t: TranslateNS<'workspace-tagger'>
  useTagger: (selector: (snapshot: SettingsScopeSnapshot<WorkspaceTaggerSettings>) => unknown) => unknown
  tagger: TaggerController
}) {
  const settings = useTagger(snapshot => snapshot.value) as WorkspaceTaggerSettings | undefined
  const [runningOpen, setRunningOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [colorEditingId, setColorEditingId] = useState<string | null>(null)
  const [colorDraft, setColorDraft] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (settings === undefined) {
    return <div className={css.unavailable}>{t('settings.unavailable')}</div>
  }

  const tags = settings.tags

  const workspaceUsage = (tagId: string): number =>
    Object.values(settings.workspaceTags).filter(id => id === tagId).length
  const sessionUsage = (tagId: string): number =>
    Object.values(settings.sessionTags).filter(id => id === tagId).length

  const confirmAdd = async (): Promise<void> => {
    const nameError = tagNameError(addName, tags)
    if (nameError !== null) { setError(nameError); return }
    setBusy(true)
    setError(null)
    try {
      await tagger.addTag(addName, PREVIEW_FALLBACK[0])
      setAdding(false)
      setAddName('')
    } catch { setError('save') } finally { setBusy(false) }
  }

  const confirmEdit = async (): Promise<void> => {
    if (editingId === null) return
    const nameError = tagNameError(editName, tags, editingId)
    if (nameError !== null) { setError(nameError); return }
    setBusy(true)
    setError(null)
    try {
      await tagger.updateTag(editingId, { name: editName.trim() })
      setEditingId(null)
    } catch { setError('save') } finally { setBusy(false) }
  }

  const confirmDelete = async (): Promise<void> => {
    if (deleteId === null) return
    setBusy(true)
    setError(null)
    try {
      await tagger.deleteTag(deleteId)
      setDeleteId(null)
    } catch { setError('save') } finally { setBusy(false) }
  }

  const confirmColor = async (): Promise<void> => {
    if (colorEditingId === null || colorDraft === null) return
    setBusy(true)
    setError(null)
    try {
      await tagger.updateTag(colorEditingId, { color: colorDraft })
      setColorEditingId(null)
      setColorDraft(null)
    } catch { setError('save') } finally { setBusy(false) }
  }

  const commitSplitRatio = async (value: number): Promise<void> => {
    setBusy(true)
    setError(null)
    try { await tagger.setSplitRatio(clampSplitRatio(value)) } catch { setError('save') } finally { setBusy(false) }
  }

  const runningMenuItems = [
    { id: 'none', label: t('settings.none') },
    ...tags.map(tag => ({ id: tag.id, label: tag.name })),
  ]

  // 双色预览：前=首个标签（工作区色），后=运行标签或次个标签（会话色）。
  const frontTag = tags[0]
  const previewFront: TagSegment | undefined = frontTag === undefined
    ? undefined
    : { color: frontTag.color, name: frontTag.name }
  const previewBack: TagSegment = (() => {
    const running = settings.runningTagId === null ? undefined : tagById(settings, settings.runningTagId)
    const second = tags.find(tag => tag.id !== frontTag?.id && tag.id !== settings.runningTagId)
    const target = running ?? second ?? tags[0]
    if (target !== undefined) return { color: target.color, name: target.name }
    return { color: PREVIEW_FALLBACK[1], name: t('settings.previewSession') }
  })()

  const inputError = error === 'empty' ? t('dialog.nameEmpty')
    : error === 'duplicate' ? t('dialog.nameDuplicate')
    : error === 'save' ? t('error.saveFailed')
    : null

  return (
    <div className={css.page}>
      <p className={css.stats}>{t('settings.stats', {
        total: String(tags.length),
        workspaces: String(Object.keys(settings.workspaceTags).length),
        sessions: String(Object.keys(settings.sessionTags).length),
      })}</p>

      <div className={css.section}>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>{t('settings.runningTag')}</span>
          <Menu
            open={runningOpen}
            onClose={() => { setRunningOpen(false) }}
            items={runningMenuItems}
            selectedId={settings.runningTagId ?? undefined}
            onSelect={(id) => {
              setRunningOpen(false)
              if (busy) return
              setBusy(true)
              setError(null)
              const next = id === 'none' ? null : id
              tagger.setRunningTag(next).catch(() => setError('save')).finally(() => setBusy(false))
            }}
            align="start"
            side="bottom"
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className={css.selectButton}
                aria-haspopup="listbox"
                onClick={() => { setRunningOpen(true) }}
              >
                {(() => {
                  const running = settings.runningTagId === null ? undefined : tagById(settings, settings.runningTagId)
                  return running === undefined ? t('settings.none') : (
                    <>
                      <span className={css.selectDot} style={{ backgroundColor: running.color }} />
                      {running.name}
                    </>
                  )
                })()}
              </button>
            )}
          />
        </div>
        <p className={css.sectionHint}>{t('settings.runningTagHint')}</p>
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>{t('settings.splitRatio')}</span>
          <input
            type="range"
            className={css.slider}
            min={10}
            max={90}
            step={5}
            value={Math.round(settings.splitRatio * 100)}
            onChange={(e) => { void commitSplitRatio(Number(e.target.value) / 100) }}
            aria-label={t('settings.splitRatio')}
          />
          <span className={css.ratioValue}>{Math.round(settings.splitRatio * 100)}%</span>
        </div>
        <div className={css.previewRow}>
          <span className={css.settingLabel}>{t('settings.splitRatioHint', { ratio: String(Math.round(settings.splitRatio * 100)) })}</span>
          <DualTagPill front={previewFront} back={previewBack} splitRatio={settings.splitRatio} />
        </div>
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <span className={css.sectionTitle}>{t('settings.tagList')}</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => {
            setAdding(true)
            setEditingId(null)
            setDeleteId(null)
            setColorEditingId(null)
            setColorDraft(null)
            setError(null)
          }}>
            <IconPlusOutline16 /> {t('dialog.add')}
          </Button>
        </div>

        {adding && (
          <div className={css.inlineRow}>
            <input
              className={css.inlineInput}
              value={addName}
              placeholder={t('dialog.addPlaceholder')}
              aria-label={t('dialog.add')}
              autoFocus
              disabled={busy}
              onChange={(e) => { setAddName(e.target.value); setError(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void confirmAdd() }
                if (e.key === 'Escape') { setAdding(false); setAddName('') }
              }}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { setAdding(false); setAddName('') }}>{t('dialog.cancel')}</Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => { void confirmAdd() }}>{t('dialog.confirm')}</Button>
          </div>
        )}

        {inputError !== null && <div className={css.fieldError} role="alert">{inputError}</div>}

        {tags.length === 0 ? (
          <div className={css.empty}>{t('settings.emptyTags')}</div>
        ) : (
          <div className={css.tagList}>
            {tags.map(tag => (
              <div key={tag.id}>
                {editingId === tag.id ? (
                  <div className={css.inlineRow}>
                    <span className={css.tagSwatch} style={{ backgroundColor: tag.color }} />
                    <input
                      className={css.inlineInput}
                      value={editName}
                      aria-label={t('dialog.edit')}
                      autoFocus
                      disabled={busy}
                      onChange={(e) => { setEditName(e.target.value); setError(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void confirmEdit() }
                        if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                      }}
                    />
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => { setEditingId(null); setEditName('') }}>{t('dialog.cancel')}</Button>
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => { void confirmEdit() }}>{t('dialog.confirm')}</Button>
                  </div>
                ) : deleteId === tag.id ? (
                  <div className={css.confirmRow}>
                    <span className={css.confirmText}>
                      {t('dialog.deleteBody', { name: tag.name })}
                      {(workspaceUsage(tag.id) > 0 || sessionUsage(tag.id) > 0) && ' ' + t('dialog.usedBy', {
                        workspaces: String(workspaceUsage(tag.id)),
                        sessions: String(sessionUsage(tag.id)),
                      })}
                    </span>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleteId(null)}>{t('dialog.deleteCancel')}</Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => { void confirmDelete() }}>{t('dialog.deleteOk')}</Button>
                  </div>
                ) : (
                  <>
                    <div className={css.tagRow}>
                      <span className={css.tagSwatch} style={{ backgroundColor: tag.color }} />
                      <span className={css.tagName}>{tag.name}</span>
                      <span className={css.tagUsage}>
                        {t('settings.tagUsage', {
                          workspaces: String(workspaceUsage(tag.id)),
                          sessions: String(sessionUsage(tag.id)),
                        })}
                      </span>
                      <span className={css.rowActions}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          aria-expanded={colorEditingId === tag.id}
                          onClick={() => {
                            setAdding(false)
                            setEditingId(null)
                            setDeleteId(null)
                            setColorEditingId(colorEditingId === tag.id ? null : tag.id)
                            setColorDraft(colorEditingId === tag.id ? null : tag.color)
                            setError(null)
                          }}
                        >
                          <span className={css.colorActionSwatch} style={{ backgroundColor: tag.color }} />
                          {t('dialog.color')}
                        </Button>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={t('dialog.edit')}
                          onClick={() => {
                            setEditingId(tag.id)
                            setEditName(tag.name)
                            setColorEditingId(null)
                            setColorDraft(null)
                            setError(null)
                          }}
                        >
                          <IconEditOutline16 />
                        </button>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={t('dialog.delete')}
                          onClick={() => {
                            setDeleteId(tag.id)
                            setColorEditingId(null)
                            setColorDraft(null)
                            setError(null)
                          }}
                        >
                          <IconTrashOutline16 />
                        </button>
                      </span>
                    </div>
                    {colorEditingId === tag.id && (
                      <div className={css.colorEditor}>
                        <div className={css.colorEditorHeader}>
                          <span className={css.colorEditorTitle}>
                            <span className={css.tagSwatch} style={{ backgroundColor: colorDraft ?? tag.color }} />
                            {tag.name} · {t('picker.title')}
                          </span>
                          <span className={css.colorEditorActions}>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => { setColorEditingId(null); setColorDraft(null) }}
                            >
                              {t('dialog.cancel')}
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy || colorDraft === null || colorDraft === tag.color}
                              onClick={() => { void confirmColor() }}
                            >
                              {t('dialog.confirm')}
                            </Button>
                          </span>
                        </div>
                        <ColorPicker
                          value={colorDraft ?? tag.color}
                          customPresets={settings.customColors}
                          t={t}
                          onPick={setColorDraft}
                          onSaveCustom={(hex) => { void tagger.saveCustomColor(hex) }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
