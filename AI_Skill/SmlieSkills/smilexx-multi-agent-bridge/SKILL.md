---
name: smilexx-multi-agent-bridge
description: 跨 Agent 委派与并行协作；当用户要求 Codex、Claude、DSH 互相调用、并行评审、交叉验证或隔离开发时使用。
metadata:
  publisher: SmileXX
  version: "v1.4"
  short-description: 多 Agent 双向委派与协作
  category: AI工具
  platforms: [DSH, Claude Code, Claude Desktop, OpenAI/Codex]
  keywords: [agent, delegation, orchestration, mcp, codex, claude, dsh]
---

# Multi-Agent Bridge

通过 `multi-agent-bridge` MCP，让 Codex、Claude、DSH 任意一方成为当前任务的协调器，并把任务异步委派给其他 Agent。

## 触发条件

- 用户要求其他 Agent 处理、评审、验证或实现任务。
- 用户要求多个 Agent 并行分析、交叉验证或分别给出方案。
- 用户明确说“让 Codex / Claude / DSH 做……”“多 Agent 协作”“并行评审”。

简单任务、当前 Agent 可直接完成且用户未要求外部协作时不触发。

## 工作流程

1. 调用 `list_agents`，确认目标 Agent 可用。
2. 当前平台身份由 MCP 注册环境自动识别；不要伪造 `origin_agent`。
3. 单任务调用 `delegate_task`；独立任务可调用 `delegate_batch` 并行分发。优先把用户语境中的项目名传为 `workspace_name`、实际任务名传为 `task_name`；无法确定时才省略并使用自动推导。
4. 分析、审查、方案任务使用 `mode: analysis`；需要改代码时使用 `mode: write`。
5. 写入模式只适用于干净的 Git 工作区，并在独立 worktree/分支执行。
6. 记录委派结果中的 `callback_id`，通过 MCP 主动通知接收 `progress`、`question`、`confirmation` 和终态事件；不要创建轮询或后台监控任务。
7. 收到 `question` 或 `confirmation` 时，根据用户当前指示调用 `respond_callback`；不能代替用户决定的事项必须直接询问用户。
8. MCP 重连后调用 `get_callback_events` 补取缺失事件；`wait_tasks` 仅兼容旧客户端，不作为新流程。
9. 用 `get_task` 读取 `agentSessionId`、摘要、分支和测试结果；需要时据此打开或恢复目标 Agent 的原生会话。
10. 协调器负责审查和汇总；不得自动合并外部 Agent 的分支。
11. 确认不再需要 worktree 后调用 `release_task`，默认保留分支。DSH 写任务会同时归档原生会话并删除桥接器创建的任务工作区注册；释放失败时向用户报告并保留 worktree 以便重试。
12. `workspace` 必须传原始项目路径，不能传任务 worktree。DSH 分析任务进入原项目工作区；DSH 写任务进入由桥接层创建的“项目名 · 任务名”独立 worktree 工作区。

## 强制约束

- 被委派 Agent 不得继续委派，禁止递归调用和 Agent 循环。
- `origin_agent` 与 `target_agent` 不得相同。
- 不并行安排可能修改相同文件的写入任务。
- 不把外部 Agent 的输出直接视为最终结论，必须由当前协调器复核。
- 分析任务不得修改项目；写入任务不得绕过受管 worktree。
- 所有调用方向都必须保留目标 Agent 原生会话 ID，并把执行过程回调给发起 Agent。
- 不得把 `workspace.json` 当作 DSH 运行时状态源，也不得用会话排序接口跨路径挂载会话。

工具参数、示例和错误处理见 `references/USAGE.md`。
