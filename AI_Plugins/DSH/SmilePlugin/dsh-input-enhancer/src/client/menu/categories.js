/**
 * 命令分类固定映射（产物基于目标 DSH 提交的原生命令目录）。
 * 组顺序固定；组内按原生候选顺序排列；未知命令归入“其他”。
 */

/** 固定分类表：key 用于键盘导航索引，label 为界面文字。 */
export const CATEGORIES = [
  { key: 'mode', label: '模式', names: ['plan', 'goal'] },
  { key: 'model', label: '模型', names: ['model'] },
  { key: 'access', label: '权限', names: ['permission'] },
  { key: 'session', label: '会话', names: ['compact', 'retry', 'clear', 'new', 'fork', 'export'] },
].map((category) => Object.freeze({ ...category, names: Object.freeze([...category.names]) }))

/** 未知命令的兜底分组标题。 */
export const OTHER_LABEL = '其他'

/** 命名查找表：命令名 → 分类 key（历史兼容，勿改命令名）。 */
const NAME_TO_KEY = new Map()
for (const category of CATEGORIES) {
  for (const name of category.names) NAME_TO_KEY.set(name, category.key)
}

/** 获取命令所属分类 key；未知命令返回 null。 */
export function categoryKeyOf(name) {
  return NAME_TO_KEY.get(name) ?? null
}
