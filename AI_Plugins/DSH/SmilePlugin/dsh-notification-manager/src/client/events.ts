export type NotificationEventKind = 'completion' | 'approval' | 'question' | 'plan-review'

export interface NotificationEvent {
  kind: NotificationEventKind
  sessionId: string
  sessionTitle: string
  interactionKey?: string
}

export interface SessionRow {
  id: string
  displayTitle: string
  running: boolean
}

export interface PendingInteraction {
  key: string
  kind: string
  sessionId: string
}

/**
 * 将 DSH 快照转换为严格的新增/边沿事件。首次同步仅建立基线；交互键在本次
 * Client 生命周期中最多通知一次，避免刷新订阅或优先级切换造成重复通知。
 */
export class NotificationEventTracker {
  private sessionsReady = false
  private pendingReady = false
  private readonly running = new Map<string, boolean>()
  private readonly titles = new Map<string, string>()
  private readonly seenInteractions = new Set<string>()

  syncSessions(rows: readonly SessionRow[]): NotificationEvent[] {
    const events: NotificationEvent[] = []
    const currentIds = new Set<string>()
    for (const row of rows) {
      currentIds.add(row.id)
      const previous = this.running.get(row.id)
      if (this.sessionsReady && previous === true && row.running === false) {
        events.push({ kind: 'completion', sessionId: row.id, sessionTitle: row.displayTitle })
      }
      this.running.set(row.id, row.running)
      this.titles.set(row.id, row.displayTitle)
    }
    for (const id of this.running.keys()) {
      if (!currentIds.has(id)) {
        this.running.delete(id)
        this.titles.delete(id)
      }
    }
    this.sessionsReady = true
    return events
  }

  syncPending(values: Iterable<PendingInteraction>): NotificationEvent[] {
    const events: NotificationEvent[] = []
    for (const interaction of values) {
      if (!this.pendingReady) {
        this.remember(interaction.key)
        continue
      }
      if (this.seenInteractions.has(interaction.key)) continue
      this.remember(interaction.key)
      if (!isSupportedInteraction(interaction.kind)) continue
      events.push({
        kind: interaction.kind,
        sessionId: interaction.sessionId,
        sessionTitle: this.titles.get(interaction.sessionId) ?? 'DSH 会话',
        interactionKey: interaction.key,
      })
    }
    this.pendingReady = true
    return events
  }

  private remember(key: string): void {
    this.seenInteractions.add(key)
    if (this.seenInteractions.size <= 2048) return
    const oldest = this.seenInteractions.values().next().value as string | undefined
    if (oldest !== undefined) this.seenInteractions.delete(oldest)
  }
}

function isSupportedInteraction(kind: string): kind is 'approval' | 'question' | 'plan-review' {
  return kind === 'approval' || kind === 'question' || kind === 'plan-review'
}
