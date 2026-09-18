# Multi-Agent Bridge 使用说明

Claude Code 与 Claude Desktop 都以 `origin_agent=claude` 接入。桌面版从传统 Roaming 目录或 Microsoft Store 包虚拟化目录加载 MCP；修改配置后需在开发者设置中重新加载 MCP，或重启 Claude Desktop。

## 常用调用

### 单个分析任务

调用 `delegate_task`：

```json
{
  "target_agent": "claude",
  "workspace": "D:\\Work\\Project\\example",
  "workspace_name": "example",
  "task_name": "审查架构风险",
  "prompt": "审查当前架构并列出高风险问题",
  "mode": "analysis"
}
```

### 并行任务

调用 `delegate_batch`，每个任务必须彼此独立。MCP 最多同时执行 3 个任务，超出部分保持排队。

### 写入任务

`mode: write` 要求目标是干净的 Git 仓库。结果返回：

- `branch`：`multi-agent/<agent>/<task-id>` 格式的任务分支。
- `worktree`：隔离工作目录。
- `commitHash`：任务产生的提交。
- `changedFiles`：相对仓库根目录的变更文件。

协调器审查后自行合并；桥接服务不会自动合并。

`workspace` 始终传原始项目路径。`workspace_name`、`task_name` 可省略：前者默认取目录名，后者默认取任务首个有效句子。显式工作区名会应用到已有 DSH 工作区；自动推导不会覆盖已有自定义标题。写入任务的 worktree 路径由桥接层管理，不应由调用方传入。

DSH 分析任务会进入原项目工作区。由于 DSH 强制要求会话 `cwd` 与工作区路径一致，DSH 写任务会进入名称为“项目名 · 任务名”的独立 worktree 工作区；这仍保留 Git 隔离，并能在已打开的 DSH 中实时显示。

## 状态与错误

任务状态为 `queued`、`running`、`succeeded`、`failed`、`canceled`。

- `delegate_task` 和 `delegate_batch` 返回 `callbackId`；主流程通过 MCP `notifications/message` 接收主动回调。
- 回调类型包括 `queued`、`started`、`progress`、`question`、`confirmation`、`completed`、`failed`、`canceled`。
- 目标 Agent 提问或请求确认时调用 `respond_callback`，回答会送回 `agentSessionId` 对应的原生会话。
- 回调和任务结果包含目标工作区及会话的 ID、可见名称、路径、类型和创建来源，便于协调器引导用户打开对应原生会话。
- 断线重连后使用 `get_callback_events` 和最后收到的事件 ID 补取，不创建后台轮询任务。
- `wait_tasks` 单次最多等待 60 秒，仅供旧客户端兼容；超时不代表任务失败。
- `cancel_task` 会终止 Agent 进程树，但保留日志和 worktree。
- `release_task` 只接受已结束任务；`keep_branch` 默认为 `true`。DSH 写任务会先归档会话并删除桥接器创建的 worktree 工作区注册；Gateway 离线时保留 worktree 并允许重试。
- 脏工作区、非 Git 写入、同 Agent 委派、递归委派和循环委派都会被拒绝。

## 协调示例

- DSH 主控：分别委派 Codex 实现、Claude 审查，然后由 DSH 汇总。
- Codex 主控：委派 DSH 验证运行环境、Claude 做独立代码审查。
- Claude 主控：委派 Codex 编写隔离分支、DSH 检查 DSH 专属协议。
