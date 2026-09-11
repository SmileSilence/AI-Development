import { describe, expect, it, vi } from 'vitest'
import { resolveRunningTag, getRunningTag, deleteTagOps, updateTagOps } from '../src/client/tags/tag-store.ts'
import { createTaggerController } from '../src/client/tags/tagger-controller.ts'
import { RUNNING_EFFECT_PRESETS, RUNNING_EFFECT_SECONDS } from '../src/client/tags/running-effects.ts'
import type { WorkspaceTaggerSettings, RunningTagConfig } from '../src/client/tags/settings-types.ts'

const settings = (patch: Partial<WorkspaceTaggerSettings> = {}): WorkspaceTaggerSettings => ({
  tags: [{ id: 'tag-1', name: '旧运行', color: '#FA1234' }], runningTagId: null,
  workspaceTags: {}, sessionTags: {}, customColors: [], splitRatio: 0.35, ...patch,
})
const independent = (): RunningTagConfig => ({ enabled: true, name: '独立运行', color: '#123456',
  effect: { preset: 'edge', color: '', secondaryColor: '', speed: 'medium' } })

describe('独立运行标签配置', () => {
  it('新安装关闭，预填默认蓝色、边缘流光和中速', () => {
    expect(resolveRunningTag(settings())).toMatchObject({ enabled: false, name: '运行中', color: '#4f7cff', effect: { preset: 'edge', speed: 'medium' } })
    expect(getRunningTag(settings())).toBeUndefined()
  })
  it('缺失或 null 配置读取旧名称颜色，不改写旧数据', () => {
    for (const runningTag of [undefined, null]) {
      const original = settings({ runningTagId: 'tag-1', runningTag })
      expect(resolveRunningTag(original)).toMatchObject({ enabled: true, name: '旧运行', color: '#fa1234' })
      expect(original.runningTag).toBe(runningTag)
    }
    expect(resolveRunningTag(settings({ runningTagId: 'missing' })).enabled).toBe(false)
  })
  it('新配置优先，关闭时不会回退到旧标签', () => {
    const original = settings({ runningTagId: 'tag-1', runningTag: independent() })
    expect(getRunningTag(original)).toMatchObject({ id: '__running__', name: '独立运行', color: '#123456' })
    expect(getRunningTag({ ...original, runningTag: { ...independent(), enabled: false } })).toBeUndefined()
  })
  it('普通标签改名或删除不修改独立运行配置', () => {
    const original = settings({ runningTagId: 'tag-1', runningTag: independent() })
    const before = resolveRunningTag(original)
    const removed = deleteTagOps(original, 'tag-1')
    expect(removed.ops.every(op => op.path[0] !== 'runningTag')).toBe(true)
    expect(updateTagOps(original, 'tag-1', { name: '已更名' }).every(op => op.path[0] !== 'runningTag')).toBe(true)
    expect(resolveRunningTag({ ...original, tags: removed.nextTags, runningTagId: null })).toEqual(before)
  })
  it('异常输入安全回退，独立空名称不引用旧标签', () => {
    const invalid = { enabled: 'yes', name: 5, color: false, effect: { preset: 'unknown', speed: 'toString', color: 1, secondaryColor: 'bad' } } as unknown as RunningTagConfig
    expect(resolveRunningTag(settings({ runningTagId: 'tag-1', runningTag: invalid }))).toMatchObject({ enabled: false, name: '运行中', color: '#4f7cff', effect: { preset: 'edge', speed: 'medium' } })
  })
  it('旧跑马灯配置读取时迁移为边缘流光', () => {
    const legacy = { ...independent(), effect: { ...independent().effect, preset: 'marquee' } } as unknown as RunningTagConfig
    expect(resolveRunningTag(settings({ runningTag: legacy })).effect.preset).toBe('edge')
  })
  it('协调色随底色变化，自定义色归一化并保留', () => {
    const first = resolveRunningTag(settings({ runningTag: independent() }))
    const next = resolveRunningTag(settings({ runningTag: { ...independent(), color: '#ff0000' } }))
    expect(next.effect.color).not.toBe(first.effect.color)
    expect(resolveRunningTag(settings({ runningTag: { ...independent(), effect: { ...independent().effect, color: '#AABBCC' } } })).effect.color).toBe('#aabbcc')
  })
  it('仅提供三种预设且不再公开跑马灯，速度秒数固定', () => {
    expect(RUNNING_EFFECT_PRESETS.map(item => item.id)).toEqual(['none', 'edge', 'gradient'])
    expect(new Set(RUNNING_EFFECT_PRESETS.map(item => item.id)).size).toBe(3)
    expect(RUNNING_EFFECT_SECONDS).toEqual({ slow: 4, medium: 2.5, fast: 1.5 })
  })
})

describe('运行配置控制器', () => {
  it('一次保存完整草稿，空动效色保留自动配色语义', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    const controller = createTaggerController({ mutate, getSnapshot: () => ({ value: settings() }), subscribe: vi.fn() } as never)
    await controller.saveRunningTag(independent())
    expect(mutate).toHaveBeenCalledExactlyOnceWith([{ op: 'set', path: ['runningTag'], value: independent() }])
  })
  it('保存失败向调用方传播，快照不被本地篡改', async () => {
    const snapshot = { value: settings() }
    const controller = createTaggerController({ mutate: vi.fn().mockRejectedValue(new Error('失败')), getSnapshot: () => snapshot, subscribe: vi.fn() } as never)
    await expect(controller.saveRunningTag(independent())).rejects.toThrow('失败')
    expect(controller.getSnapshot()).toBe(snapshot)
    expect(snapshot.value.runningTag).toBeUndefined()
  })
  it('订阅沿用设置域并透传清理，读到最新远端快照', () => {
    const listeners = new Set<() => void>()
    let snapshot = { value: settings() }
    const controller = createTaggerController({ mutate: vi.fn(), getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    } as never)
    const listener = vi.fn()
    const dispose = controller.subscribe(listener)
    snapshot = { value: settings({ runningTag: independent() }) }
    listeners.forEach(fn => fn())
    expect(listener).toHaveBeenCalledOnce()
    expect(controller.getSnapshot().value?.runningTag).toEqual(independent())
    dispose()
    expect(listeners.size).toBe(0)
  })
})
