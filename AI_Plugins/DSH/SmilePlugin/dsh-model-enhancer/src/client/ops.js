/**
 * llm-pi-ai `models` 数组的整组读改写：从命名空间视图构造 `settings.mutate`
 * 路径操作，语义与官方 ProviderEditor 一致——整组读出、单点修改、整组
 * `set` 回去（settings 路径寻址不支持下标，官方卡片同样整组写）。
 */

/** llm-pi-ai 的设置命名空间。 */
export const PI_AI_NS = 'llm-pi-ai'

/**
 * 从命名空间视图读取某 provider 用户层的 models 数组。
 * @param {object | undefined} namespace - describe 返回的命名空间视图（value/user/revision）。
 * @param {string} providerId - provider 路由 id。
 * @returns {{ models: Array<object> | undefined, revision: number }} 用户层数组（可能不存在）与当前 revision。
 */
export function readProviderModels(namespace, providerId) {
  const user = namespace !== undefined && namespace.user !== undefined ? namespace.user : undefined
  const providers = user !== undefined && user.providers !== undefined ? user.providers : undefined
  const profile = providers !== undefined && providers[providerId] !== undefined ? providers[providerId] : undefined
  const models = profile !== undefined && Array.isArray(profile.models) ? profile.models : undefined
  const revision = namespace !== undefined && typeof namespace.revision === 'number' ? namespace.revision : undefined
  return { models, revision }
}

/**
 * 构造把一个模型的 `input` 字段置为 `[text, image]`（勾选）或删除该字段
 * （取消勾选）的操作。数组按原引用整体写回：不改动的条目保持原对象，
 * 目标条目浅拷贝后增删字段，其余字段（id/name/contextWindow/…）原样保留。
 *
 * @param {Array<object>} models - 用户层当前 models 数组（原样写回的底稿）。
 * @param {string} providerId - provider 路由 id（写入路径的中间段）。
 * @param {string} modelId - 目标模型 id（数组内 `id` 字段精确匹配）。
 * @param {boolean} imageInput - true 勾选图片输入；false 恢复继承默认。
 * @returns {{ op: 'set', path: string[], value: Array<object> } | undefined} 单条 set 操作；找不到目标条目时 undefined。
 */
export function buildModelInputOp(models, providerId, modelId, imageInput) {
  const index = models.findIndex(model => model !== null && typeof model === 'object' && model.id === modelId)
  if (index < 0) return undefined
  const entry = models[index]
  const next = { ...entry }
  if (imageInput) {
    next.input = ['text', 'image']
  } else {
    // 数组元素无 undefined 语义：删除字段 = 恢复继承，不能写成 input: []。
    delete next.input
  }
  const value = models.map((model, at) => (at === index ? next : model))
  return { op: 'set', path: ['providers', providerId, 'models'], value }
}

/**
 * settings.mutate 的 Remote 应答折叠：ok 视为已写入，`settings/conflict`
 * 单列，其余拒绝透传宿主诊断。
 * @param {{ ok: true, value: object } | { ok: false, error: { code: string, message: string } }} response - mutate 应答。
 * @returns {{ kind: 'written', revision: number } | { kind: 'conflict' } | { kind: 'refused', message: string }} 折叠结果。
 */
export function foldWriteResponse(response) {
  if (response.ok) {
    const revision = response.value !== undefined && typeof response.value.revision === 'number'
      ? response.value.revision
      : undefined
    return { kind: 'written', revision }
  }
  if (response.error !== undefined && response.error.code === 'settings/conflict') {
    return { kind: 'conflict' }
  }
  return {
    kind: 'refused',
    message: response.error !== undefined && typeof response.error.message === 'string' ? response.error.message : '',
  }
}
