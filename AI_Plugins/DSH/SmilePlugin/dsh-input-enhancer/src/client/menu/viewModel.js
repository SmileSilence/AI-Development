/**
 * 分类命令菜单的插件视图模型（纯函数，无 DOM/React/运行时对象引用）。
 *
 * 只从原生快照提取显示所需字段与原始来源/索引，形成插件自有对象；
 * 不修改、不整体复制、不序列化任何原生实时对象。
 * 每次快照（含代次）都重建索引映射：提交前以 (source, originalIndex) 校验候选
 * 仍属于当前会话与快照，过期项不可执行。
 *
 * 分类顺序（v2.1.0）：固定分类（空类隐藏）→ 插件归属分类（按行首次出现序）
 * → “其他”（三层归属都未命中的兜底，空则隐藏）。
 */
import { CATEGORIES, categoryKeyOf, OTHER_LABEL } from './categories.js'
import { capturedOwners, ownerOf } from './owners.js'

/**
 * 构建分类视图模型。
 * @param {object} snapshot - 原生控制器菜单快照。
 * @param {{ ownerResolver?: (name: string) => string | null }} [options]
 *   ownerResolver：命令名 → 插件显示名；缺省用 ownerOf + 当前运行时捕获表。
 * @returns {object} 视图模型（rows/categories/indexByKey/highlightKey/generation）。
 */
export function buildCategorizedModel(snapshot, options = {}) {
  const resolveOwner = options.ownerResolver
    ?? ((name) => ownerOf(name, { capturedOwners: capturedOwners() }))

  const items = []

  // 收集当前快照中所有就绪候选及其在各自组内的原始索引
  for (const group of snapshot.groups) {
    if (group.status !== 'ready') continue
    group.items.forEach((candidate, index) => {
      items.push({
        source: group.source,
        index,
        name: candidate.name,
        description: candidate.description,
        hint: candidate.hint,
        drill: candidate.drill === true || undefined,
      })
    })
  }

  const buckets = new Map() // categoryLabel -> rows（插入序即分类展示序）
  for (const category of CATEGORIES) buckets.set(category.label, [])
  const ownerRows = new Map() // ownerLabel -> rows
  const otherRows = []

  // 单趟分桶：固定分类名优先，未知命令按三层归属进插件分类，再退“其他”
  for (const item of items) {
    const key = categoryKeyOf(item.name)
    if (key !== null) {
      const label = CATEGORIES.find(category => category.key === key)?.label
      if (label !== undefined) {
        buckets.get(label).push({ ...item, categoryLabel: label })
        continue
      }
    }
    const owner = resolveOwner(item.name)
    if (typeof owner === 'string' && owner.length > 0) {
      if (!ownerRows.has(owner)) ownerRows.set(owner, [])
      ownerRows.get(owner).push({ ...item, categoryLabel: owner })
    } else {
      otherRows.push({ ...item, categoryLabel: OTHER_LABEL })
    }
  }

  const rows = []
  const categories = []
  for (const category of CATEGORIES) {
    const bucketRows = buckets.get(category.label)
    if (bucketRows.length === 0) continue
    categories.push({ label: category.label, count: bucketRows.length })
    rows.push(...bucketRows)
  }
  for (const [label, bucketRows] of ownerRows) {
    categories.push({ label, count: bucketRows.length })
    rows.push(...bucketRows)
  }
  if (otherRows.length > 0) {
    categories.push({ label: OTHER_LABEL, count: otherRows.length })
    rows.push(...otherRows)
  }

  // 视觉索引 → (source, originalIndex)；高亮由原生快照持有
  const rowsByVisual = rows.map((row, visualIndex) => ({ ...row, visualIndex }))
  const indexByKey = new Map()
  rowsByVisual.forEach((row) => indexByKey.set(`${row.source}:${row.index}`, row.visualIndex))
  const highlight = snapshot.highlight
  const highlightKey = highlight === null ? null : `${highlight.source}:${highlight.index}`

  return {
    /** 视觉排序的扁平行（固定分类 → 插件分类 → 其他，组内保持原始相对顺序）。 */
    rows: rowsByVisual,
    /** 分类标题行（空分类已隐藏；插件分类按行首次出现序排在固定分类之后）。 */
    categories,
    /** (source, originalIndex) → 视觉索引 的映射（随快照代次重建）。 */
    indexByKey,
    /** 原生高亮键（null 表示无高亮）。 */
    highlightKey,
    /** 快照代次：用于识别过期视图。 */
    generation: snapshot.generation,
  }
}
