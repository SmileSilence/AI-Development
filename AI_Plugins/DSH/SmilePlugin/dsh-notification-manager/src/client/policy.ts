import type { NotificationManagerSettings } from '../shared/settings-types.ts'
import type { NotificationEvent } from './events.ts'

/** 所有策略判断只依赖脱敏事件，不读取交互正文或工具参数。 */
export function shouldNotify(
  event: NotificationEvent,
  settings: NotificationManagerSettings,
  anyDshPageFocused: boolean,
): boolean {
  if (event.kind === 'completion') {
    return settings.turnMode === 'always'
      || (settings.turnMode === 'unfocused' && !anyDshPageFocused)
  }
  if (event.kind === 'approval') return settings.permissionsEnabled
  return settings.questionsEnabled
}

export interface SafeNotificationContent { title: string; body: string }

/** 通知正文只包含固定类型文案和会话标题。 */
export function safeNotificationContent(event: NotificationEvent): SafeNotificationContent {
  const title = event.kind === 'completion' ? '任务已结束'
    : event.kind === 'approval' ? '需要权限确认'
    : event.kind === 'plan-review' ? '需要计划确认'
    : '需要回答问题'
  return { title, body: event.sessionTitle || 'DSH 会话' }
}
