/**
 * dsh-workspace-tagger — Unity 风格颜色选择器（M3）。
 *
 * 组件：H 色相条（0–360）+ SV 方块（横=s 纵=v）+ Hex/RGB 输入 +
 * 固定预设 + 自定义预设（上限 12，可保存当前色）。拖动过程实时回调 onPick，
 * 确定/取消由父层决定提交。纯受控：value 为 #rrggbb。
 */
import { useState } from 'react'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, textColorOn } from '../tag-store.ts'
import css from './TagDialog.module.css'

/** 固定预设（与 DSH 中性蓝协调的通用色板）。 */
export const FIXED_PRESETS: readonly string[] = [
  '#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#64748b', '#d97706', '#10b981',
]

interface ColorPickerProps {
  /** 当前色 #rrggbb。 */
  value: string
  /** 自定义预设（settings.customColors）。 */
  customPresets: readonly string[]
  t: TranslateNS<'workspace-tagger'>
  /** 拖动/输入实时回调（预览）。 */
  onPick: (hex: string) => void
  /** 保存当前色为自定义预设。 */
  onSaveCustom: (hex: string) => void
}

/** 拖拽坐标 → 归一化 0–1（钳制）。 */
function ratioAt(e: { clientX: number; clientY: number; currentTarget: HTMLElement }, axis: 'x' | 'y'): number {
  const rect = e.currentTarget.getBoundingClientRect()
  const raw = axis === 'x'
    ? (e.clientX - rect.left) / rect.width
    : (e.clientY - rect.top) / rect.height
  return Math.min(1, Math.max(0, raw))
}

export function ColorPicker({ value, customPresets, t, onPick, onSaveCustom }: ColorPickerProps) {
  const { h, s, v } = hexToHsv(value)
  const [dragging, setDragging] = useState<'hue' | 'sv' | null>(null)
  const [draftH, setDraftH] = useState(h)
  const [draftS, setDraftS] = useState(s)
  const [draftV, setDraftV] = useState(v)
  const hue = dragging === 'hue' ? draftH : h
  const sat = dragging === 'sv' ? draftS : s
  const val = dragging === 'sv' ? draftV : v
  const currentHex = hsvToHex(hue, sat, val)
  const svBackground = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hue, 1, 1)})`

  const onHueDrag = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }): void => {
    const next = Math.round(ratioAt(e, 'x') * 360)
    setDraftH(next)
    onPick(hsvToHex(next, sat, val))
  }
  const onSvDrag = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }): void => {
    const nx = ratioAt(e, 'x')
    const ny = ratioAt(e, 'y')
    setDraftS(nx)
    setDraftV(1 - ny)
    onPick(hsvToHex(hue, nx, 1 - ny))
  }
  const stopDrag = (): void => { setDragging(null) }

  const rgb = hexToRgb(currentHex) ?? { r: 0, g: 0, b: 0 }
  const setFromRgb = (channel: 'r' | 'g' | 'b', raw: string): void => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return
    const next = { r: rgb.r, g: rgb.g, b: rgb.b, [channel]: Math.min(255, Math.max(0, n)) }
    onPick('#' + [next.r, next.g, next.b].map(x => x.toString(16).padStart(2, '0')).join(''))
  }

  const allPresets = [...FIXED_PRESETS, ...customPresets]
  const currentNormalized = normalizeHex(currentHex)
  const customSaved = customPresets.includes(currentNormalized ?? '')

  return (
    <div className={css.picker}>
      <div
        className={css.svSquare}
        style={{ background: svBackground }}
        onPointerDown={(e) => {
          e.preventDefault()
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          setDragging('sv')
          onSvDrag(e)
        }}
        onPointerMove={(e) => { if (dragging === 'sv') onSvDrag(e) }}
        onPointerUp={stopDrag}
        role="slider"
        aria-label={t('picker.title')}
        aria-valuetext={currentHex}
      >
        <span className={css.svHandle} style={{ left: sat * 100 + '%', top: (1 - val) * 100 + '%' }} />
      </div>
      <div
        className={css.hueBar}
        onPointerDown={(e) => {
          e.preventDefault()
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          setDragging('hue')
          onHueDrag(e)
        }}
        onPointerMove={(e) => { if (dragging === 'hue') onHueDrag(e) }}
        onPointerUp={stopDrag}
        role="slider"
        aria-label={t('picker.hue')}
        aria-valuenow={hue}
        aria-valuemin={0}
        aria-valuemax={360}
      >
        <span className={css.hueHandle} style={{ left: (hue / 360) * 100 + '%' }} />
      </div>
      <div className={css.valueInputs}>
        <label className={css.valueField}>
          {t('picker.hex')}
          <input
            className={clsx(css.valueInput, css.hexInput)}
            value={currentHex}
            spellCheck={false}
            onChange={(e) => {
              const next = normalizeHex(e.target.value)
              if (next !== null) onPick(next)
            }}
          />
        </label>
        <label className={css.valueField}>
          {t('picker.red')}
          <input className={css.valueInput} value={rgb.r} inputMode="numeric" onChange={(e) => setFromRgb('r', e.target.value)} />
        </label>
        <label className={css.valueField}>
          {t('picker.green')}
          <input className={css.valueInput} value={rgb.g} inputMode="numeric" onChange={(e) => setFromRgb('g', e.target.value)} />
        </label>
        <label className={css.valueField}>
          {t('picker.blue')}
          <input className={css.valueInput} value={rgb.b} inputMode="numeric" onChange={(e) => setFromRgb('b', e.target.value)} />
        </label>
      </div>
      <div className={css.presetGrid}>
        {allPresets.map(hex => (
          <button
            type="button"
            key={hex}
            className={clsx(css.presetSwatch, currentNormalized === hex && css.presetSwatchCurrent)}
            style={{ backgroundColor: hex }}
            aria-label={hex}
            title={hex}
            onClick={() => onPick(hex)}
          />
        ))}
      </div>
      <div className={css.customSection}>
        <span
          className={css.previewSwatch}
          style={{ backgroundColor: currentHex, color: textColorOn(currentHex) }}
        >
          {currentHex}
        </span>
        <button
          type="button"
          className={css.saveCustomButton}
          disabled={customSaved || currentNormalized === null}
          onClick={() => { if (currentNormalized !== null) onSaveCustom(currentNormalized) }}
        >
          {customSaved ? t('picker.saved') : t('picker.saveCustom')}
        </button>
      </div>
    </div>
  )
}
