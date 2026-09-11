import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { NotificationManagerSettings } from '../shared/settings-types.ts'
import type { NotificationCoordinator } from './coordinator.ts'
import { NotificationEventTracker } from './events.ts'
import type { NotificationEnvironment, NotificationLike } from './notifier.ts'
import { sendSystemNotification } from './notifier.ts'
import { shouldNotify } from './policy.ts'

interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): () => void }

/** 连接会话、交互与设置三个数据面，并返回完整清理函数。 */
export function startNotificationRuntime(options: {
  sessions: ISessions
  pending: Observable<SessionPendingInteractionSnapshot>
  settings: SettingsScope<NotificationManagerSettings>
  coordinator: NotificationCoordinator
  environment: NotificationEnvironment
  trackNotification?: (notification: NotificationLike) => void
  onConnectionReset?: (listener: () => void) => () => void
}): () => void {
  let tracker = new NotificationEventTracker()
  const deliver = (events: ReturnType<NotificationEventTracker['syncSessions']>): void => {
    const snapshot = options.settings.getSnapshot()
    if (snapshot.status !== 'ready' || snapshot.value === undefined || !options.coordinator.isLeader()) return
    for (const event of events) {
      if (!shouldNotify(event, snapshot.value, options.coordinator.anyPageFocused())) continue
      sendSystemNotification(options.environment, event, id => {
        options.sessions.open(id as Parameters<ISessions['open']>[0])
      }, options.trackNotification)
    }
  }
  const syncSessions = (): void => {
    const snapshot = options.sessions.list.getSnapshot()
    deliver(tracker.syncSessions(snapshot.ids.map(
      (id: Parameters<ISessions['open']>[0]) => snapshot.byId[id],
    ).filter(Boolean)))
  }
  const syncPending = (): void => deliver(tracker.syncPending(options.pending.getSnapshot().values()))

  syncSessions()
  syncPending()
  const disposeSessions = options.sessions.list.subscribe(syncSessions)
  const disposePending = options.pending.subscribe(syncPending)
  const disposeReset = options.onConnectionReset?.(() => {
    tracker = new NotificationEventTracker()
    syncSessions()
    syncPending()
  })
  return () => { disposeReset?.(); disposePending(); disposeSessions() }
}
