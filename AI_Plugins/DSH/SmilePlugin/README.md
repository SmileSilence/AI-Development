# SmileXX 自有 DSH 插件

本目录用于管理 SmileXX 创建和维护的 DeepSeek Harness 插件及相关工具。

## 项目索引

| 项目 | 类型 | 当前版本 | 功能 | 仓库位置 |
|------|------|----------|------|----------|
| [dsh-input-enhancer](dsh-input-enhancer/) | DSH 插件 | 2.3.1 | 输入增强：分类命令菜单 + Plan 模式按钮、实时调整方向并适配 DSH 主题 | 本目录统一管理 |
| [dsh-plugin-manager](dsh-plugin-manager/) | DSH 插件 | 0.2.2 | 插件管理：清单/安装/启用/停用/卸载、功能重复检测、Markdown 清单、CLI 与 Agent 工具 | 本目录统一管理 |
| [dsh-workspace-enhancer](dsh-workspace-enhancer/) | DSH 插件 | 0.6.0 | 右侧工作区增强：工作区/会话置顶、悬停 Codex 式信息卡、右键菜单、批量归档/删除、会话默认模式选择器、标签（管理 + 多条件筛选面板，7 种操作符）、一键折叠/展开所有工作区 | 本目录统一管理 |

以上项目的源码、文档和测试统一纳入 AI-Development 仓库，不保留嵌套 `.git` 目录。新增插件时，每个插件使用独立英文目录，并在本文件补充名称、版本、功能和发布状态。

> 注：ClaudeSettingsEditor 与 dsh-desktop 已移入 `AI_App/`（本仓库未纳管的应用与临时目录，不在此维护）。
