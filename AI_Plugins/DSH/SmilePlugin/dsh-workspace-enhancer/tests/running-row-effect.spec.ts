import { describe, expect, it } from 'vitest'
import { DualTagPill, TagPill, type TagSegment } from '../src/client/tags/ui/TagPill.tsx'
import { RUNNING_EFFECT_PRESETS } from '../src/client/tags/running-effects.ts'
import { RunningRowEffect, runningRowStyle } from '../src/client/browser/RunningRowEffect.tsx'

const tag: TagSegment = { color: '#4f7cff', name: '运行中',
  effect: { preset: 'edge', speed: 'medium', color: '#aabbff', secondaryColor: '#ccddee' } }

describe('运行标签胶囊', () => {
  it.each(RUNNING_EFFECT_PRESETS)('$label 在胶囊内只显示静态文字和底色', preset => {
    const node = TagPill({ tag: { ...tag, effect: { ...tag.effect!, preset: preset.id } }, count: 1 })
    expect(node.props.title).toBe('运行中×1')
    expect(node.props.style).toEqual({ backgroundColor: '#4f7cff', color: '#ffffff' })
    expect(node.props.children[0].props.children).toBe('运行中')
    expect(JSON.stringify(node)).not.toContain('runningRowEffect')
    expect(JSON.stringify(node)).not.toContain(preset.className || 'dshRunningNone')
  })

  it('双色前段和运行后段都保持静态', () => {
    const node = DualTagPill({ front: { color: '#00ff00', name: '工作区' }, back: tag, splitRatio: 0.35 })
    const [front, back] = node.props.children
    expect(front.props.style).toEqual({ width: 49, backgroundColor: '#00ff00' })
    expect(back.props.style.backgroundColor).toBe('#4f7cff')
    expect(back.props.children.props.children).toBe('运行中')
    expect(back.props.style['--dsh-running-duration']).toBeUndefined()
  })
})

describe('共享整行动效层', () => {
  it.each(RUNNING_EFFECT_PRESETS)('$label 由行级注册表类驱动', preset => {
    const node = RunningRowEffect({ tag: { ...tag, effect: { ...tag.effect!, preset: preset.id } } })!
    const effects = node.props.children.filter(Boolean)
    if (preset.id === 'none') expect(effects).toHaveLength(1)
    else expect(effects[1].props.className).toContain(preset.className)
  })

  it('边缘流光使用标准化圆角周长路径', () => {
    const node = RunningRowEffect({ tag })!
    const effect = node.props.children.filter(Boolean)[1]
    expect(effect.type).toBe('svg')
    expect(effect.props.width).toBe('100%')
    expect(effect.props.height).toBe('100%')
    expect(effect.props.children.type).toBe('rect')
    expect(effect.props.children.props.pathLength).toBe('100')
  })

  it('渐变流动使用独立背景层', () => {
    const node = RunningRowEffect({ tag: { ...tag, effect: { ...tag.effect!, preset: 'gradient' } } })!
    const effect = node.props.children.filter(Boolean)[1]
    expect(effect.type).toBe('span')
    expect(effect.props.className).toContain('dshRunningGradient')
  })

  it('使用 8% 底色、共享颜色和速度变量', () => {
    expect(runningRowStyle(tag)).toEqual({
      '--dsh-running-base': 'rgba(79, 124, 255, 0.08)',
      '--dsh-running-color': '#aabbff',
      '--dsh-running-secondary': '#ccddee',
      '--dsh-running-duration': '2.5s',
    })
  })

  it('无运行展示对象时不建立装饰层', () => {
    expect(RunningRowEffect({ tag: undefined })).toBeNull()
  })
})
