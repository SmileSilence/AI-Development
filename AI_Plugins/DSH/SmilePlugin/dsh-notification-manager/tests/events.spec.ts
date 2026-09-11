import { describe, expect, it } from 'vitest'
import { NotificationEventTracker } from '../src/client/events.ts'

describe('NotificationEventTracker', () => {
  it('首次加载不补发，且只识别 running true 到 false', () => {
    const tracker = new NotificationEventTracker()
    expect(tracker.syncSessions([{ id: 'a', displayTitle: '会话 A', running: false }])).toEqual([])
    expect(tracker.syncSessions([{ id: 'a', displayTitle: '会话 A', running: true }])).toEqual([])
    expect(tracker.syncSessions([{ id: 'a', displayTitle: '会话 A', running: false }])).toEqual([
      { kind: 'completion', sessionId: 'a', sessionTitle: '会话 A' },
    ])
    expect(tracker.syncSessions([{ id: 'a', displayTitle: '会话 A', running: false }])).toEqual([])
  })

  it('分类交互并按不透明键去重', () => {
    const tracker = new NotificationEventTracker()
    tracker.syncSessions([{ id: 'a', displayTitle: '安全标题', running: false }])
    expect(tracker.syncPending([{ key: 'old', kind: 'approval', sessionId: 'a' }])).toEqual([])
    const values = [
      { key: 'approval-1', kind: 'approval', sessionId: 'a' },
      { key: 'question-1', kind: 'question', sessionId: 'a' },
      { key: 'plan-1', kind: 'plan-review', sessionId: 'a' },
      { key: 'ignored', kind: 'custom', sessionId: 'a' },
    ]
    expect(tracker.syncPending(values).map(event => event.kind)).toEqual(['approval', 'question', 'plan-review'])
    expect(tracker.syncPending(values)).toEqual([])
  })
})
