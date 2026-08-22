---
name: mode-manager
description: 管理 AI Agent 的工作模式：从 mode-state.json 读取并显示当前模式，在 6 种预定义模式（架构、编码、调试、多模式协调、分析、提问）之间切换并持久化，随后按新模式执行。支持 Codex、Claude、DeepSeek Harness、MiMo Code 等多种 Agent。当用户询问"当前模式""现在是什么模式"，或说"切换到X模式""切到编码/调试/分析""进入架构模式"时使用。
metadata:
  version: "v1"
---

# 模式管理（mode-manager）

模式定义见 `D:\Work\Config\AI-Development\modes-unified\modes.json`（单一事实来源）。

## 触发条件

- 用户说「当前模式」「现在是什么模式」
- 用户说「切换到X模式」「切到编码/调试/分析」
- 用户说「进入架构模式」
- 消息以 /mode 开头

## 支持的 Agent

| Agent | 配置路径 | 状态 |
|---|---|---|
| Codex | `~/.codex/` | ✅ 支持 |
| Claude | `~/.claude/` | ✅ 支持 |
| DeepSeek Harness | `~/.deepseek/` | ✅ 支持 |
| MiMo Code | `~/.mimo/` | ✅ 支持 |

## Agent 检测

根据当前运行的 Agent 自动选择配置路径：
- **Codex**: 读取 `~/.codex/mode-state.json`
- **Claude**: 读取 `~/.claude/mode-state.json`
- **DeepSeek Harness**: 读取 `~/.deepseek/mode-state.json`
- **MiMo Code**: 读取 `~/.mimo/mode-state.json`

## 可用模式

| 中文名 | ID | 简易描述 |
|---|---|---|
| 架构 | architecture | 负责系统总体设计与技术选型 |
| 编码 | coding | 负责代码实现与修改 |
| 调试 | debugging | 负责问题定位与诊断 |
| 多模式协调 | multi-mode-coordination | 负责复杂任务分解与子代理协调 |
| 分析 | analysis | 负责数据分析与根因分析 |
| 提问 | general-qa | 负责通用问答与知识讲解 |

## 执行流程

1. **检测当前 Agent**：根据运行环境确定配置路径
2. **读取模式状态**：从对应 Agent 的 `mode-state.json` 读取
3. **显示当前模式**：输出 `当前模式：<中文名> ｜ 当前模型：<model> ｜ 当前思考深度：<effort>`
4. **切换模式**：
   - 将用户输入与中文名/ID/别名匹配
   - 更新对应 Agent 的 `mode-state.json`（mode_id / mode_name）
   - 确认切换成功，并简述该模式的用途
5. 切换后本会话按新模式执行

## 模式规则

- 非编码模式禁止修改源代码
- 代码写入/修改一律委派给编码模式子代理
- 多模式协调完成后切回协调模式
- 模型选择自由，不再强制绑定

## 模式别名

| 用户输入 | 匹配模式 |
|---|---|
| 架构/architecture | 架构 |
| 编码/coding | 编码 |
| 调试/debugging | 调试 |
| 协调/多模式协调/coordination | 多模式协调 |
| 分析/analysis | 分析 |
| 提问/qa/general-qa | 提问 |

## 注意事项

- 每个 Agent 有独立的 `mode-state.json`
- 模式定义共享 `modes.json`
- 每个回复开头显示当前模式信息
- 模型由用户通过 `/model` 自由选择
- 显示时使用中文名（label 字段）

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-22 | v1 | 初始版本 |



