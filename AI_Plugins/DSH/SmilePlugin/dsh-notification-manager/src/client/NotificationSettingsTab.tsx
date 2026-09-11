import { useSyncExternalStore, useState } from 'react'
import { Button, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { NotificationManagerSettings, TurnNotificationMode } from '../shared/settings-types.ts'
import type { NotificationEnvironment, NotificationPermissionState } from './notifier.ts'

export interface NotificationSettingsTabInjected {
  scope: SettingsScope<NotificationManagerSettings>
  environment: NotificationEnvironment
  sendTest(): boolean
}

const modeItems = [
  { id: 'off', label: '关闭' },
  { id: 'unfocused', label: '仅失焦时' },
  { id: 'always', label: '始终' },
]

function permissionLabel(permission: NotificationPermissionState): string {
  if (permission === 'granted') return '已允许'
  if (permission === 'denied') return '已拒绝（请在系统或站点设置中修改）'
  if (permission === 'default') return '尚未授权'
  return '当前环境不支持系统通知'
}

export function NotificationSettingsTab({ scope, environment, sendTest }: NotificationSettingsTabInjected) {
  const snapshot = useSyncExternalStore(
    listener => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot(),
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [permission, setPermission] = useState(() => environment.permission())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const settings = snapshot.value
  const disabled = settings === undefined || !snapshot.writable || busy

  const save = async (field: keyof NotificationManagerSettings, value: unknown): Promise<void> => {
    setBusy(true); setMessage('')
    try { await scope.set(field, value) }
    catch { setMessage('设置保存失败，请稍后重试。') }
    finally { setBusy(false) }
  }
  const test = async (): Promise<void> => {
    setBusy(true); setMessage('')
    try {
      let current = environment.permission()
      if (current === 'default') current = await environment.requestPermission()
      setPermission(current)
      if (current !== 'granted') {
        setMessage(permissionLabel(current))
        return
      }
      setMessage(sendTest() ? '测试通知已发送。' : '系统未能显示测试通知。')
    } catch { setMessage('系统通知授权失败。') }
    finally { setBusy(false) }
  }

  if (settings === undefined) {
    return <div data-smilexx-notification-manager><div className="smilexx-notification-manager-section"><div className="smilexx-notification-manager-row">
      <span className="smilexx-notification-manager-status">{snapshot.status === 'loading' ? '正在加载通知设置…' : '通知设置服务暂不可用。'}</span>
    </div></div></div>
  }

  return <div data-smilexx-notification-manager>
    <div className="smilexx-notification-manager-section">
      <div className="smilexx-notification-manager-row">
        <div className="smilexx-notification-manager-copy"><span className="smilexx-notification-manager-label">任务完成通知</span><span className="smilexx-notification-manager-description">任务停止运行时发送通知。</span></div>
        <Menu open={menuOpen} onClose={() => setMenuOpen(false)} items={modeItems}
          selectedId={settings.turnMode} onSelect={id => { setMenuOpen(false); void save('turnMode', id as TurnNotificationMode) }}
          portal align="start" anchor={<button type="button" className="smilexx-notification-manager-select" disabled={disabled}
            aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {modeItems.find(item => item.id === settings.turnMode)?.label}
          </button>} />
      </div>
      <div className="smilexx-notification-manager-row">
        <div className="smilexx-notification-manager-copy"><span className="smilexx-notification-manager-label">权限请求</span><span className="smilexx-notification-manager-description">工具执行需要授权时提醒。</span></div>
        <Switch checked={settings.permissionsEnabled} disabled={disabled} label="权限请求通知"
          onChange={checked => { void save('permissionsEnabled', checked) }} />
      </div>
      <div className="smilexx-notification-manager-row">
        <div className="smilexx-notification-manager-copy"><span className="smilexx-notification-manager-label">问题与计划确认</span><span className="smilexx-notification-manager-description">需要回答问题或确认计划时提醒。</span></div>
        <Switch checked={settings.questionsEnabled} disabled={disabled} label="问题与计划确认通知"
          onChange={checked => { void save('questionsEnabled', checked) }} />
      </div>
    </div>
    <div className="smilexx-notification-manager-section">
      <div className="smilexx-notification-manager-row">
        <div className="smilexx-notification-manager-copy"><span className="smilexx-notification-manager-label">系统通知权限</span><span className="smilexx-notification-manager-status">{permissionLabel(permission)}</span></div>
        <div className="smilexx-notification-manager-actions"><Button variant="outline" size="sm" disabled={busy || permission === 'unsupported'} onClick={() => { void test() }}>发送测试通知</Button></div>
      </div>
      {message !== '' && <div className={`smilexx-notification-manager-row ${message.includes('失败') ? 'smilexx-notification-manager-error' : ''}`} role="status">{message}</div>}
    </div>
  </div>
}
