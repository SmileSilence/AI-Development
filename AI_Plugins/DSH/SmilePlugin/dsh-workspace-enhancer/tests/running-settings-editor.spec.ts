import { describe, expect, it } from 'vitest'
import {
  createRunningEditorState, runningDraft, runningEditorReducer,
} from '../src/client/tags/settings/RunningTagSettings.tsx'
import type { RunningTagConfig, WorkspaceTaggerSettings } from '../src/client/tags/settings-types.ts'

const saved: RunningTagConfig = {
  enabled: true, name: '运行中', color: '#4f7cff',
  effect: { preset: 'edge', speed: 'medium', color: '', secondaryColor: '' },
}
const changed: RunningTagConfig = {
  enabled: true, name: '执行中', color: '#ef4444',
  effect: { preset: 'gradient', speed: 'fast', color: '#ffffff', secondaryColor: '#fca5a5' },
}

describe('运行标签紧凑编辑状态', () => {
  it('初次打开和设置页重新挂载都处于预览态', () => {
    expect(createRunningEditorState(saved)).toMatchObject({ editing: false, display: saved, draft: saved })
  })

  it('编辑草稿不会提前改变已保存预览', () => {
    const opened = runningEditorReducer(createRunningEditorState(saved), { type: 'open' })
    const edited = runningEditorReducer(opened, { type: 'patch', config: changed })
    expect(edited).toMatchObject({ editing: true, display: saved, draft: changed })
  })

  it('取消丢弃草稿并折叠', () => {
    const edited = { ...createRunningEditorState(saved), editing: true, draft: changed }
    expect(runningEditorReducer(edited, { type: 'cancel' })).toMatchObject({ editing: false, display: saved, draft: saved })
  })

  it('保存成功更新预览并折叠，保存失败保留草稿和展开状态', () => {
    const edited = { ...createRunningEditorState(saved), editing: true, draft: changed }
    expect(runningEditorReducer(edited, { type: 'saved', config: changed })).toMatchObject({ editing: false, display: changed, draft: changed })
    expect(runningEditorReducer(edited, { type: 'failed', message: '保存失败' }))
      .toMatchObject({ editing: true, display: saved, draft: changed, message: '保存失败' })
  })

  it('编辑中忽略外部设置刷新，折叠态则同步', () => {
    const edited = { ...createRunningEditorState(saved), editing: true, draft: changed }
    expect(runningEditorReducer(edited, { type: 'sync', config: changed })).toBe(edited)
    expect(runningEditorReducer(createRunningEditorState(saved), { type: 'sync', config: changed }).display).toEqual(changed)
  })

  it('草稿保留空动效色，兼容自动协调配色语义', () => {
    const settings = { tags: [], workspaceTags: {}, sessionTags: {}, runningTagId: null,
      splitRatio: 0.35, customColors: [], runningTag: saved } as WorkspaceTaggerSettings
    expect(runningDraft(settings).effect).toEqual(saved.effect)
  })
})
