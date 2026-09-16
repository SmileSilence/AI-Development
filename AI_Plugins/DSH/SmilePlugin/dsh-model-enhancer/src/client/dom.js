/**
 * 官方模型设置页的 DOM 锚点定位。
 *
 * 锚点依据 ui-settings-models 源码（DSH 0.1.6-alpha.1）：
 * - CSS Modules 生产 pattern 为 `[hash]_[local]`，本地名保留，可用
 *   `[class*="_<local>"]` 部分匹配：modelEntry / modelRow / modelAdvanced；
 * - 展开按钮 `aria-label` 为 `容量 N`（zh）或 `Capacities N`（en），
 *   `aria-expanded` 标记状态；
 * - 行首模型 id 输入框 `aria-label` 为 `模型 ID N` / `Model ID N`，
 *   但直接取行内第一个文本输入框（DOM 顺序固定）比匹配 locale 更稳；
 * - provider 卡头 `[class*="_editorRoute"]` 文本即路由 id（displayName
 *   与路由不同时才渲染，故兜底从卡头 `_editorTitle` 读取）。
 *
 * 任一锚点失效时全部查询返回空/undefined，注入层据此静默跳过。
 */

/** 展开按钮 aria-label 前缀（中英双语）。 */
const ADVANCED_LABELS = ['容量', 'Capacities']

/** provider 编辑卡头（路由 id / 显示名所在卡）。 */
const EDITOR_CLASS = '_editor'
/** 卡头标题本地名。 */
const EDITOR_TITLE_CLASS = '_editorTitle'
/** 卡头路由 id 本地名。 */
const EDITOR_ROUTE_CLASS = '_editorRoute'

/**
 * 元素类名列表是否含指定本地名后缀（匹配 `[hash]_[local]` 或本地名本身）。
 * @param {Element} element - 待测元素。
 * @param {string} local - CSS Modules 本地名。
 * @returns {boolean} 是否命中。
 */
function hasLocalClass(element, local) {
  if (typeof element.className !== 'string') return false
  return element.className.split(/\s+/).some(name => name === local || name.endsWith(`_${local}`) || name.endsWith(`-${local}`))
}

/**
 * 判断按钮是否为模型行展开按钮（aria-label 前缀 + aria-expanded 存在）。
 * @param {Element} element - 待测元素。
 * @returns {boolean} 是否命中。
 */
function isAdvancedToggle(element) {
  if (!(element instanceof HTMLButtonElement)) return false
  if (element.getAttribute('aria-expanded') === null) return false
  const label = element.getAttribute('aria-label') ?? ''
  return ADVANCED_LABELS.some(prefix => label.startsWith(prefix))
}

/**
 * 向上找最近的 provider 编辑卡（含 `_editor` 类或 modelEntry 容器共同祖先）。
 * @param {Element} element - 起点元素。
 * @returns {Element | undefined} 卡根元素。
 */
function closestEditorCard(element) {
  let node = element
  while (node !== null && node !== undefined && node instanceof Element) {
    if (hasLocalClass(node, 'editor') || hasLocalClass(node, 'addBlock')) return node
    node = node.parentElement
  }
  return undefined
}

/**
 * 从 provider 编辑卡读取路由 id：优先 `_editorRoute` 文本（displayName 与
 * 路由不同时渲染）；否则 `_editorTitle` 文本（相同时只渲染标题，标题即路由）。
 * @param {Element} card - provider 编辑卡根。
 * @returns {string | undefined} 路由 id。
 */
export function providerIdOfCard(card) {
  if (card === undefined || card === null) return undefined
  for (const local of [EDITOR_ROUTE_CLASS, EDITOR_TITLE_CLASS]) {
    const node = [...card.querySelectorAll(`[class*="${local}"]`)].find(
      candidate => candidate.textContent !== undefined && candidate.textContent.trim().length > 0,
    )
    if (node !== undefined) return node.textContent.trim()
  }
  return undefined
}

/**
 * 读取一个模型行（modelEntry）的当前模型 id：行内第一个文本输入框
 * （DOM 顺序固定为 id → name → 展开 → 删除）。
 * @param {Element} entry - 模型行根。
 * @returns {string} 模型 id（未填时为空串）。
 */
export function modelIdOfEntry(entry) {
  const input = entry.querySelector('input[type="text"]')
  return input !== null && typeof input.value === 'string' ? input.value.trim() : ''
}

/**
 * 查询一个展开区域对应的模型行根（modelEntry）。
 * @param {Element} advanced - 展开区域元素。
 * @returns {Element | undefined} 模型行根。
 */
export function entryOfAdvanced(advanced) {
  let node = advanced.parentElement
  while (node !== null && node !== undefined && node instanceof Element) {
    if (hasLocalClass(node, 'modelEntry')) return node
    node = node.parentElement
  }
  return undefined
}

/**
 * 查询 provider 编辑卡内全部展开区域。
 * @param {Element} card - provider 编辑卡根。
 * @returns {Element[]} 展开区域列表。
 */
export function advancedAreasOfCard(card) {
  return [...card.querySelectorAll('[class*="_modelAdvanced"]')]
}

/**
 * 判断展开区域是否已被本插件处理过（已含注入节点）。
 * @param {Element} advanced - 展开区域元素。
 * @returns {boolean} 是否已注入。
 */
export function isInjected(advanced) {
  return advanced.querySelector('.smilexx-model-enhancer-capability') !== null
}

/**
 * 判断模型行当前是否声明了图片输入。声明值只看用户层数组中该模型条目的
 * `input` 字段（调用方负责从命名空间视图传入）。
 * @param {Array<object> | undefined} models - 用户层 models 数组。
 * @param {string} modelId - 模型 id。
 * @returns {boolean} 勾选状态。
 */
export function declaredImageInput(models, modelId) {
  if (!Array.isArray(models) || modelId.length === 0) return false
  const entry = models.find(model => model !== null && typeof model === 'object' && model.id === modelId)
  return entry !== undefined && Array.isArray(entry.input) && entry.input.includes('image')
}

/**
 * 在展开区域内创建能力勾选节点（复选框 + 标签 + 知识库提示）。
 * @param {object} options - 初始状态与回调。
 * @param {boolean} options.checked - 初始勾选。
 * @param {string} options.hint - 知识库提示文案。
 * @param {string} options.hintVerdict - 提示结论（multimodal/text-only/unknown）。
 * @param {(checked: boolean) => void} options.onChange - 勾选变化回调。
 * @returns {HTMLDivElement} 可插入的容器。
 */
export function createCapabilityNode({ checked, hint, hintVerdict, onChange }) {
  const container = document.createElement('div')
  container.className = 'smilexx-model-enhancer-capability'

  const row = document.createElement('div')
  row.className = 'smilexx-model-enhancer-capability-row'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'smilexx-model-enhancer-checkbox'
  checkbox.checked = checked
  checkbox.setAttribute('aria-label', '图片输入')

  const label = document.createElement('label')
  label.className = 'smilexx-model-enhancer-label'
  label.textContent = '图片输入'

  const hintNode = document.createElement('span')
  hintNode.className = `smilexx-model-enhancer-hint smilexx-model-enhancer-hint-${hintVerdict}`
  hintNode.textContent = hint

  const emit = (next) => {
    checkbox.checked = next
    onChange(next)
  }
  checkbox.addEventListener('change', () => { emit(checkbox.checked) })
  label.addEventListener('click', (event) => {
    // 拦下默认行为自己翻转：label 默认点击会再派发一次 change，双写回调。
    event.preventDefault()
    emit(!checkbox.checked)
  })

  row.append(checkbox, label, hintNode)
  container.append(row)
  return container
}

/**
 * 读取注入容器的复选框状态。
 * @param {Element} container - 注入容器。
 * @returns {boolean | undefined} 复选框状态；容器异常时 undefined。
 */
export function checkedOf(container) {
  const checkbox = container.querySelector('input[type="checkbox"]')
  return checkbox !== null ? checkbox.checked : undefined
}
