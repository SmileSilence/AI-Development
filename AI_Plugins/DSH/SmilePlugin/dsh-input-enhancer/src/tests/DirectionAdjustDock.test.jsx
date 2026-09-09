import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DirectionAdjustDock } from '../client/direction/DirectionAdjustDock.jsx'

afterEach(() => {
  document.querySelectorAll('[data-queue-dock]').forEach(element => element.remove())
})

function nativeQueue() {
  const dock = document.createElement('div')
  dock.setAttribute('data-queue-dock', '')
  dock.innerHTML = '<ul><li><div><button aria-label="编辑排队消息">编辑</button><button aria-label="删除排队消息">删除</button><button aria-label="插话发送">插话</button></div></li></ul>'
  document.body.append(dock)
  return dock
}

describe('DirectionAdjustDock', () => {
  it('保留全部原按钮，并把调整方向插在删除与插话之间', async () => {
    const dock = nativeQueue()
    const adjustDirection = vi.fn().mockResolvedValue(undefined)
    const snapshot = { running: true, queue: [{ id: 'q1', placement: 'queued' }] }
    render(
      <DirectionAdjustDock
        useSession={selector => selector(snapshot)}
        adjustDirection={adjustDirection}
        notify={vi.fn()}
      />,
    )

    await waitFor(() => expect(dock.querySelector('[data-direction-adjust]')).not.toBeNull())
    const directionButton = dock.querySelector('[data-direction-adjust]')
    const labels = [...dock.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))
    expect(labels).toEqual(['编辑排队消息', '删除排队消息', '调整方向', '插话发送'])
    expect(directionButton.className).toBe('dsh-ie-direction-adjust')
    expect(directionButton.textContent).toBe('调整方向')
    expect(directionButton.querySelector('svg')).not.toBeNull()
    fireEvent.click(directionButton)
    await waitFor(() => expect(adjustDirection).toHaveBeenCalledWith('q1'))
  })

  it('会话空闲时禁用调整方向', async () => {
    const dock = nativeQueue()
    const snapshot = { running: false, queue: [{ id: 'q1', placement: 'queued' }] }
    render(
      <DirectionAdjustDock
        useSession={selector => selector(snapshot)}
        adjustDirection={vi.fn()}
        notify={vi.fn()}
      />,
    )
    await waitFor(() => expect(dock.querySelector('[data-direction-adjust]')).not.toBeNull())
    expect(dock.querySelector('[data-direction-adjust]').disabled).toBe(true)
    expect(dock.querySelector('[data-direction-adjust]').title).toBe('仅运行中可调整方向')
  })
})
