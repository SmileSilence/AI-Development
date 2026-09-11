# Changelog

## 0.4.1（2026-09-11）

技能 / MCP 页签内部布局改为**单列列表行**（经典设置列表风格，与用户提供的布局参考图一致）：

- **技能列表**：双列网格卡片 → 单列列表行。每行 = 圆形描边图标 + 技能名（粗体）+ 单行描述（超长省略号截断）+ 右侧作用域标签（全局/工作区）+ 最右侧启停开关；点击行打开详情弹窗（不变）。
- **MCP 列表**：双列网格卡片 → 单列列表行。每行 = 圆形描边图标 + 服务器名 + 单行摘要（transport 徽标 / 状态 / 工具数）+ 右侧操作（编辑 / 测试 / 删除 / 启停开关）；点击行打开详情弹窗（不变）。
- **行交互**：整行可点击打开详情（`role="button"`，Enter/Space 触发），行内开关与操作按钮 `stopPropagation` 不误触；hover 背景统一 `--dsw-alias-interactive-bg-hover`。
- **树形文件夹**：适配单列布局（`grid-column` 移除）。
- 新增字典键 `noDescription`（技能无描述时的占位文案，zh/en）。
- 功能零改动：启停、删除、添加、迁移/分组、搜索、类型筛选、树形折叠、拖放、测试连接全部保留。

## 0.4.0（2026-09-11）

设置入口合并 + 原生 DSH 详情弹窗：

- **页签化**：「技能」「MCP」从两个独立设置入口（`settings.section` ×2）改为挂在官方「插件」设置入口下的两个页签（`settings.plugins.tab`，技能 order 1 / MCP order 2），官方「插件配置」页签及其他页签不受影响。
- **技能详情弹窗**：点击技能卡片弹出 DSH 原生 `Modal`（`@deepseek-ai/dsh-client-ui-primitives`）——标题、描述、来源/作用域信息行、启停开关、可滚动 SKILL.md 正文、删除（二次确认）/关闭；遮罩与 Escape 关闭。
- **MCP 详情弹窗**：点击 MCP 卡片弹出原生 `Modal`——状态摘要、配置键值（transport/命令|地址/参数/工作目录/环境变量键/请求头键/超时/自动重连）、已发现工具、测试/删除/编辑/关闭。
- **移除导航图标补丁**：不再有独立「技能」「MCP」导航项，删除 `MutationObserver` 图标补丁与 `cssIcon`/`cssIconMcp`。
- **UI 统一**：弹窗全部复用 DSH `dsw-alias-*` 配色变量与原生 Modal 遮罩/圆角，视觉与基座一致。
- **行为不变**：技能/MCP 列表、启停、添加/迁移/分组、MCP patch 管理逻辑均未改动；数据零迁移。

## 0.3.0（2026-09-12）

改名 `dsh-plugin-manager` → `smilexx-skill-mcp-manager`，**移除整个插件管理模块**：

- **删除插件管理**：插件清单 / 安装 / 启用 / 停用 / 卸载 / 功能重复 / Markdown 清单 / 异常处理全部移除；`dsh-panel plugin` 子命令、`dpm_*` Agent 工具、`settings.plugins.tab` 注册随之删除。插件管理改由 dshmarket / `dsh plugin` 命令承担。
- **只保留 skill + mcp**：设置页改注册 `settings.section` ×2（技能 order 16 / MCP order 16.5），与基座 dsh-skill-mcp-panel 一致。
- **改名**：包名、`cordis.patch.yml` insert id/name、Typert package/typeSymbol、CLI 文案、LocalStorage 前缀统一为 `smilexx-skill-mcp-manager`。
- **版本检查**：本地分发（file: tgz）无远端发布源，`fetchUpdateCheck()` 短路返回「无更新」，CLI update / UI 横幅不误报。
- **依赖精简**：移除 `@deepseek-ai/dsh-tools`（仅插件管理 tools.ts 使用）。
- 兼容性：MCP 受管块标记（`dsh-skill-mcp-panel:mcp:begin/end`）保持不变，既有 MCP 配置数据无需迁移。

## 0.2.2（2026-09-07）

- 修复：DSH 后端 2026-09-05 起将 `remove` 列为网关命名空间保留方法名（RemoteNamespaceService 内部卸载方法），pluginsViewer/remove 挂载被拒导致设置页四个标签全部失效；将 wire 方法更名为 pluginsViewer/removePlugin（与 installPlugin 对称），宿主与客户端 manifest 同步。

## 0.2.1（2026-09-04）

- 统一宿主/客户端 Typert package 与 typeSymbol 为 dsh-plugin-manager，消除旧身份残留和远程命名冲突。
- 插件管理 Tab 文案统一为「插件管理」；技能与 MCP 保持在插件管理 Tab 内的右侧子页签。
- 重建并重装后需强制刷新浏览器客户端包。

## 0.2.0（2026-09-04）

以 dsh-skill-mcp-panel v2.0.2 为基座重构为统一 dsh-plugin-manager：

- **新增插件管理**：插件清单 / 安装 / 启用 / 停用 / 卸载 / 功能重复检测 / Markdown 清单 / 结构化异常处理（不携带旧 dpm 的历史与回滚功能）。
- **修复**：卸载后 `dsh.profile.bundles` 残留清理与结果校验；启用/停用特殊字符 rowId 转义与状态统一；插件列表不再显示悬挂声明（折叠分组 + 清理动作）。
- **Skill 面板改造**：去掉工作区/分组横向滚动栏，改为按 `metadata.category` 类型下拉筛选（缺失回退 rel 顶层目录），行内保留作用域徽标。
- **插件管理界面**：设置 → 插件 → 「插件管理」Tab（settings.plugins.tab，order 20）；清单/搜索/类别分组折叠/悬挂声明折叠/异常项动作，安装对话框（spec + 重复处理策略 + 决策展示），功能重复 Tab，Markdown 清单复制；全部走 pluginsViewer 远程服务。
- **插件命令行**：`dsh-panel plugin` 子命令（list / install / enable / disable / remove / report / duplicates / anomalies / anomaly-action），与设置页共用 scan/service/patch 逻辑。
- **Agent 工具**：`dpm_list / dpm_install / dpm_enable / dpm_disable / dpm_remove / dpm_report / dpm_duplicates / dpm_anomaly_action`。
- **测试**：新增 `test-plugin.mjs`（扫描/补丁/异常/报告/重复，临时 profile）与 `test-skill-category.mjs`（metadata 元数据解析与条目传播）；基座 13 个测试全部通过。
- **MCP 面板**：保留基座实现（cordis.patch.yml 受管块、Stdio/HTTP、启停/删除/测试、env/headers 脱敏、HMR）。
- **集成**：设置页注册 settings.plugins.tab（插件管理）+ settings.section（技能 order 16 / MCP order 16.5）；替代 dsh-skill-mcp-panel。
