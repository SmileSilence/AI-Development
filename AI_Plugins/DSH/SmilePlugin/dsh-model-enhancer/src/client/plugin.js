/**
 * smilexx-model-enhancer 客户端插件主体（0.1.0）
 *
 * 在官方模型设置页的模型行展开区注入"图片输入"能力勾选：
 * - 观察：body 级 MutationObserver，仅在出现 provider 编辑卡时低频扫描；
 * - 保存：捕获阶段监听官方"保存/Apply"按钮，成功后以 settings.mutate
 *   提交勾选变更（revision 冲突重试一次）；
 * - 取消：捕获阶段监听官方"取消/Cancel"按钮，丢弃未提交勾选。
 *
 * 锚点缺失时静默空操作；服务缺失时相应作用域等待，不阻塞其他功能。
 */
import { injectStylesOnce } from './style.js'
import { PI_AI_NS } from './ops.js'
import { ModelEnhancerController, SETTINGS_ROOT_SELECTOR } from './controller.js'

/**
 * 条目级硬依赖：settings 命名空间镜像（同步读 llm-pi-ai）与 Remote 写入面。
 * @type {string[]}
 */
export const inject = ['settingsScope', 'remote', 'remote.settings']

/** 保存按钮文案（中英）。 */
const SAVE_LABELS = new Set(['保存', 'Apply', 'Applying…', '保存中…'])
/** 取消按钮文案（中英）。 */
const CANCEL_LABELS = new Set(['取消', 'Cancel', 'Close', '关闭'])

/**
 * 官方编辑卡操作行的提交/取消按钮（primaryButton / secondaryButton 且
 * 文案命中保存或取消词典）。EditorFooter 的按钮无独立 aria-label，
 * 文案词典是当前可用的稳定锚点。
 * @param {Element} element - 待测元素。
 * @returns {'save' | 'cancel' | undefined} 按钮语义。
 */
function classifyActionButton(element) {
  if (!(element instanceof HTMLButtonElement)) return undefined
  const className = typeof element.className === 'string' ? element.className : ''
  const isPrimary = className.split(/\s+/).some(name => name === 'primaryButton' || name.endsWith('_primaryButton'))
  const isSecondary = className.split(/\s+/).some(name => name === 'secondaryButton' || name.endsWith('_secondaryButton'))
  const text = (element.textContent ?? '').trim()
  if (isPrimary && SAVE_LABELS.has(text)) return 'save'
  if (isSecondary && CANCEL_LABELS.has(text)) return 'cancel'
  return undefined
}

/**
 * 从命名空间镜像读 llm-pi-ai 视图的同步快照。
 * settingsScope.describe() 返回 mirror face（getSnapshot/ensure），
 * 数据在 face.getSnapshot().view.namespaces 里。
 * @param {object} settingsScope - 官方 settingsScope 服务。
 * @returns {{ value?: object, revision?: number } | undefined} 命名空间视图。
 */
function readNamespace(settingsScope) {
  try {
    const face = settingsScope.describe()
    if (face === undefined || typeof face !== 'object') return undefined
    const snapshot = typeof face.getSnapshot === 'function' ? face.getSnapshot() : undefined
    const view = snapshot !== undefined ? snapshot.view : undefined
    if (view === undefined || !Array.isArray(view.namespaces)) return undefined
    return view.namespaces.find(namespace => namespace !== null && typeof namespace === 'object' && namespace.ns === PI_AI_NS)
  } catch {
    return undefined
  }
}

/**
 * 客户端插件激活入口。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端根上下文。
 */
export async function apply(ctx) {
  ctx.effect(() => injectStylesOnce(), 'smilexx-model-enhancer: 注入样式')

  ctx.inject(['settingsScope', 'remote', 'remote.settings'], (scope) => {
    const controller = new ModelEnhancerController({
      readNamespace: () => readNamespace(scope.settingsScope),
      mutate: async (ns, ops, revision) => scope.remote.settings.mutate(ns, ops, revision),
    })

    let observer = undefined
    /** 提交互斥：保存监听是捕获阶段同步事件，写入异步，防重入。 */
    let committing = false

    /** 低频扫描：全量扫一遍当前文档中的展开区域。 */
    const scanAll = () => {
      try {
        const roots = document.querySelectorAll(SETTINGS_ROOT_SELECTOR)
        for (const root of roots) controller.scan(root)
      } catch { /* 锚点/结构异常时静默跳过本轮 */ }
    }

    const start = () => {
      if (observer !== undefined) return
      // 镜像可能尚未完成首次读取；ensure 只在 idle 时启动一次读取，
      // 完成后再扫（此后推送刷新由官方 mirror 订阅负责，快照始终新鲜）。
      void scope.settingsScope.describe().ensure?.().catch(() => undefined).then(() => { scanAll() })
      observer = new MutationObserver(() => { scanAll() })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    const stop = () => {
      if (observer !== undefined) {
        observer.disconnect()
        observer = undefined
      }
    }

    /**
     * 捕获阶段点击监听：官方保存成功后提交勾选；取消时丢弃。
     * 同步判定按钮语义，写入异步进行。
     */
    const onClickCapture = (event) => {
      const target = event.target instanceof Element ? event.target : undefined
      if (target === undefined) return
      const action = classifyActionButton(target)
      if (action === 'cancel') {
        controller.discardPending()
        return
      }
      if (action === 'save' && !committing) {
        // 原生保存先走完（onClick 冒泡阶段），这里捕获提前排队异步提交，
        // 用微任务让官方写操作先拿到 revision 窗口。
        committing = true
        Promise.resolve().then(async () => {
          try {
            const failure = await controller.commitPending()
            if (failure !== undefined) console.warn(`[smilexx-model-enhancer] 提交能力勾选失败：${failure}`)
          } catch (error) {
            console.warn('[smilexx-model-enhancer] 提交能力勾选异常', error)
          } finally {
            committing = false
          }
        })
      }
    }

    ctx.effect(() => {
      document.addEventListener('click', onClickCapture, true)
      start()
      return () => {
        document.removeEventListener('click', onClickCapture, true)
        stop()
        controller.dispose()
      }
    }, 'smilexx-model-enhancer: 设置页观察与保存/取消钩子')
  })
}
