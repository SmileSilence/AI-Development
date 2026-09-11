import { describe, expect, it, vi } from 'vitest'
import { sendSystemNotification, type NotificationEnvironment, type NotificationLike } from '../src/client/notifier.ts'

function environment(permission: NotificationPermission | 'unsupported') {
  const notification: NotificationLike = { onclick: null, close: vi.fn() }
  const value: NotificationEnvironment = {
    permission: () => permission,
    requestPermission: async () => permission,
    create: vi.fn(() => notification),
    focus: vi.fn(),
  }
  return { value, notification }
}

describe('系统通知发送', () => {
  it.each(['default', 'denied', 'unsupported'] as const)('%s 时安全降级', permission => {
    const { value } = environment(permission)
    expect(sendSystemNotification(value, { kind: 'completion', sessionId: 's', sessionTitle: '标题' }, vi.fn())).toBe(false)
    expect(value.create).not.toHaveBeenCalled()
  })

  it('granted 时发送，点击聚焦并打开会话', () => {
    const { value, notification } = environment('granted')
    const open = vi.fn()
    expect(sendSystemNotification(value, { kind: 'question', sessionId: 's', sessionTitle: '标题', interactionKey: 'k' }, open)).toBe(true)
    expect(value.create).toHaveBeenCalledWith('需要回答问题', expect.objectContaining({ body: '标题' }))
    notification.onclick?.(new Event('click'))
    expect(value.focus).toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith('s')
    expect(notification.close).toHaveBeenCalled()
  })

  it('将已创建通知交给生命周期注册表', () => {
    const { value, notification } = environment('granted')
    const track = vi.fn()
    sendSystemNotification(value, { kind: 'completion', sessionId: 's', sessionTitle: '标题' }, vi.fn(), track)
    expect(track).toHaveBeenCalledWith(notification)
  })
})
