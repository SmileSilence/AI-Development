import z from '@deepseek-ai/schemastery'
import { DEFAULT_NOTIFICATION_MANAGER_SETTINGS } from './shared/settings-types.ts'

export const NotificationManagerSettingsSchema = z.object({
  turnMode: z.union([z.const('off'), z.const('unfocused'), z.const('always')])
    .default(DEFAULT_NOTIFICATION_MANAGER_SETTINGS.turnMode),
  permissionsEnabled: z.boolean().default(DEFAULT_NOTIFICATION_MANAGER_SETTINGS.permissionsEnabled),
  questionsEnabled: z.boolean().default(DEFAULT_NOTIFICATION_MANAGER_SETTINGS.questionsEnabled),
})
