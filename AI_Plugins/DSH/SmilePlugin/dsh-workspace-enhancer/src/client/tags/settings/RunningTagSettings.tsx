import { useEffect, useReducer, useState } from 'react'
import { Button, IconEditOutline16, Menu, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type { RunningTagConfig, WorkspaceTaggerSettings } from '../settings-types.ts'
import type { TaggerController } from '../tagger-controller.ts'
import { resolveRunningTag } from '../tag-store.ts'
import { RUNNING_EFFECT_PRESETS } from '../running-effects.ts'
import { TagPill } from '../ui/TagPill.tsx'
import { ColorPicker } from '../ui/ColorPicker.tsx'
import { RunningRowEffect, RUNNING_ROW_CLASS, runningRowStyle } from '../../browser/RunningRowEffect.tsx'
import css from './TagsSettingsTab.module.css'

function Choice({ label, value, items, disabled, onPick }: {
  label: string; value: string; items: { id: string; label: string }[]
  disabled: boolean; onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return <Menu open={open} onClose={() => setOpen(false)} items={items} selectedId={value}
    onSelect={id => { setOpen(false); onPick(id) }} portal align="start"
    anchor={<button type="button" className={css.selectButton} disabled={disabled}
      aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
      {items.find(item => item.id === value)?.label ?? value}
    </button>} />
}

/** 将旧配置与自动协调色语义转换为可编辑草稿。 */
export function runningDraft(settings: WorkspaceTaggerSettings): RunningTagConfig {
  const resolved = resolveRunningTag(settings)
  return { ...resolved, effect: { ...resolved.effect,
    color: settings.runningTag?.effect?.color ?? '',
    secondaryColor: settings.runningTag?.effect?.secondaryColor ?? '',
  } }
}

export interface RunningEditorState {
  display: RunningTagConfig
  draft: RunningTagConfig
  editing: boolean
  message: string
}

type RunningEditorAction =
  | { type: 'sync'; config: RunningTagConfig }
  | { type: 'open' }
  | { type: 'patch'; config: RunningTagConfig }
  | { type: 'cancel' }
  | { type: 'saved'; config: RunningTagConfig }
  | { type: 'failed'; message: string }

function cloneConfig(config: RunningTagConfig): RunningTagConfig {
  return { ...config, effect: { ...config.effect } }
}

export function createRunningEditorState(config: RunningTagConfig): RunningEditorState {
  return { display: cloneConfig(config), draft: cloneConfig(config), editing: false, message: '' }
}

/** 编辑状态机使取消、保存失败和外部同步的边界可独立验证。 */
export function runningEditorReducer(state: RunningEditorState, action: RunningEditorAction): RunningEditorState {
  if (action.type === 'sync') return state.editing ? state : createRunningEditorState(action.config)
  if (action.type === 'open') return { ...state, draft: cloneConfig(state.display), editing: true, message: '' }
  if (action.type === 'patch') return { ...state, draft: action.config, message: '' }
  if (action.type === 'cancel') return { ...state, draft: cloneConfig(state.display), editing: false, message: '' }
  if (action.type === 'saved') return createRunningEditorState(action.config)
  return { ...state, editing: true, message: action.message }
}

function PreviewRow({ tag, enabled, t }: {
  tag: ReturnType<typeof resolveRunningTag>; enabled: boolean; t: TranslateNS<'workspace-tagger'>
}) {
  return <div className={`${css.runningPreviewRow} ${enabled ? RUNNING_ROW_CLASS : ''}`}
    style={enabled ? runningRowStyle(tag) : undefined} data-running-preview="true">
    {enabled && <RunningRowEffect tag={tag} />}
    <StateDot state="ongoing" />
    <span className={css.runningPreviewTitle}>{t('settings.running.previewSession')}</span>
    <TagPill tag={tag} />
  </div>
}

/** 默认显示紧凑预览；编辑草稿只作用于模拟行，成功保存后自动折叠。 */
export function RunningTagSettings({ settings, tagger, t }: {
  settings: WorkspaceTaggerSettings; tagger: TaggerController; t: TranslateNS<'workspace-tagger'>
}) {
  const source = JSON.stringify(runningDraft(settings))
  const initial = JSON.parse(source) as RunningTagConfig
  const [editor, dispatch] = useReducer(runningEditorReducer, initial, createRunningEditorState)
  const [busy, setBusy] = useState(false)
  const [colorField, setColorField] = useState<'color' | 'primary' | 'secondary' | null>(null)
  useEffect(() => {
    const next = JSON.parse(source) as RunningTagConfig
    dispatch({ type: 'sync', config: next })
  }, [source])

  const { draft, display, editing, message } = editor
  const previewConfig = editing ? draft : display
  const preview = resolveRunningTag({ ...settings, runningTag: previewConfig })
  const preset = RUNNING_EFFECT_PRESETS.find(item => item.id === draft.effect.preset)!
  const shownPreset = RUNNING_EFFECT_PRESETS.find(item => item.id === previewConfig.effect.preset)!
  const speedItems = [
    { id: 'slow', label: t('settings.running.speedSlow') },
    { id: 'medium', label: t('settings.running.speedMedium') },
    { id: 'fast', label: t('settings.running.speedFast') },
  ]
  const patch = (next: Partial<RunningTagConfig>): void => dispatch({ type: 'patch', config: { ...draft, ...next } })
  const colorValue = colorField === 'color' ? preview.color
    : colorField === 'secondary' ? preview.effect.secondaryColor : preview.effect.color
  const colorButton = (field: 'color' | 'primary' | 'secondary', label: string, color: string) => (
    <div className={css.settingRow}>
      <span className={css.settingLabel}>{label}</span>
      <button type="button" className={css.selectButton} disabled={busy} aria-label={label}
        aria-expanded={colorField === field} onClick={() => setColorField(colorField === field ? null : field)}>
        <span className={css.selectDot} style={{ backgroundColor: color }} />{color}
      </button>
    </div>
  )
  const cancel = (): void => {
    setColorField(null); dispatch({ type: 'cancel' })
  }

  return <div className={css.section} data-running-settings="true" data-editing={editing ? 'true' : 'false'}>
    <div className={css.runningHeader}>
      <span className={css.sectionTitle}>{t('settings.running.title')}</span>
      <span className={css.runningStatus}>{display.enabled ? t('settings.running.enabledStatus') : t('settings.running.disabledStatus')}</span>
      {!editing && <button type="button" className={css.iconButton} aria-label={t('settings.running.edit')}
        onClick={() => dispatch({ type: 'open' })}>
        <IconEditOutline16 />
      </button>}
    </div>
    <PreviewRow tag={preview} enabled={previewConfig.enabled} t={t} />
    <div className={css.runningSummary}>
      <span>{previewConfig.name}</span><span>·</span><span>{t(shownPreset.labelKey)}</span><span>·</span>
      <span>{speedItems.find(item => item.id === previewConfig.effect.speed)?.label}</span>
    </div>

    {editing && <div className={css.runningEditor}>
      <div className={css.settingRow}>
        <span className={css.settingLabel}>{t('settings.running.enabled')}</span>
        <label className={css.runningToggle}><input type="checkbox" checked={draft.enabled} disabled={busy}
          onChange={event => patch({ enabled: event.target.checked })} />
          {draft.enabled ? t('settings.running.enabledStatus') : t('settings.running.disabledStatus')}
        </label>
      </div>
      <label className={css.settingRow}>
        <span className={css.settingLabel}>{t('settings.running.name')}</span>
        <input className={css.inlineInput} aria-label={t('settings.running.nameAria')} maxLength={80} value={draft.name} disabled={busy}
          onChange={event => patch({ name: event.target.value })} />
      </label>
      {colorButton('color', t('settings.running.baseColor'), preview.color)}
      <div className={css.settingRow}><span className={css.settingLabel}>{t('settings.running.effect')}</span>
        <Choice label={t('settings.running.effect')} value={draft.effect.preset}
          items={RUNNING_EFFECT_PRESETS.map(item => ({ id: item.id, label: t(item.labelKey) }))}
          disabled={busy} onPick={id => { patch({ effect: { ...draft.effect, preset: id as RunningTagConfig['effect']['preset'] } }); setColorField(null) }} />
      </div>
      {preset.colors > 0 && <>
        {colorButton('primary', t('settings.running.primaryColor'), preview.effect.color)}
        {preset.colors > 1 && colorButton('secondary', t('settings.running.secondaryColor'), preview.effect.secondaryColor)}
        <div className={css.settingRow}><span className={css.settingLabel}>{t('settings.running.speed')}</span>
          <Choice label={t('settings.running.speed')} value={draft.effect.speed} disabled={busy} items={speedItems}
            onPick={id => patch({ effect: { ...draft.effect, speed: id as RunningTagConfig['effect']['speed'] } })} />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ effect: { ...draft.effect, color: '', secondaryColor: '' } })}>{t('settings.running.coordinatedColor')}</Button>
        </div>
      </>}
      {colorField !== null && <div className={css.colorEditor}>
        <ColorPicker value={colorValue} customPresets={settings.customColors} t={t}
          onPick={color => { if (busy) return; colorField === 'color' ? patch({ color })
            : patch({ effect: { ...draft.effect, [colorField === 'secondary' ? 'secondaryColor' : 'color']: color } }) }}
          onSaveCustom={hex => { void tagger.saveCustomColor(hex).catch(() => dispatch({ type: 'failed', message: t('settings.running.colorSaveFailed') })) }} />
        <Button size="sm" variant="outline" onClick={() => setColorField(null)}>{t('settings.running.finishColor')}</Button>
      </div>}
      <div className={css.settingRow}>
        <Button size="sm" variant="primary" disabled={busy || draft.name.trim() === ''} onClick={() => {
          const next = { ...draft, name: draft.name.trim() }
          setBusy(true); dispatch({ type: 'patch', config: next })
          void tagger.saveRunningTag(next).then(() => {
            setColorField(null); dispatch({ type: 'saved', config: next })
          }).catch(() => dispatch({ type: 'failed', message: t('settings.running.saveFailed') })).finally(() => setBusy(false))
        }}>{busy ? t('settings.running.saving') : t('settings.running.save')}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={cancel}>{t('settings.running.cancel')}</Button>
        {message !== '' && <span className={css.fieldError} role="alert">{message}</span>}
      </div>
    </div>}
    <p className={css.sectionHint}>{t('settings.runningTagHint')}</p>
  </div>
}
