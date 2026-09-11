import type { NotificationEvent } from './events.ts'
import { safeNotificationContent } from './policy.ts'

export type NotificationPermissionState = NotificationPermission | 'unsupported'

export interface NotificationLike {
  onclick: ((event: Event) => void) | null
  onclose?: ((event: Event) => void) | null
  close(): void
}

export interface NotificationEnvironment {
  permission(): NotificationPermissionState
  requestPermission(): Promise<NotificationPermissionState>
  create(title: string, options: NotificationOptions): NotificationLike
  focus(): void
}

export function browserNotificationEnvironment(): NotificationEnvironment {
  return {
    permission: () => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    requestPermission: async () => typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.requestPermission(),
    create: (title, options) => new Notification(title, options),
    focus: () => window.focus(),
  }
}

/** 安全发送系统通知；权限拒绝、构造失败或打开会话失败均不影响 DSH 主流程。 */
export function sendSystemNotification(
  environment: NotificationEnvironment,
  event: NotificationEvent,
  openSession: (sessionId: string) => void,
  onCreated?: (notification: NotificationLike) => void,
): boolean {
  if (environment.permission() !== 'granted') return false
  const content = safeNotificationContent(event)
  try {
    const notification = environment.create(content.title, {
      body: content.body,
      tag: notificationTag(event),
    })
    notification.onclick = () => {
      try { environment.focus(); openSession(event.sessionId) } catch { /* 点击失败不传播到宿主。 */ }
      notification.close()
    }
    onCreated?.(notification)
    return true
  } catch {
    return false
  }
}

function notificationTag(event: NotificationEvent): string {
  const discriminator = event.interactionKey ?? 'turn'
  return `smilexx-notification-manager:${event.kind}:${event.sessionId}:${discriminator}`
}
