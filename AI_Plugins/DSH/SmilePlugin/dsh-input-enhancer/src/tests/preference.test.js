import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREFERENCE_KEY, readPreference, subscribePreferenceSync, writePreference } from '../client/plan/preference.js'

describe('常驻 Plan 偏好存储', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('默认关闭（无记录 / 非法值）', () => {
    expect(readPreference()).toBe(false)
    window.localStorage.setItem(PREFERENCE_KEY, 'garbage')
    expect(readPreference()).toBe(false)
    window.localStorage.setItem(PREFERENCE_KEY, 'false')
    expect(readPreference()).toBe(false)
  })

  it('写入 true/false 可恢复', () => {
    expect(writePreference(true)).toBe(true)
    expect(readPreference()).toBe(true)
    expect(writePreference(false)).toBe(true)
    expect(readPreference()).toBe(false)
  })

  it('读取失败默认关闭', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(readPreference()).toBe(false)
  })

  it('写入失败返回 false（调用方保持选择并提示）', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(writePreference(true)).toBe(false)
  })

  it('storage 事件仅在键匹配时通知', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePreferenceSync(listener)

    const fire = (key, newValue) => {
      const event = new Event('storage')
      Object.defineProperty(event, 'key', { value: key })
      Object.defineProperty(event, 'newValue', { value: newValue })
      window.dispatchEvent(event)
    }

    fire(PREFERENCE_KEY, 'true')
    expect(listener).toHaveBeenCalledTimes(1)
    fire('other-key', 'true')
    expect(listener).toHaveBeenCalledTimes(1)
    fire(PREFERENCE_KEY, null) // 清除键不通知（保留当前选择）
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    fire(PREFERENCE_KEY, 'false')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
