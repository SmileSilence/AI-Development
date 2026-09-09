import { useEffect, useRef } from 'react'

const REMOVE_LABELS = new Set(['删除排队消息', 'Remove queued message'])
const DIRECTION_CONTENT = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5v2A2.5 2.5 0 0 0 5.5 9H13"/><path d="m10.5 6.5 2.5 2.5-2.5 2.5"/></svg><span>调整方向</span>'

/** 在原生排队消息操作区中追加 Codex 风格“调整方向”按钮。 */
export function DirectionAdjustDock({ useSession, adjustDirection, notify }) {
  const anchorRef = useRef(null)
  const queue = useSession(snapshot => snapshot.queue)
  const running = useSession(snapshot => snapshot.running)

  useEffect(() => {
    const anchor = anchorRef.current
    if (anchor === null) return undefined
    const root = anchor.parentElement?.parentElement ?? document

    const patch = () => {
      const rows = [...root.querySelectorAll('[data-queue-dock] li:not([data-submission-echo])')]
      const queued = queue.filter(row => row.placement === 'queued')
      rows.forEach((rowElement, index) => {
        const item = queued[index]
        if (item === undefined || rowElement.querySelector('[data-direction-adjust]') !== null) return
        const buttons = [...rowElement.querySelectorAll('button')]
        const remove = buttons.find(button => REMOVE_LABELS.has(button.getAttribute('aria-label') ?? ''))
        if (remove === undefined) return

        const button = remove.cloneNode(true)
        button.removeAttribute('class')
        button.removeAttribute('style')
        button.removeAttribute('title')
        button.className = 'dsh-ie-direction-adjust'
        button.setAttribute('aria-label', '调整方向')
        button.setAttribute('title', running ? '调整方向' : '仅运行中可调整方向')
        button.setAttribute('data-direction-adjust', '')
        button.innerHTML = DIRECTION_CONTENT
        button.disabled = !running
        button.addEventListener('click', async () => {
          if (button.disabled) return
          button.disabled = true
          try {
            await adjustDirection(item.id)
          } catch (error) {
            notify('error', `调整方向失败：${error instanceof Error ? error.message : String(error)}`)
            button.disabled = !running
          }
        })
        remove.insertAdjacentElement('afterend', button)
      })
    }

    patch()
    const observer = new MutationObserver(patch)
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      root.querySelectorAll('[data-direction-adjust]').forEach(element => element.remove())
    }
  }, [adjustDirection, notify, queue, running])

  return <span ref={anchorRef} data-direction-adjust-controller="" hidden />
}
