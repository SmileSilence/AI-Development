/**
 * dsh-workspace-tagger — 行内标签胶囊（纯展示）。
 *
 * 单色胶囊（工作区行）：色块 + 名称，文本色按背景亮度取深/浅。
 * 双色胶囊（会话行）：前段 = 工作区色（宽度占比 splitRatio），后段 = 会话生效色。
 * count 用于折叠工作区行显示「运行标签名×N」（任务 B 扩展1）。
 */
import type { RunningTagEffect } from '../settings-types.ts'
import { textColorOn } from '../tag-store.ts'
import css from './TagDialog.module.css'
import clsx from 'clsx'

/** 一个颜色段。 */
export interface TagSegment {
  color: string
  name: string
  effect?: RunningTagEffect
}

/**
 * 单色胶囊。
 * @param props.tag - 标签颜色与名称。
 * @param props.count - 附加计数（>1 时显示「名称×N」；折叠工作区的运行中会话数）。
 * @param props.className - 附加类名（供行内嵌入布局）。
 */
export function TagPill({ tag, count, className }: { tag: TagSegment; count?: number; className?: string }) {
  return (
    <span
      className={clsx(css.pill, className)}
      style={{ backgroundColor: tag.color, color: textColorOn(tag.color) }}
      title={count !== undefined && count > 0 ? `${tag.name}×${count}` : tag.name}
    >
      <span className={css.pillText}>{tag.name}</span>
      {count !== undefined && count > 0 && <span className={css.pillCount}>×{count}</span>}
    </span>
  )
}

/**
 * 双色胶囊：前段 = 工作区色（splitRatio 占比），后段 = 会话色 + 名称。
 * @param props.front - 前段（工作区）颜色；缺省时退化为单色胶囊。
 * @param props.back - 后段（会话）颜色与名称。
 * @param props.splitRatio - 前段占比（0.1–0.9）。
 * @param props.className - 附加类名。
 */
export function DualTagPill({
  front,
  back,
  splitRatio,
  className,
}: { front?: TagSegment | undefined; back: TagSegment; splitRatio: number; className?: string }) {
  if (front === undefined) {
    return <TagPill tag={back} className={className} />
  }
  return (
    <span className={clsx(css.dualPill, className)} title={back.name}>
      <span
        className={css.dualPillFront}
        style={{ width: Math.round(140 * splitRatio), backgroundColor: front.color }}
      />
      <span className={css.dualPillBack} style={{ backgroundColor: back.color, color: textColorOn(back.color) }}>
        <span className={css.dualPillBackText}>{back.name}</span>
      </span>
    </span>
  )
}
