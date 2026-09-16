/**
 * 设置页注入控制器：观察展开区域、维护未提交勾选、在官方保存后提交
 * settings.mutate 写入、官方取消时丢弃。
 *
 * 生命周期：观察器仅当页面上存在 provider 编辑卡时挂 DOM 监听；插件卸载
 * 时断开观察、移除全部注入节点。锚点缺失时静默空操作。
 */

import { PI_AI_NS, readProviderModels, buildModelInputOp, foldWriteResponse } from './ops.js'
import { judgeModelVision } from './knowledge.js'
import {
  providerIdOfCard, modelIdOfEntry, entryOfAdvanced, advancedAreasOfCard,
  isInjected, declaredImageInput, createCapabilityNode,
} from './dom.js'

/** 观察的设置页根节点选择器：官方设置面板容器（body 级兜底由调用方过滤）。 */
const SETTINGS_ROOT_SELECTOR = '[class*="_section"], [class*="_settingsPanel"], body'

/**
 * @param {object} face - 宿主能力面。
 * @param {() => ({ value?: object, revision?: number } | undefined)} face.readNamespace - 读 llm-pi-ai 命名空间视图（同步快照）。
 * @param {(ns: string, ops: Array<object>, revision: number | undefined) => Promise<object>} face.mutate - settings.mutate。
 */
export class ModelEnhancerController {
  constructor(face) {
    this.face = face
    /** @type {Map<string, boolean>} providerId|modelId → 目标勾选（未提交）。 */
    this.pending = new Map()
    /** @type {Map<string, MutationObserver>} 注入过的展开区域 → 自身观察（无；预留）。 */
    this.observer = undefined
    /** @type {WeakSet<Element>} 已注入节点，卸载清理用。 */
    this.injected = new WeakSet()
  }

  /** pending 键：provider 与模型 id 拼接。 */
  static keyOf(providerId, modelId) {
    return `${providerId}\u0000${modelId}`
  }

  /**
   * 当前勾选状态：未提交值优先，否则读命名空间视图的声明。
   * @param {string} providerId - provider 路由 id。
   * @param {string} modelId - 模型 id。
   * @returns {boolean} 是否应显示为勾选。
   */
  effectiveChecked(providerId, modelId) {
    const pending = this.pending.get(ModelEnhancerController.keyOf(providerId, modelId))
    if (pending !== undefined) return pending
    const { models } = readProviderModels(this.face.readNamespace(), providerId)
    return declaredImageInput(models, modelId)
  }

  /**
   * 记录一次未提交勾选变更。
   * @param {string} providerId - provider 路由 id。
   * @param {string} modelId - 模型 id。
   * @param {boolean} checked - 目标状态。
   */
  setPending(providerId, modelId, checked) {
    this.pending.set(ModelEnhancerController.keyOf(providerId, modelId), checked)
  }

  /** 丢弃全部未提交勾选（官方卡片取消/关闭时调用）。 */
  discardPending() {
    this.pending.clear()
  }

  /**
   * 提交全部未提交勾选：整组读改写 models，每 provider 一条 set 操作；
   * revision 冲突时重读重试一次。
   * @returns {Promise<string | undefined>} 失败提示；undefined 全部成功。
   */
  async commitPending() {
    if (this.pending.size === 0) return undefined
    // 按 provider 分组，一个 provider 一次写（同组多个模型共享一条 set）。
    const byProvider = new Map()
    for (const [key, checked] of this.pending) {
      const separator = key.indexOf('\u0000')
      const providerId = key.slice(0, separator)
      const modelId = key.slice(separator + 1)
      if (!byProvider.has(providerId)) byProvider.set(providerId, [])
      byProvider.get(providerId).push({ modelId, checked })
    }
    const failures = []
    for (const [providerId, changes] of byProvider) {
      try {
        await this.commitProvider(providerId, changes, 1)
      } catch (error) {
        failures.push(`${providerId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (failures.length > 0) return failures.join('；')
    this.pending.clear()
    return undefined
  }

  /**
   * 提交单个 provider 的变更，带一次冲突重试。
   * @param {string} providerId - provider 路由 id。
   * @param {Array<{ modelId: string, checked: boolean }>} changes - 变更列表。
   * @param {number} attemptsLeft - 剩余尝试次数。
   */
  async commitProvider(providerId, changes, attemptsLeft) {
    const namespace = this.face.readNamespace()
    const { models, revision } = readProviderModels(namespace, providerId)
    if (models === undefined) {
      throw new Error('该提供方在用户层没有模型列表，无法写入（请先在设置页添加模型）')
    }
    // 逐条构造：同 provider 多模型各自一次整组写（条目互不重叠，最后一条生效；
    // 顺序应用时每条都已包含前条结果，因为都从同一份最新读数出发单点改写）。
    const ops = []
    let working = models
    for (const change of changes) {
      const op = buildModelInputOp(working, providerId, change.modelId, change.checked)
      if (op === undefined) {
        throw new Error(`模型 ${change.modelId} 不在用户层模型列表中`)
      }
      ops.push(op)
      working = op.value
    }
    const response = await this.face.mutate(PI_AI_NS, ops, revision)
    const outcome = foldWriteResponse(response)
    if (outcome.kind === 'written') return
    if (outcome.kind === 'conflict' && attemptsLeft > 0) {
      return this.commitProvider(providerId, changes, attemptsLeft - 1)
    }
    throw new Error(outcome.kind === 'conflict' ? '配置已被其他窗口修改，请重试' : outcome.message)
  }

  /**
   * 扫描一次：为每个未处理的展开区域注入能力勾选。锚点缺失静默跳过。
   * @param {ParentNode} root - 扫描根。
   */
  scan(root) {
    if (root === null || root === undefined) return
    const advancedAreas = root instanceof Element && root.matches('[class*="_modelAdvanced"]')
      ? [root]
      : [...root.querySelectorAll('[class*="_modelAdvanced"]')]
    for (const advanced of advancedAreas) {
      if (isInjected(advanced)) continue
      const entry = entryOfAdvanced(advanced)
      if (entry === undefined) continue
      const card = closestEditorCardOf(entry)
      if (card === undefined) continue
      const providerId = providerIdOfCard(card)
      const modelId = modelIdOfEntry(entry)
      if (providerId === undefined || modelId.length === 0) continue
      const checked = this.effectiveChecked(providerId, modelId)
      const { verdict, hint } = judgeModelVision(modelId)
      const node = createCapabilityNode({
        checked,
        hint,
        hintVerdict: verdict,
        onChange: (next) => { this.setPending(providerId, modelId, next) },
      })
      advanced.append(node)
      this.injected.add(node)
    }
  }

  /**
   * 卸载清理：断开观察器、移除全部注入节点、丢弃未提交状态。
   */
  dispose() {
    if (this.observer !== undefined) {
      this.observer.disconnect()
      this.observer = undefined
    }
    this.discardPending()
    // injected 是 WeakSet 无法枚举；注入节点挂 data 标记，按标记清理。
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.smilexx-model-enhancer-capability').forEach(node => node.remove())
    }
  }
}

/**
 * 向上找 provider 编辑卡（dom.js 内部函数的控制器侧复用）。
 * @param {Element} element - 起点。
 * @returns {Element | undefined} 卡根。
 */
function closestEditorCardOf(element) {
  let node = element
  while (node !== null && node !== undefined && node instanceof Element) {
    const className = typeof node.className === 'string' ? node.className : ''
    if (className.split(/\s+/).some(name => name === 'editor' || name.endsWith('_editor') || name === 'addBlock' || name.endsWith('_addBlock'))) {
      return node
    }
    node = node.parentElement
  }
  return undefined
}

export { SETTINGS_ROOT_SELECTOR }
