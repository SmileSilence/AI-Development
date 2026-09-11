import { describe, expect, it, vi } from 'vitest'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { NotificationManagerSettings } from '../src/shared/settings-types.ts'
import { startNotificationRuntime } from '../src/client/runtime.ts'
import type { NotificationEnvironment } from '../src/client/notifier.ts'

describe('通知运行时', () => {
  it('设置暂不可用时跳过事件，恢复后继续处理新边沿', () => {
    let sessionListener = () => {}
    let state = { ids: ['s'], byId: { s: { id: 's', displayTitle: '会话', running: false } } }
    let settingsReady = false
    const create = vi.fn(() => ({ onclick: null, close: vi.fn() }))
    const sessions = {
      list: { getSnapshot: () => state, subscribe: (listener: () => void) => { sessionListener = listener; return () => {} } },
      open: vi.fn(),
    } as unknown as ISessions
    const pending = {
      getSnapshot: () => new Map() as SessionPendingInteractionSnapshot,
      subscribe: () => () => {},
    }
    const settings = {
      getSnapshot: () => settingsReady
        ? { status: 'ready', value: { turnMode: 'always', permissionsEnabled: true, questionsEnabled: true }, writable: true }
        : { status: 'loading', value: undefined, writable: false },
    } as unknown as SettingsScope<NotificationManagerSettings>
    const environment = {
      permission: () => 'granted', requestPermission: async () => 'granted', create, focus: vi.fn(),
    } satisfies NotificationEnvironment
    const dispose = startNotificationRuntime({
      sessions, pending, settings, environment,
      coordinator: { isLeader: () => true, anyPageFocused: () => false, dispose: () => {} },
    })

    state = { ...state, byId: { s: { ...state.byId.s, running: true } } }; sessionListener()
    state = { ...state, byId: { s: { ...state.byId.s, running: false } } }; sessionListener()
    expect(create).not.toHaveBeenCalled()
    settingsReady = true
    state = { ...state, byId: { s: { ...state.byId.s, running: true } } }; sessionListener()
    state = { ...state, byId: { s: { ...state.byId.s, running: false } } }; sessionListener()
    expect(create).toHaveBeenCalledTimes(1)
    dispose()
  })
})
