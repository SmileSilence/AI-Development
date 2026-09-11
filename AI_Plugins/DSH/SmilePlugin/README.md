# SmileXX 自有 DSH 插件

本目录用于管理 SmileXX 创建和维护的 DeepSeek Harness 插件及相关工具。

## 项目索引

| 项目 | 类型 | 当前版本 | 功能 | 仓库位置 |
|------|------|----------|------|----------|
| [dsh-input-enhancer](dsh-input-enhancer/) | DSH 插件 | 2.3.1 | 输入增强：分类命令菜单 + Plan 模式按钮、实时调整方向并适配 DSH 主题 | 本目录统一管理 |
| [dsh-plugin-manager](dsh-plugin-manager/) | DSH 插件 | 0.2.2 | 插件管理：清单/安装/启用/停用/卸载、功能重复检测、Markdown 清单、CLI 与 Agent 工具 | 本目录统一管理 |
| [dsh-workspace-enhancer](dsh-workspace-enhancer/) | DSH 插件 | 0.7.4 | 右侧工作区增强：兼容其它工作区提供者、置顶、悬停统计、Windows 风格批量选择、运行状态整行动效、标签管理与筛选、会话默认模式 | 本目录统一管理 |
| [dsh-notification-manager](dsh-notification-manager/) | DSH 插件 | 1.0.1 | 通知管理：任务完成、权限请求、问题/计划确认通知，多页签去重与焦点聚合 | 本目录统一管理 |

以上项目的源码、文档和测试统一纳入 AI-Development 仓库，不保留嵌套 `.git` 目录。新增插件时，每个插件使用独立英文目录，并在本文件补充名称、版本、功能和发布状态。

> 注：ClaudeSettingsEditor 与 dsh-desktop 已移入 `AI_App/`（本仓库未纳管的应用与临时目录，不在此维护）。
