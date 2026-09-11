/**
 * 命令归属解析：把菜单里的命令名映射到来源插件显示名（v2.1.0）。
 *
 * 三层来源（优先级从高到低）：
 * - L3 用户配置：localStorage `smilexx-input-enhancer:commandOwners`（JSON 对象，
 *   命令名 → 插件显示名；客户端启动图不向 apply 传配置，故沿用与
 *   defaultPlanMode 相同的浏览器存储通道）。读取时回退旧键
 *   `dsh-input-enhancer:commandOwners`（v2.3.1 及更早的配置不丢）；
 * - L1 运行时捕获：包装 ui-commands 的 CommandUiRuntime.prototype.register/
 *   decorate，在调用瞬间从 traceable 代理的 ctx 沿 fiber 父链解析调用方
 *   Loader entry（options.name 即插件包名）；
 * - L2 内置默认表：已知真实环境插件的命令（当前仅 rewind/undo）。
 *
 * 三层都未命中的命令回退“其他”分组（与 2.0 行为一致）。
 */

/** L2 内置默认归属表：已知真实环境插件命令。 */
export const DEFAULT_COMMAND_OWNERS = Object.freeze({
  rewind: 'dsh-rewind-plugin',
  undo: 'dsh-rewind-plugin',
})

/** L3 用户配置的 localStorage 键（包改名后新前缀）。 */
export const OWNERS_STORAGE_KEY = 'smilexx-input-enhancer:commandOwners'
/** 旧键名（v2.3.1 及更早），仅用于读取回退迁移。 */
const LEGACY_OWNERS_STORAGE_KEY = 'dsh-input-enhancer:commandOwners'

/** L1 运行时捕获表（模块级单例，拦截器经 noteCommandOwner 写入）。 */
const captured = new Map()

/**
 * 记录一条运行时归属（先到先得；同名命令只记第一个来源）。
 * @param {string} name - 命令名。
 * @param {string} ownerLabel - 插件显示名（Loader entry 的 name/id）。
 */
export function noteCommandOwner(name, ownerLabel) {
  if (typeof name !== 'string' || name.length === 0) return
  if (typeof ownerLabel !== 'string' || ownerLabel.length === 0) return
  if (!captured.has(name)) captured.set(name, ownerLabel)
}

/** 读取运行时捕获表的只读快照（供 ownerOf / 测试使用）。 */
export function capturedOwners() {
  return new Map(captured)
}

/**
 * 读取用户配置（localStorage JSON 对象）；解析失败返回空表。
 * @returns {Record<string, string>}
 */
export function readConfiguredOwners(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(OWNERS_STORAGE_KEY) ?? storage?.getItem(LEGACY_OWNERS_STORAGE_KEY)
    if (typeof raw !== 'string' || raw.length === 0) return {}
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const owners = {}
    for (const [name, label] of Object.entries(parsed)) {
      if (typeof name === 'string' && name.length > 0 && typeof label === 'string' && label.length > 0) {
        owners[name] = label
      }
    }
    return owners
  } catch {
    return {}
  }
}

/**
 * 归属查找：L3 → L1 → L2；都未命中返回 null。
 * @param {string} name - 命令名。
 * @param {{ configOwners?: Record<string, string>, capturedOwners?: Map<string, string> }} [sources]
 * @returns {string | null}
 */
export function ownerOf(name, sources = {}) {
  if (typeof name !== 'string' || name.length === 0) return null
  const configured = sources.configOwners?.[name]
  if (typeof configured === 'string' && configured.length > 0) return configured
  const hit = sources.capturedOwners?.get?.(name)
  if (typeof hit === 'string' && hit.length > 0) return hit
  const fallback = DEFAULT_COMMAND_OWNERS[name]
  return typeof fallback === 'string' ? fallback : null
}

/**
 * 沿 fiber 父链解析调用方插件 entry 的显示名（vendor/loader locate() 同款遍历）。
 * 兼容两种接收者：traceable 代理（ctx 即调用方 ctx）与 extend 影子
 * ctx（fiber 为调用方 fiber 的子 fiber，沿 parent 上溯即可）。
 * @param {unknown} ctx - 包装方法内拿到的 this.ctx。
 * @returns {string | null} entry.options.name ?? entry.options.id ?? null
 */
export function entryLabelOf(ctx) {
  try {
    let fiber = ctx?.fiber
    for (let guard = 0; fiber != null && guard < 64; guard += 1) {
      const entry = fiber.entry
      if (entry != null) {
        const name = entry.options?.name
        if (typeof name === 'string' && name.length > 0) return name
        const id = entry.options?.id
        if (typeof id === 'string' && id.length > 0) return id
      }
      const next = fiber.parent?.fiber
      if (next == null || next === fiber) return null
      fiber = next
    }
  } catch {}
  return null
}
