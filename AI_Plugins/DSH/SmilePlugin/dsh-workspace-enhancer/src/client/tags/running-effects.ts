import type { RunningEffectPreset, RunningEffectSpeed } from './settings-types.ts'

/** 新效果只需在注册表增加配置并实现对应样式；行组件不感知预设。 */
export const RUNNING_EFFECT_PRESETS: readonly {
  id: RunningEffectPreset; label: string; labelKey: 'settings.running.effectNone' | 'settings.running.effectEdge' | 'settings.running.effectGradient'; className: string; colors: number; layer: 'none' | 'perimeter' | 'background'
}[] = [
  { id: 'none', label: '无动效', labelKey: 'settings.running.effectNone', className: '', colors: 0, layer: 'none' },
  { id: 'edge', label: '边缘流光', labelKey: 'settings.running.effectEdge', className: 'dshRunningEdge', colors: 1, layer: 'perimeter' },
  { id: 'gradient', label: '渐变流动', labelKey: 'settings.running.effectGradient', className: 'dshRunningGradient', colors: 2, layer: 'background' },
]
export const RUNNING_EFFECT_SECONDS: Record<RunningEffectSpeed, number> = { slow: 4, medium: 2.5, fast: 1.5 }
