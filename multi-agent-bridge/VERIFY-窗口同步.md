# 多 Agent 回调与会话可见性验证

## MCP 接入验证

安装后执行：

```powershell
dsh-panel mcp list --profile web
dsh-panel mcp test multi-agent-bridge --profile web
```

配置应包含 stdio 服务 `multi-agent-bridge`、Node.js 服务入口和 `MAB_ORIGIN_AGENT=dsh`。网关在线时配置会热加载；网关离线时，重新启动 DSH 后生效。

## Codex 委派 DSH 的验证结果

桥接层始终通过当前 Gateway 幂等调用 `workspace/create(path)` 获取实时工作区投影，不把 `workspace.json` 当作运行时状态源。分析任务以原始项目路径创建或复用工作区；写入任务以隔离 worktree 路径创建“项目名 · 任务名”的独立可读工作区。两者都通过 `session/create(workspaceId)` 原子创建并归属会话，再调用 `session/rename` 设置任务名。

DSH 桌面端已打开时，工作区和会话归属由 Gateway 发布到 `workspace/follow`，侧栏应立即出现或更新，不需要退出重开。分析任务位于原项目工作区；写入任务位于独立可读任务工作区。

## 委派会话验证

DSH 通过 MCP 委派 Codex 或 Claude 时，任务状态保存在 `%LOCALAPPDATA%\SmileXX\multi-agent-bridge\bridge.db`。DSH 自身作为目标 Agent 时，桥接层通过官方 RPC 在对应工作区创建可见会话，原始会话仍由 DSH 管理。

若委派会话未立即出现在 DSH 桌面端，应视为任务故障并检查：

1. 确认任务的 `get_task` 状态、`targetWorkspaceId`、`targetWorkspaceName`、`agentSessionId`、`agentSessionName` 与日志路径。
2. 检查 `~/.dsh/sessions/` 中是否生成对应会话。
3. 检查 Gateway `127.0.0.1:3080` 是否在线，以及任务错误中是否包含工作区投影验证失败。

桥接层不会直接修改 DSH 的原始会话文件或 `workspace.json`。

已有的 UUID 工作区、失败任务和未分组会话不会自动迁移或删除；本版本只修复后续委派。DSH 写任务调用 `release_task` 时，仅删除记录为桥接器创建且类型为 `worktree` 的工作区注册。

## Codex 与 Claude 会话验证

每次 `delegate_task` 都返回 `callbackId`；随后应在发起 Agent 中收到 `queued`、`started`、`progress` 和终态事件。`get_task` 的 `agentSessionId` 用于定位目标端原生会话：

- Codex 任务输出持久化 thread ID，可执行 `codex exec resume <agentSessionId>` 验证。
- Claude 任务预先创建命名 session ID，可在 Claude `/resume` 中查看，或执行 `claude --resume <agentSessionId>` 验证。
- DSH session ID 对应侧栏工作区中的会话；分析任务在原项目工作区，写任务在独立可读 worktree 工作区。

目标 Agent 回调 `question` 或 `confirmation` 后，发起 Agent 应调用 `respond_callback`。桥接层会把回答发送回同一个原生会话，不创建无关的新会话。
