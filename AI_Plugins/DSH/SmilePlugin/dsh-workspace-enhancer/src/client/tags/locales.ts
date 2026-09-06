/**
 * dsh-workspace-tagger — 标签文案字典（独立命名空间 workspace-tagger）。
 *
 * 文案即合约：zh 为键集真源，en 同步完整；行菜单/弹窗/设置页共用。
 * 侧栏浏览器自身的文案（rename/delete/search…）沿用 shipped ui-workspace 的
 * 'workspace' 命名空间（fork 消费，不重复注册）。
 */

/** 标签命名空间键集（注册进 LocaleNamespaceMap 的联合类型）。 */
export type TaggerKey =
  | 'menu.setTag'
  | 'menu.workspaceTag'
  | 'menu.sessionTag'
  | 'dialog.workspaceTitle'
  | 'dialog.sessionTitle'
  | 'dialog.noTag'
  | 'dialog.label'
  | 'dialog.color'
  | 'dialog.cancel'
  | 'dialog.confirm'
  | 'dialog.delete'
  | 'dialog.add'
  | 'dialog.addPlaceholder'
  | 'dialog.nameEmpty'
  | 'dialog.nameDuplicate'
  | 'dialog.edit'
  | 'dialog.deleteTitle'
  | 'dialog.deleteBody'
  | 'dialog.deleteOk'
  | 'dialog.deleteCancel'
  | 'dialog.usedBy'
  | 'dialog.unavailable'
  | 'picker.title'
  | 'picker.presets'
  | 'picker.custom'
  | 'picker.saveCustom'
  | 'picker.saved'
  | 'picker.hex'
  | 'picker.red'
  | 'picker.green'
  | 'picker.blue'
  | 'picker.hue'
  | 'settings.tab'
  | 'settings.stats'
  | 'settings.runningTag'
  | 'settings.runningTagHint'
  | 'settings.none'
  | 'settings.splitRatio'
  | 'settings.splitRatioHint'
  | 'settings.edit'
  | 'settings.delete'
  | 'settings.unavailable'
  | 'settings.loading'
  | 'settings.tagList'
  | 'settings.emptyTags'
  | 'settings.tagUsage'
  | 'settings.previewSession'
  | 'error.saveFailed'
  // —— v0.4.0：标题栏筛选按钮 + 多条件面板 ——
  | 'filter.title'
  | 'filter.empty'
  | 'filter.addRule'
  | 'filter.removeRule'
  | 'filter.clearAll'
  | 'filter.filtered'
  | 'filter.allTags'
  | 'filter.tagsCount'
  | 'filter.conditionInclude'
  | 'filter.conditionExclude'
  | 'filter.conditionEquals'
  | 'filter.scopeAll'
  | 'filter.scopeWorkspace'
  | 'filter.scopeSession'

/** zh 字典（真源）。 */
export const zh: Record<TaggerKey, string> = {
  'menu.setTag': '设置标签',
  'menu.workspaceTag': '设置工作区标签',
  'menu.sessionTag': '设置会话标签',
  'dialog.workspaceTitle': '设置工作区标签',
  'dialog.sessionTitle': '设置会话标签',
  'dialog.noTag': '无标签',
  'dialog.label': '标签',
  'dialog.color': '颜色',
  'dialog.cancel': '取消',
  'dialog.confirm': '确定',
  'dialog.delete': '删除',
  'dialog.add': '增加',
  'dialog.addPlaceholder': '新标签名称',
  'dialog.nameEmpty': '标签名称不能为空',
  'dialog.nameDuplicate': '该标签名称已存在',
  'dialog.edit': '编辑',
  'dialog.deleteTitle': '删除标签',
  'dialog.deleteBody': '确定删除标签「{name}」吗？',
  'dialog.deleteOk': '确认删除',
  'dialog.deleteCancel': '取消',
  'dialog.usedBy': '已分配给 {workspaces} 个工作区、{sessions} 个会话，将一并清除',
  'dialog.unavailable': '标签设置当前不可用，请稍后重试',
  'picker.title': '选择颜色',
  'picker.presets': '预设',
  'picker.custom': '自定义',
  'picker.saveCustom': '保存为自定义预设',
  'picker.saved': '已保存',
  'picker.hex': 'Hex',
  'picker.red': 'R',
  'picker.green': 'G',
  'picker.blue': 'B',
  'picker.hue': 'H',
  'settings.tab': '标签管理',
  'settings.stats': '当前共 {total} 个标签 · 已用于 {workspaces} 个工作区 · {sessions} 个会话',
  'settings.runningTag': '运行会话标签',
  'settings.runningTagHint': '运行中的会话统一使用该标签的颜色；其所在工作区折叠时，工作区行也显示该颜色。',
  'settings.none': '无',
  'settings.splitRatio': '双色胶囊比例',
  'settings.splitRatioHint': '前段（工作区色）占比：{ratio}%',
  'settings.edit': '编辑',
  'settings.delete': '删除',
  'settings.unavailable': '标签设置不可用（设置服务未加载或处于内存模式）',
  'settings.loading': '加载中…',
  'settings.tagList': '标签列表',
  'settings.emptyTags': '还没有标签，点击上方「增加」创建。',
  'settings.tagUsage': '工作区 {workspaces} · 会话 {sessions}',
  'settings.previewSession': '会话',
  'error.saveFailed': '保存失败：{error}',
  // —— v0.4.0：标题栏筛选按钮 + 多条件面板 ——
  'filter.title': '筛选',
  'filter.empty': '暂无筛选条件，点击下方「添加条件」开始',
  'filter.addRule': '添加条件',
  'filter.removeRule': '删除该条件',
  'filter.clearAll': '清除全部',
  'filter.filtered': '已筛选 {n} 项',
  'filter.allTags': '全部标签',
  'filter.tagsCount': '{n} 个标签',
  'filter.conditionInclude': '包含',
  'filter.conditionExclude': '不包含',
  'filter.conditionEquals': '等于',
  'filter.scopeAll': '全部',
  'filter.scopeWorkspace': '工作区',
  'filter.scopeSession': '会话',
}

/** en 字典（与 zh 键集同步完整）。 */
export const en: Record<TaggerKey, string> = {
  'menu.setTag': 'Set tag',
  'menu.workspaceTag': 'Set workspace tag',
  'menu.sessionTag': 'Set session tag',
  'dialog.workspaceTitle': 'Set workspace tag',
  'dialog.sessionTitle': 'Set session tag',
  'dialog.noTag': 'No tag',
  'dialog.label': 'Tag',
  'dialog.color': 'Color',
  'dialog.cancel': 'Cancel',
  'dialog.confirm': 'Confirm',
  'dialog.delete': 'Delete',
  'dialog.add': 'Add',
  'dialog.addPlaceholder': 'New tag name',
  'dialog.nameEmpty': 'Tag name must not be empty',
  'dialog.nameDuplicate': 'A tag with this name already exists',
  'dialog.edit': 'Edit',
  'dialog.deleteTitle': 'Delete tag',
  'dialog.deleteBody': 'Delete tag "{name}"?',
  'dialog.deleteOk': 'Delete',
  'dialog.deleteCancel': 'Cancel',
  'dialog.usedBy': 'It is used by {workspaces} workspace(s) and {sessions} session(s), which will be cleared too',
  'dialog.unavailable': 'Tag settings are currently unavailable; please try again later',
  'picker.title': 'Pick a color',
  'picker.presets': 'Presets',
  'picker.custom': 'Custom',
  'picker.saveCustom': 'Save as custom preset',
  'picker.saved': 'Saved',
  'picker.hex': 'Hex',
  'picker.red': 'R',
  'picker.green': 'G',
  'picker.blue': 'B',
  'picker.hue': 'H',
  'settings.tab': 'Tags',
  'settings.stats': '{total} tag(s) · used by {workspaces} workspace(s) · {sessions} session(s)',
  'settings.runningTag': 'Running session tag',
  'settings.runningTagHint': "Running sessions use this tag's color; when their workspace is collapsed, the workspace row shows it too.",
  'settings.none': 'None',
  'settings.splitRatio': 'Dual-color pill ratio',
  'settings.splitRatioHint': 'Front (workspace color) share: {ratio}%',
  'settings.edit': 'Edit',
  'settings.delete': 'Delete',
  'settings.unavailable': 'Tag settings unavailable (settings service not loaded or in memory mode)',
  'settings.loading': 'Loading…',
  'settings.tagList': 'Tag list',
  'settings.emptyTags': 'No tags yet. Use "Add" above to create one.',
  'settings.tagUsage': '{workspaces} workspace(s) · {sessions} session(s)',
  'settings.previewSession': 'Session',
  'error.saveFailed': 'Save failed: {error}',
  // —— v0.4.0：标题栏筛选按钮 + 多条件面板 ——
  'filter.title': 'Filter',
  'filter.empty': 'No filter conditions yet — click “Add condition” below.',
  'filter.addRule': 'Add condition',
  'filter.removeRule': 'Remove condition',
  'filter.clearAll': 'Clear all',
  'filter.filtered': '{n} item(s) filtered',
  'filter.allTags': 'All tags',
  'filter.tagsCount': '{n} tag(s)',
  'filter.conditionInclude': 'Contains',
  'filter.conditionExclude': 'Not contains',
  'filter.conditionEquals': 'Equals',
  'filter.scopeAll': 'All',
  'filter.scopeWorkspace': 'Workspaces',
  'filter.scopeSession': 'Sessions',
}
