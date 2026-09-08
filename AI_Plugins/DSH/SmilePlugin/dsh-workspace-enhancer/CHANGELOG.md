# Changelog

## 0.5.0

### 筛选条件补全为飞书式 7 种操作符（任务：filter-v3）
- `TagFilterCondition` 从 3 种扩展为 7 种：`equals` 等于、`notEquals` 不等于、`contains` 包含（=包含任一）、`notContains` 不包含、`containsAll` 包含全部、`isEmpty` 为空、`isNotEmpty` 不为空。
- 操作符与标签选择语义：
  - `equals` / `notEquals` 单选：标签菜单单选，选新标签替换旧标签（不追加）。
  - `contains` / `notContains` 多选 OR：命中任一选中标签即匹配；`notContains` 对无标签行匹配为 true（不等于任一选中）。
  - `containsAll` 多选 AND：生效标签是单个，须同时等于每个选中 → 单选集等价 equals，多选集恒不匹配（合理语义，见实现注释）。
  - `isEmpty` / `isNotEmpty` 无值：忽略 tagIds，不渲染标签选择；按行有无标签匹配。
- `tagFilterMatches` 重写：7 种操作符各自匹配（含无标签/有标签）；语义约定 `notEquals`/`notContains` 对无标签行匹配 true。
- 新增 `migrateRuleCondition` 纯函数：切换操作符时状态迁移（多选→单选截断第一个；有值→无值清空 tagIds），FilterButton 与单测共用。
- 新增 `isNoValueCondition` / `isSingleSelectCondition` / `tagFilterRuleActive` 辅助函数；`isTagFilterInactive` 改为按「规则是否具备筛选内容」判定（无值操作符即使未选标签也视为生效）。
- `FilterButton.tsx`：操作符下拉扩到 7 项；无值操作符隐藏标签选择（行内只显示 [范围][操作符][删除]）；单选/多选切换走 `migrateRuleCondition`。
- 标签下拉移除「无标签」哨兵选项（TAG_FILTER_NO_TAG）：无标签筛选统一由 `isEmpty` / `isNotEmpty` 操作符表达。
- locales：条件文案扩到 7 项（中英文各一套），`conditionInclude`/`conditionExclude` 改名为 `conditionContains`/`conditionNotContains` 并清理旧键。
- 单元测试重写：7 种操作符匹配、单选/多选/无值行为、操作符切换状态迁移、多条件 AND 组合、isEmpty/isNotEmpty 范围过滤。

### 其他
- 版本 0.4.0 → 0.5.0。

## 0.4.0

### 筛选器改造（任务 A：标题栏筛选按钮 + 多条件行面板）
- 移除常驻独立一行 `TagFilterBar`；改为标题栏右侧「筛选」图标按钮（仅宽侧栏显示，rail 窄侧栏保持现状），筛选生效时按钮高亮 + 角标。
- 点击按钮弹出筛选面板（portal 定位，点击外部 / Esc 关闭），飞书多维表格式：多条件行、行间 AND、每行独立选择范围（全部/工作区/会话）与条件（包含/不包含/等于），标签支持多选（等于时单选）；可添加/删除条件行、清除全部；面板显示当前筛选命中总数「已筛选 N 项」。
- 面板打开时回显当前生效筛选，修改实时生效；筛选状态仍为浏览器本地、不持久化。

### 数据结构与纯函数（tree.ts）
- `TagFilter` 改为 `{ enabled, rules: readonly TagFilterRule[] }`；新增 `TagFilterRule { id, scope, condition, tagIds }`。
- `tagFilterMatches` 入参改为单条规则；新增 `applyTagFilterToGroups` 多规则 AND：工作区行须通过所有 workspace/all 规则，会话行须通过所有 session/all 规则，任一适用规则淘汰即隐藏；`isTagFilterInactive` 改为空规则 / 全空标签判定。

### 搜索按钮布局修复（任务 B）
- `.headerActions` 移除 `margin-left: auto`、间距 8px → 4px，搜索框与其它图标按钮回到同一组紧挨；`.searchSlot` 保留 `flex:1 + margin-left:auto` 承担右侧推挤。

### 其他
- 新增筛选面板单元测试 12 项（多规则 AND、范围隔离、运行标签覆盖折叠），`npm test` 共 41 项通过。
- 版本 0.3.0 → 0.4.0。

## 0.3.0

### 标签弹窗优化（任务 A）
- `TagDialog` 改为单个下拉菜单：无标签 + 全部普通标签（运行中标签 `runningTagId` 不出现，仅在设置页「标签管理」配置）。
- 改名/删除/改色只针对下拉框当前选中的普通标签；当前选中若为运行中标签/已被删除，弹窗归一化为「无标签」。

### 运行标签增强（任务 B）
- 折叠工作区显示「运行标签名×N」（运行中会话计数；仅折叠态工作区行显示，展开后只由各运行中会话显示运行标签）。
- 运行中会话自动置顶：分组视图组内排前（按最近更新）、单列视图排最前；结束后还原。
- 有运行中会话的工作区自动置顶到最上层（高于手动置顶）；结束后还原。
- 标签筛选器：位于工作区标题栏下方、第一个工作区上方；支持多标签 + 条件（包含/不包含/等于）+ 范围（全部/工作区/会话），按生效标签过滤工作区与会话行；含清除按钮，状态不持久化。
- `GroupNode` 新增 `runningSessionCount`；新增 `tagFilterMatches` / `applyTagFilterToGroups` 纯函数。

### 其他
- 新增单元测试 17 项（运行自动置顶 + 标签筛选），`npm test` 共 38 项通过。
- 版本 0.2.2 → 0.3.0。

## 0.2.2

### 调整
- 工作区标签移动到工作区名称左侧，布局顺序为“文件夹/展开图标 → 标签 → 名称”。
- 会话标签移动到会话名称左侧，布局顺序为“状态 → 标签 → 名称”；搜索结果保持相同顺序。

## 0.2.1

### 修复
- 标签管理设置页为每个既有标签增加“颜色”入口，可展开颜色选择器并确认持久化。
- 保持行内标签弹窗 `TagDialog` 的颜色选择器可用，并增加验证守卫，防止颜色区被误隐藏或移除。
- 新增标签仍使用默认颜色；创建后可在标签管理页或 `TagDialog` 中修改。

## 0.2.0

### 集成 dsh-workspace-tagger（标签子系统）
- 将独立插件 dsh-workspace-tagger 的功能整体集成进本插件：工作区/会话标签、双色胶囊、行内微着色、运行标签、颜色选择器、标签管理设置页。
- 数据命名空间沿用 `workspace-tagger`（兼容既有标签数据），Host 半部注册 settings schema，Client 经 settingsScope 镜像读写。
- 配置开关：cordis.patch.yml `config.tags.enabled`（默认开）。关闭时不注册 schema，标签 UI 进入不可用态。
- 新增依赖：`@deepseek-ai/dsh-client-ui-settings`（settingsScope）、`@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery`。

### UI 修改（v2 轮）
- 默认模式选择器改用「新会话中输入框上方模式选择」的 seat 样式（AgentPresetSeat 风格：pill、transparent、hover 高亮）；收缩右边栏时只显示模式图标。
- 批量操作按钮改用工作区按钮同风格图标（IconChecklistOutline14），不再用文字。
- 工作区标题栏图标以工作区右边为锚点向右推（headerActions margin-left:auto + gap 8），不再挤在一起。
- 标签管理新增标签时不可设置/修改颜色（新增固定默认色，颜色区在新增模式下隐藏）。
- 批量操作 v3：点击批量图标弹出菜单（批量操作工作区 / 批量操作会话），选中后对应类型行出现勾选框；工具条（统计 + 确认 + 取消）位于工作区标题下方。

### 修复
- Host 半部 `Invalid effect`：settings 注册改用 `ctx.inject(['settings'], cb)`（settings.register 返回 void，不能包进 ctx.effect）。

## 0.1.0


DSH 右侧工作区增强的首次发布，覆盖需求 1–6 全部功能。

### 置顶（需求 1）
- 工作区与会话置顶：每行左侧快捷「置顶」按钮（`aria-pressed` 状态）、`···` 菜单项、右键菜单三入口。
- 置顶状态持久化在浏览器 viewing store（`dsh-workspace-enhancer:view.v1`），分组视图置顶工作区置顶排序优先、单列视图置顶会话优先。

### 悬停信息卡 + 打开目录（需求 2、3）
- 悬停工作区行显示 Codex 式信息卡：图标、名称、完整路径（POSIX home 归约 `~`）、会话数、创建时间。
- 卡片内「打开工作区」按钮 + 工作区 `···` 菜单「打开工作区」：经 Host `POST /workspace-enhancer/open-directory` 在系统文件管理器打开目录；非桌面环境降级为路径文本 + 复制。

### 右键菜单（需求 3、4）
- 工作区/会话行右键打开与 `···` 一致的菜单（置顶 / 打开工作区 / 重命名 / 新建会话 / 删除工作区；会话：置顶 / 重命名 / 分叉会话 / 归档会话）。
- 列表空白区右键：新建工作区 / 新会话。

### 批量归档与删除（需求 5）
- 视图选项菜单「批量操作」进入批量模式：行首出现勾选框。
- 底部工具条显示已选计数、「归档会话 (n)」「删除工作区 (n)」「退出批量」。
- 批量删除工作区：确认弹窗诚实声明「会话先归档、数据保留在磁盘、不可撤销」；执行=先归档全部会话再删除工作区注册（DSH 无会话删除 API，采用归档语义，避免未分组孤儿）。

### 会话默认模式选择器（需求 6）
- 侧栏视图选项旁的「默认模式」按钮，列出 Agent preset 名册（标准/PTC/极简/创造模式等）。
- 选中即写 `settings agent-presets.default`（仅 default，绝不触碰 `agentPresets.select`）；新会话按新默认组合。
- Agent presets 服务未挂载时优雅降级（显示「未设置（跟随系统）」）。

### 技术说明
- 独立 locale 命名空间 `workspace-enhancer`（避免与官方 `workspace` NS 冲突）。
- `sidebar.workspaces` single slot 由本插件接管（`priority: -100`），`cordis.patch.yml` 同时禁用 `ui-workspace` 与 `ui-workspace-archive-manager`。
- 门禁链 `npm run check`（typecheck + vitest + build + 版本 pin + pack dry-run）；单元测试 10 项、浏览器 e2e 通过。
