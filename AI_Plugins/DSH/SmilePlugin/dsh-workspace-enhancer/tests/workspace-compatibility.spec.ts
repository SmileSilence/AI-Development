import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'

describe('工作区插件兼容性', () => {
  it('后备工作区与默认优先级提供者同时注册时由其它插件接管', () => {
    const slots = new SlotCore()
    slots.register({
      name: 'root',
      children: { 'sidebar.workspaces': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const enhancer = () => 'enhancer'
    const other = () => 'other'
    slots.register({ name: 'sidebar.workspaces', priority: 10_000 } as never, enhancer)
    slots.register({
      name: 'sidebar.workspaces',
      priority: 0,
      children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
    } as never, other)
    expect(slots.entries('sidebar.workspaces')).toHaveLength(2)
    expect(slots.entriesOfSlot('sidebar.workspaces')[0]?.component).toBe(other)
    expect(slots.spec('sidebar.workspaces.directoryFlow')).toMatchObject({ kind: 'single', scope: 'root' })
  })

  it('安装补丁不再强制停用其它工作区插件', () => {
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).not.toContain('- id: ui-workspace-archive-manager')
    expect(patch).toContain('- id: ui-workspace')
  })

  it('批量列表隐藏程序化焦点产生的浏览器轮廓', () => {
    const css = readFileSync(new URL('../src/client/browser/WorkspaceBrowser.module.css', import.meta.url), 'utf8')
    expect(css).toContain('.listArea:focus-visible')
    expect(css).toMatch(/\.listArea:focus-visible\s*\{\s*outline:\s*none;/)
  })
})
