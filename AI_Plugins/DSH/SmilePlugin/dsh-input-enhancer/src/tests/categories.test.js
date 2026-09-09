import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryKeyOf, OTHER_LABEL } from '../client/menu/categories.js'
import { buildCategorizedModel } from '../client/menu/viewModel.js'

/** 构造最小原生快照。 */
function snapshot({ groups = [], highlight = null, generation = 1, open = true } = {}) {
  return { open, hit: null, generation, groups, highlight }
}
function group(source, items, status = 'ready') {
  return { source, showGroupTitle: true, status, items }
}
function candidate(name, extra = {}) {
  return { name, ...extra }
}

describe('categoryKeyOf', () => {
  it('固定分类命令归入对应分类', () => {
    expect(categoryKeyOf('plan')).toBe('mode')
    expect(categoryKeyOf('goal')).toBe('mode')
    expect(categoryKeyOf('model')).toBe('model')
    expect(categoryKeyOf('permission')).toBe('access')
    expect(categoryKeyOf('compact')).toBe('session')
    expect(categoryKeyOf('retry')).toBe('session')
    expect(categoryKeyOf('new')).toBe('session')
    expect(categoryKeyOf('export')).toBe('session')
  })
  it('未知命令返回 null', () => {
    expect(categoryKeyOf('unknown-cmd')).toBe(null)
    expect(categoryKeyOf('')).toBe(null)
  })
  it('固定分类顺序与命名符合设计', () => {
    expect(CATEGORIES.map(c => c.key)).toEqual(['mode', 'model', 'access', 'session'])
    expect(CATEGORIES.map(c => c.label)).toEqual(['模式', '模型', '权限', '会话'])
  })
})

describe('buildCategorizedModel', () => {
  const items = [
    candidate('model', { description: '选择模型' }),
    candidate('plan', { description: '进入计划' }),
    candidate('permission', {}),
    candidate('bad', { description: '未知' }),
    candidate('compact', {}),
    candidate('goal', {}),
  ]
  const state = snapshot({ groups: [group('command', items)] })

  it('按固定分类排序，空分类隐藏，未知进其他且保留相对顺序', () => {
    const view = buildCategorizedModel(state)
    expect(view.categories.map(c => c.label)).toEqual(['模式', '模型', '权限', '会话', '其他'])
    expect(view.rows.map(r => (r.name))).toEqual(['plan', 'goal', 'model', 'permission', 'compact', 'bad'])
    expect(view.categories.find(c => c.label === '其他').count).toBe(1)
  })

  it('保留原始索引供原生 pick 路由', () => {
    const view = buildCategorizedModel(state)
    const planRow = view.rows.find(r => r.name === 'plan')
    expect(planRow.index).toBe(1) // items 中 plan 的原始索引
    expect(planRow.source).toBe('command')
    expect(view.indexByKey.get('command:1')).toBe(0) // plan 在视觉顺序第一位
    const badRow = view.rows.find(r => r.name === 'bad')
    expect(badRow.index).toBe(3)
  })

  it('pending 组不参与分类', () => {
    const state2 = snapshot({ groups: [group('command', items, 'pending')] })
    const view = buildCategorizedModel(state2)
    expect(view.rows).toHaveLength(0)
    expect(view.categories).toHaveLength(0)
  })

  it('随快照代次重建索引映射', () => {
    const v1 = buildCategorizedModel(snapshot({ groups: [group('command', [candidate('plan')])], generation: 1 }))
    const v2 = buildCategorizedModel(snapshot({ groups: [group('command', [candidate('goal')])], generation: 2 }))
    expect(v1.generation).toBe(1)
    expect(v2.generation).toBe(2)
    expect(v1.rows.map(r => r.name)).toEqual(['plan'])
    expect(v2.rows.map(r => r.name)).toEqual(['goal'])
  })

  it('高亮键与原生快照一一对应', () => {
    const state3 = snapshot({ groups: [group('command', items)], highlight: { source: 'command', index: 2 } })
    const view = buildCategorizedModel(state3)
    expect(view.highlightKey).toBe('command:2')
  })
})
describe('插件归属分类（v2.1.0）', () => {
  it('内置默认表：rewind/undo 归入 dsh-rewind-plugin 分类（无需 resolver）', () => {
    const state = snapshot({ groups: [group('command', [
      candidate('goal'),
      candidate('rewind', { description: '回退' }),
      candidate('undo'),
    ])] })
    const view = buildCategorizedModel(state)
    expect(view.categories.map(c => c.label)).toEqual(['模式', 'dsh-rewind-plugin'])
    const rewindRow = view.rows.find(r => r.name === 'rewind')
    expect(rewindRow.categoryLabel).toBe('dsh-rewind-plugin')
  })

  it('ownerResolver：未知命令按归属分插件分类，按行首次出现序排在固定分类之后', () => {
    const state = snapshot({ groups: [group('command', [
      candidate('plan'),
      candidate('alpha-cmd'),
      candidate('compact'),
      candidate('beta-cmd'),
      candidate('alpha-cmd-2'),
    ])] })
    const view = buildCategorizedModel(state, { ownerResolver: (name) => {
      if (name.startsWith('alpha')) return 'plugin-alpha'
      if (name.startsWith('beta')) return 'plugin-beta'
      return null
    } })
    expect(view.categories.map(c => c.label)).toEqual(['模式', '会话', 'plugin-alpha', 'plugin-beta'])
    expect(view.categories.find(c => c.label === 'plugin-alpha').count).toBe(2)
    // 组内保持原始相对顺序
    expect(view.rows.filter(r => r.categoryLabel === 'plugin-alpha').map(r => r.name)).toEqual(['alpha-cmd', 'alpha-cmd-2'])
  })

  it('归属失败（null）的未知命令仍进其他', () => {
    const state = snapshot({ groups: [group('command', [candidate('mystery')])] })
    const view = buildCategorizedModel(state, { ownerResolver: () => null })
    expect(view.categories.map(c => c.label)).toEqual(['其他'])
  })

  it('固定分类名优先：owner 映射不影响已知命令', () => {
    const state = snapshot({ groups: [group('command', [candidate('plan')])] })
    const view = buildCategorizedModel(state, { ownerResolver: () => 'rogue-plugin' })
    expect(view.categories.map(c => c.label)).toEqual(['模式'])
    expect(view.rows[0].categoryLabel).toBe('模式')
  })

  it('indexByKey 与高亮键不受分类重排影响', () => {
    const state = snapshot({
      groups: [
        group('command', [candidate('rewind')]),
        group('other-source', [candidate('client-tool')]),
      ],
      highlight: { source: 'other-source', index: 0 },
    })
    const view = buildCategorizedModel(state)
    // 视觉顺序：dsh-rewind-plugin(rewind) → 其他(client-tool)
    expect(view.indexByKey.get('command:0')).toBe(0)
    expect(view.indexByKey.get('other-source:0')).toBe(1)
    expect(view.highlightKey).toBe('other-source:0')
  })
})