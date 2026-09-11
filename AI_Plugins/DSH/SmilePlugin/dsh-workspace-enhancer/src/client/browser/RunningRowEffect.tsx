import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { RUNNING_EFFECT_PRESETS, RUNNING_EFFECT_SECONDS } from '../tags/running-effects.ts'
import { hexToRgba } from '../tags/tag-store.ts'
import type { TagSegment } from '../tags/ui/TagPill.tsx'
import css from './Rows.module.css'

export const RUNNING_ROW_CLASS = css.runningRowSurface

/** 正式侧栏行和设置模拟行共用的颜色变量。 */
export function runningRowStyle(tag: TagSegment): CSSProperties {
  return {
    '--dsh-running-base': hexToRgba(tag.color, 0.08),
    '--dsh-running-color': tag.effect?.color ?? tag.color,
    '--dsh-running-secondary': tag.effect?.secondaryColor ?? tag.color,
    '--dsh-running-duration': `${RUNNING_EFFECT_SECONDS[tag.effect?.speed ?? 'medium']}s`,
  } as CSSProperties
}

/** 仅负责装饰层；行内文字、按钮和点击区域始终由父行承载。 */
export function RunningRowEffect({ tag }: { tag: TagSegment | undefined }) {
  if (tag === undefined) return null
  const preset = RUNNING_EFFECT_PRESETS.find(item => item.id === tag.effect?.preset)
  return (
    <span aria-hidden="true" className={css.runningRowLayers}>
      <span className={css.runningRowBase} />
      {preset?.layer === 'perimeter' && (
        <svg
          className={clsx(css.runningRowEffect, css[preset.className])}
          focusable="false"
          width="100%"
          height="100%"
        >
          <rect className={css.runningEdgePath} pathLength="100" />
        </svg>
      )}
      {preset?.layer === 'background' && (
        <span className={clsx(css.runningRowEffect, css[preset.className])} />
      )}
    </span>
  )
}
