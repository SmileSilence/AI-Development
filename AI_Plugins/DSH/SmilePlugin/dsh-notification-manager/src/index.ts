import { NotificationManagerSettingsSchema } from './settings-schema.ts'
import { DEFAULT_NOTIFICATION_MANAGER_SETTINGS, PLUGIN_ID, SETTINGS_NAMESPACE } from './shared/settings-types.ts'

export const name = PLUGIN_ID
export const inject = ['settings']

interface HostContext {
  inject(namespaces: string[], callback: (ctx: HostContext) => void): void
  settings: { register(namespace: string, schema: unknown, options?: { base?: unknown }): void }
}

/** 注册唯一持久化设置命名空间；本插件不暴露 Host 服务或模型工具。 */
export function apply(ctx: HostContext): void {
  ctx.inject(['settings'], scoped => {
    scoped.settings.register(SETTINGS_NAMESPACE, NotificationManagerSettingsSchema, {
      base: DEFAULT_NOTIFICATION_MANAGER_SETTINGS,
    })
  })
}

export type { TurnNotificationMode, NotificationManagerSettings } from './shared/settings-types.ts'
export { DEFAULT_NOTIFICATION_MANAGER_SETTINGS, PLUGIN_ID } from './shared/settings-types.ts'
