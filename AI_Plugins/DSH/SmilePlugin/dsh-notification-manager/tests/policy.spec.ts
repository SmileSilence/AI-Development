import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_MANAGER_SETTINGS } from '../src/shared/settings-types.ts'
import { safeNotificationContent, shouldNotify } from '../src/client/policy.ts'
import type { NotificationEvent } from '../src/client/events.ts'

const completion: NotificationEvent = { kind: 'completion', sessionId: 's', sessionTitle: '标题' }

describe('通知策略', () => {
  it('覆盖三种任务完成模式', () => {
    expect(shouldNotify(completion, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, turnMode: 'off' }, false)).toBe(false)
    expect(shouldNotify(completion, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, turnMode: 'unfocused' }, true)).toBe(false)
    expect(shouldNotify(completion, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, turnMode: 'unfocused' }, false)).toBe(true)
    expect(shouldNotify(completion, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, turnMode: 'always' }, true)).toBe(true)
  })

  it('分别控制权限和问题通知', () => {
    expect(shouldNotify({ ...completion, kind: 'approval' }, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, permissionsEnabled: false }, false)).toBe(false)
    expect(shouldNotify({ ...completion, kind: 'question' }, { ...DEFAULT_NOTIFICATION_MANAGER_SETTINGS, questionsEnabled: false }, false)).toBe(false)
    expect(shouldNotify({ ...completion, kind: 'plan-review' }, DEFAULT_NOTIFICATION_MANAGER_SETTINGS, true)).toBe(true)
  })

  it('通知内容不包含交互正文或工具参数', () => {
    const event = { ...completion, kind: 'approval' as const, interactionKey: 'secret-tool-args' }
    const content = safeNotificationContent(event)
    expect(content).toEqual({ title: '需要权限确认', body: '标题' })
    expect(JSON.stringify(content)).not.toContain('secret-tool-args')
  })
})
