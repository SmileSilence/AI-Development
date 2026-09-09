/**
 * 常驻 Plan 偏好存储：浏览器同源 LocalStorage。
 *
 * 键名保持 dsh-input-enhancer:defaultPlanMode（与旧版一致），值为 'true'/'false'。
 * - 读取失败（隐私模式/被禁用）默认关闭；
 * - 写入失败返回 false，由调用方保持当前页选择并提示未持久化；
 * - 写入成功后同步通知本标签页订阅者（storage 事件只跨标签页，本页收不到——
 *   v2.1.1 修复：缺本地通知会导致菜单勾选状态与实际存储不一致）；
 * - 同源多个标签页仍通过 storage 事件同步偏好。
 */

/** 偏好存储键名（历史兼容，勿改）。 */
export const PREFERENCE_KEY = 'dsh-input-enhancer:defaultPlanMode'

/** 本标签页订阅者集合（写入成功后同步通知）。 */
const localListeners = new Set()

/** 读取常驻偏好；读取失败或非法值默认关闭。 @returns {boolean} */
export function readPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * 写入常驻偏好；成功后同步通知本标签页订阅者。
 * @param {boolean} value - 新的常驻值。
 * @returns {boolean} 是否持久化成功（失败时调用方保持当前选择并提示）。
 */
export function writePreference(value) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, value ? 'true' : 'false')
  } catch {
    return false
  }
  for (const listener of [...localListeners]) {
    try { listener() } catch { /* 单个订阅者异常不阻断通知 */ }
  }
  return true
}

/**
 * 订阅偏好变更：本标签页写入（本地通知）+ 其他同源标签页（storage 事件）。
 * @param {() => void} listener - 变更回调。
 * @returns {() => void} 取消订阅。
 */
export function subscribePreferenceSync(listener) {
  localListeners.add(listener)
  const onStorage = (event) => {
    if (event.key !== PREFERENCE_KEY) return
    if (event.newValue !== null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    localListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
