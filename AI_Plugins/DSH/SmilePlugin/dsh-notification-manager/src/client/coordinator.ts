const CHANNEL_NAME = 'smilexx-notification-manager:v1'
const LOCK_NAME = 'smilexx-notification-manager:sender'
const HEARTBEAT_MS = 2_000
const LEASE_MS = 6_000

interface PeerState { focused: boolean; seenAt: number }
interface CoordinationMessage { type: 'state' | 'bye'; id: string; focused: boolean; sentAt: number }

export interface NotificationCoordinator {
  isLeader(): boolean
  anyPageFocused(): boolean
  dispose(): void
}

/** 可单测的租约判定：活跃客户端中 ID 最小者为后备主节点。 */
export function electLeaseLeader(selfId: string, peers: ReadonlyMap<string, PeerState>, now: number): boolean {
  const activeIds = [selfId, ...[...peers]
    .filter(([, peer]) => now - peer.seenAt <= LEASE_MS)
    .map(([id]) => id)]
  activeIds.sort()
  return activeIds[0] === selfId
}

/** “仅失焦”基于同源页面聚合，而不是只看当前标签页。 */
export function hasFocusedPage(localFocused: boolean, peers: ReadonlyMap<string, PeerState>, now: number): boolean {
  return localFocused || [...peers.values()].some(peer => now - peer.seenAt <= LEASE_MS && peer.focused)
}

export function createNotificationCoordinator(): NotificationCoordinator {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  const peers = new Map<string, PeerState>()
  const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL_NAME)
  let disposed = false
  let lockLeader = false
  let lockPending = false
  let releaseLock: (() => void) | undefined

  const focused = (): boolean => document.visibilityState === 'visible' && document.hasFocus()
  const publish = (type: CoordinationMessage['type'] = 'state'): void => {
    channel?.postMessage({ type, id, focused: focused(), sentAt: Date.now() } satisfies CoordinationMessage)
  }
  if (channel !== undefined) {
    channel.onmessage = event => {
      const message = event.data as Partial<CoordinationMessage>
      if (message.id === id || typeof message.id !== 'string') return
      if (message.type === 'bye') peers.delete(message.id)
      else if (message.type === 'state' && typeof message.focused === 'boolean') {
        peers.set(message.id, { focused: message.focused, seenAt: Date.now() })
      }
    }
  }

  const tryLock = (): void => {
    if (disposed || lockPending || lockLeader || navigator.locks === undefined) return
    lockPending = true
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async lock => {
      lockPending = false
      if (lock === null || disposed) return
      lockLeader = true
      await new Promise<void>(resolve => { releaseLock = resolve })
      releaseLock = undefined
      lockLeader = false
    }).catch(() => { lockPending = false })
  }

  const tick = (): void => {
    const now = Date.now()
    for (const [peerId, peer] of peers) if (now - peer.seenAt > LEASE_MS) peers.delete(peerId)
    publish()
    tryLock()
  }
  const timer = window.setInterval(tick, HEARTBEAT_MS)
  const onFocus = (): void => publish()
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onFocus)
  document.addEventListener('visibilitychange', onFocus)
  publish()
  tryLock()

  return {
    isLeader: () => navigator.locks !== undefined ? lockLeader : electLeaseLeader(id, peers, Date.now()),
    anyPageFocused: () => hasFocusedPage(focused(), peers, Date.now()),
    dispose: () => {
      if (disposed) return
      disposed = true
      publish('bye')
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      releaseLock?.()
      channel?.close()
      peers.clear()
    },
  }
}
