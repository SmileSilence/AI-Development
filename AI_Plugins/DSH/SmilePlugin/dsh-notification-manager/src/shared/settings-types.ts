/** 任务完成通知模式，与 Codex 的关闭/仅失焦/始终一致。 */
export type TurnNotificationMode = 'off' | 'unfocused' | 'always'

/** 插件持久化设置。 */
export interface NotificationManagerSettings {
  turnMode: TurnNotificationMode
  permissionsEnabled: boolean
  questionsEnabled: boolean
}

/** SmileXX 自有插件统一使用的稳定插件标识。 */
export const PLUGIN_ID = 'smilexx-notification-manager'

/** 持久化键也使用完整插件标识前缀，避免占用通用命名空间。 */
export const SETTINGS_NAMESPACE = `${PLUGIN_ID}-settings`

/** Host、Client 与测试共用的默认值。 */
export const DEFAULT_NOTIFICATION_MANAGER_SETTINGS: Readonly<NotificationManagerSettings> = Object.freeze({
  turnMode: 'unfocused',
  permissionsEnabled: true,
  questionsEnabled: true,
})
