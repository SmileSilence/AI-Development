# multi-agent-bridge

`multi-agent-bridge` 是本地多 Agent 协作执行层。Codex、Claude、DSH 中任意一个都可以成为当前任务的根协调器，并通过同一组 MCP 工具把分析、实现或评审任务异步委派给另外两个 Agent。

桥接层只负责路由、隔离、状态和结果，不裁决哪个 Agent 的答案正确，也不会自动合并代码。

## 能力

- 任意主控：支持 Codex → Claude/DSH、Claude → Codex/DSH、DSH → Codex/Claude。
- 回调驱动：委派返回 `callback_id`，排队、启动、过程、提问、确认和结束事件通过当前 MCP 连接主动回传，不需要后台轮询。
- 可恢复：回调事件保存在 `%LOCALAPPDATA%\SmileXX\multi-agent-bridge\bridge.db`，连接恢复后可按 `callback_id` 补取。
- 安全隔离：分析任务使用只读能力；写入任务要求干净 Git 仓库，并创建独立 worktree 与 `multi-agent/<agent>/<task-id>` 分支。
- 原生会话：DSH 通过官方 RPC 原子创建到可见工作区；Codex 捕获持久化 thread ID；Claude 创建带名称的持久化 session ID。三端调用方向使用同一回调协议。
- 可读命名：优先复用原始项目路径对应的工作区；支持显式 `workspace_name`、`task_name`，省略时从目录名和任务首句推导。
- 防循环：拒绝同 Agent 自调用、被委派 Agent 再委派，以及来源身份与 MCP 注册身份不一致的请求。
- 默认限制：并发 3、超时 900 秒、最大超时 7200 秒、终态记录保留 30 天。

## 安装

需要 Node.js 24、pnpm、Codex CLI、Claude Code 和 DSH 的 `dsh-panel` 命令。

```powershell
Set-Location D:\Work\AI-Development\multi-agent-bridge
.\install.ps1
```

安装器会幂等完成依赖安装、TypeScript 构建、共享 Skill 同步，并把同一个 stdio MCP 注册到 Codex、Claude Code、Claude Desktop 和 DSH。Claude Desktop 配置会根据传统版或 Microsoft Store 版自动定位并合并，保留偏好设置和其他 MCP，并在覆盖前生成 `.bak` 备份。默认写入 DSH 的 `web` profile，可通过 `-DshProfile` 修改。

安装后验证：

```powershell
codex mcp get multi-agent-bridge
claude mcp get multi-agent-bridge
dsh-panel mcp test multi-agent-bridge --profile web
node .\tools\configure-claude-desktop.mjs check
```

Claude Desktop 已运行时，在“设置 → 开发者”中点击“Reload MCP Configuration”，或完全退出后重新打开。传统版配置位于 `%APPDATA%\Claude`；Microsoft Store 版位于其包虚拟化 `LocalCache\Roaming\Claude` 目录。桌面版与 Claude Code 都使用 `origin_agent=claude`，因此防循环和回调行为一致。

## 使用

安装后无需进入本目录。在任一开发项目中直接告诉当前 Agent：

```text
让 Codex 实现这个功能，同时让 Claude 只读审查现有设计，完成后汇总两边结果。
```

当前 Agent 会由 MCP 注册环境自动识别为 `origin_agent`。共享 Skill `smilexx-multi-agent-bridge` 负责判断是否需要编排、选择 `analysis` 或 `write`，以及等待并汇总结果。

MCP 提供以下工具：

| 工具 | 用途 |
|------|------|
| `list_agents` | 查看 Agent 可用性和能力 |
| `delegate_task` | 委派单个任务并返回 `task_id`、`callback_id` |
| `delegate_batch` | 并行委派多个任务 |
| `get_callback_events` | 重连后补取回调事件 |
| `respond_callback` | 回复目标 Agent 的问题或确认请求 |
| `get_task` | 查询任务状态与结果 |
| `wait_tasks` | 旧客户端兼容等待接口，不作为主流程 |
| `list_tasks` | 按工作区、来源、目标或状态查询 |
| `cancel_task` | 终止目标 Agent 进程树并保留日志 |
| `release_task` | 审查后释放 worktree，默认保留分支 |

也可以使用 CLI：

```powershell
node .\dist\cli.js agents
node .\dist\cli.js delegate --origin dsh --target codex --workspace D:\Work\Project\Demo --workspace-name "Demo" --task-name "审查架构风险" --mode analysis --prompt "审查并给出风险清单"
node .\dist\cli.js get --task <task-id>
```

## 执行规则

1. 用户直接操作的 Agent 是根协调器，委派深度为 0。
2. 被启动的 Agent 深度为 1，环境和提示都会禁止它继续委派。
3. 分析模式不应修改目标工作区；桥接层会比较 Git 状态并在发现变化时标记失败。
4. 写入模式只在独立 worktree 中执行；完成后返回分支、提交、变更文件、摘要和日志路径。
5. `release_task` 默认删除 worktree、保留任务分支；DSH 写任务还会先归档原生会话并删除桥接器创建的任务工作区注册。Gateway 不可用时会保留 worktree，等待重试。
6. 目标 Agent 需要用户输入时会回调 `question` 或 `confirmation`；当前协调器调用 `respond_callback`，回复会送回原始 DSH/Codex/Claude 会话。
7. `workspace` 始终是原始项目路径；`workspace_name` 和 `task_name` 只控制界面可见名称，不改变任务 UUID、分支或 worktree 路径。

## 回调与会话可见性

回调事件类型为 `queued`、`started`、`progress`、`question`、`confirmation`、`completed`、`failed` 和 `canceled`。MCP 会把事件作为 `notifications/message` 主动发给发起 Agent。若客户端重启或连接短暂中断，使用 `get_callback_events(callback_id, after_event_id)` 从数据库补齐，不需要常驻监控任务。

- DSH：分析任务通过当前 Gateway 按原始项目路径创建或复用工作区；写入任务为真实 worktree 路径创建“项目名 · 任务名”的独立可读工作区。会话使用 `session/create(workspaceId)` 原子归属，已打开的 DSH 可实时显示。`targetWorkspaceId`、`targetWorkspaceName`、`targetWorkspacePath`、`targetWorkspaceKind`、`targetWorkspaceCreated`、`agentSessionId` 和 `agentSessionName` 可直接定位界面条目。
- Codex：`agentSessionId` 对应持久化 Codex thread，可用 `codex exec resume <id>` 继续。
- Claude：`agentSessionId` 对应命名的持久化会话，可在 `/resume` 中查看或用 `claude --resume <id>` 继续。

## DSH 适配与诊断

`tools/dsh_*.py`、watchdog、preset patch 和会话读取工具仍是 DSH 专用适配与诊断模块，其中 `dsh_rpc_task.py` 负责可见工作区会话链路，`dsh_rpc_release.py` 负责 DSH 写任务工作区释放。运行时不读取或篡改 `workspace.json`。`VERIFY-窗口同步.md` 记录 DSH 窗口可见性检查。旧的 `inbox/outbox` 文件投递流程已废弃，`tools/delegate.sh` 仅作为统一 CLI 的兼容包装器。

## 开发与测试

```powershell
pnpm install
pnpm typecheck
pnpm test
```

测试覆盖 MCP 工具发现、六向委派、主动回调、断线补取、防循环、批量任务和 Git worktree 生命周期。

## 卸载

```powershell
.\uninstall.ps1
```

卸载器会注销三端 MCP、移除共享 Skill 和运行数据，但不会删除 Git 分支。若运行数据中仍有受管 worktree，默认保留数据并提示先调用 `release_task`；确认丢弃时才使用 `-Force`。使用 `-KeepData` 可始终保留数据库和日志。
