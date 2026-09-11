import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULT_NOTIFICATION_MANAGER_SETTINGS, PLUGIN_ID, SETTINGS_NAMESPACE, type NotificationManagerSettings } from '../shared/settings-types.ts'
import { createNotificationCoordinator } from './coordinator.ts'
import { NotificationSettingsTab, type NotificationSettingsTabInjected } from './NotificationSettingsTab.tsx'
import { browserNotificationEnvironment, sendSystemNotification, type NotificationLike } from './notifier.ts'
import { startNotificationRuntime } from './runtime.ts'
import { notificationManagerStyles } from './styles.ts'

export const inject = ['slots', 'locale', 'sessions', 'uiSession', 'settingsScope']

export function apply(ctx: Context): void {
  const sessions = ctx.get('sessions') as ISessions
  const scope = ctx.settingsScope.bind<NotificationManagerSettings>({ namespace: SETTINGS_NAMESPACE })
  const environment = browserNotificationEnvironment()
  const coordinator = createNotificationCoordinator()
  const activeNotifications = new Set<NotificationLike>()
  const trackNotification = (notification: NotificationLike): void => {
    activeNotifications.add(notification)
    notification.onclose = () => activeNotifications.delete(notification)
  }

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.pluginCss = 'smilexx-notification-manager'
    style.textContent = notificationManagerStyles
    document.head.appendChild(style)
    return () => style.remove()
  }, `${PLUGIN_ID}: styles`)

  ctx.effect(() => () => coordinator.dispose(), `${PLUGIN_ID}: coordination`)
  ctx.effect(() => () => {
    for (const notification of activeNotifications) notification.close()
    activeNotifications.clear()
  }, `${PLUGIN_ID}: notifications`)
  ctx.effect(() => startNotificationRuntime({
    sessions,
    pending: ctx.uiSession.pendingInteractions,
    settings: scope,
    coordinator,
    environment,
    trackNotification,
    onConnectionReset: listener => ctx.on('connection/reset', listener),
  }), `${PLUGIN_ID}: subscriptions`)

  const sendTest = (): boolean => sendSystemNotification(environment, {
    kind: 'completion', sessionId: sessions.list.getSnapshot().current ?? '', sessionTitle: 'DSH 测试通知',
  }, id => { if (id !== '') sessions.open(id as Parameters<ISessions['open']>[0]) }, trackNotification)

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register(
    {
      name: 'settings.plugins.tab',
      id: `${PLUGIN_ID}-settings-tab`,
      order: 30,
      label: () => '通知管理',
      inject: (): NotificationSettingsTabInjected => ({ scope, environment, sendTest }),
    },
    NotificationSettingsTab,
  ))

  // 设置服务不可用时保留明确默认值仅供类型与调试查看，不在 Client 本地写入。
  void DEFAULT_NOTIFICATION_MANAGER_SETTINGS
}
