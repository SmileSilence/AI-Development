# Changelog

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
