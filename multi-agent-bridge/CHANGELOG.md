# 更新记录

## [1.4.0] - 2026-09-18

### Added

- 任务和回调新增目标工作区路径、`logical`/`worktree` 类型及是否由桥接器创建的元数据。
- DSH 写任务释放时先归档原生会话并删除桥接器创建的工作区注册，再移除 Git worktree。

### Fixed

- DSH 会话改为通过当前 Gateway 的 `workspace/create` 与 `session/create(workspaceId)` 原子归属，已打开的桌面端可实时收到工作区投影更新。
- 分析任务进入原项目工作区；写入任务进入名称为“项目名 · 任务名”的独立 worktree 工作区，不再错误调用排序接口添加会话。
- Gateway 离线或 DSH 清理失败时保留 worktree，避免产生不可恢复的半释放状态。

## [1.3.0] - 2026-09-17

### Added

- `delegate_task`、批量委派和 CLI 新增可选 `workspace_name`、`task_name` 可读名称。
- 任务记录与回调新增目标工作区、会话 ID 和可见名称元数据。

### Fixed

- DSH 委派初步加入按原始项目路径复用与可读名称支持；1.4.0 进一步修正了写任务的领域约束与原子归属。
- DSH、Claude 和 Codex 的可见会话标题优先使用项目名和实际任务名。

## [1.2.0] - 2026-09-17

### Added

- 新增 Claude Desktop MCP 配置安装、检查和卸载工具。
- 安装时合并 `claude_desktop_config.json` 并保留其他 MCP；修改已有配置前生成 `.bak` 备份。
- 新增 Microsoft Store 版 Claude Desktop 配置回归测试。
- 自动识别 Microsoft Store 包虚拟化配置目录，避免写入桌面应用不读取的普通 Roaming 目录。

### Changed

- 一键安装和卸载现在同时覆盖 Codex、Claude Code、Claude Desktop 与 DSH。

## [1.1.0] - 2026-09-17

### Added

- 新增 `callback_id`、持久化回调事件、MCP 主动通知，以及 `get_callback_events`、`respond_callback` 工具。
- 新增 Codex thread ID、Claude session ID 和 DSH session ID 的统一记录与进度回调。
- 新增问题、确认、过程、完成、失败和取消事件；回复会路由回目标 Agent 的原始会话。

### Changed

- MCP 执行路径改为连接内回调驱动，取消和超时通过进程事件与 `AbortSignal` 处理，不再依赖状态轮询。
- `wait_tasks` 仅作为旧客户端兼容接口保留。

## [1.0.0] - 2026-09-17

### Added

- 新增基于 Node.js 24、TypeScript 和 stdio 的 `multi-agent-bridge` MCP 服务。
- 新增 Codex、Claude、DSH 双向委派适配器，以及异步批量、查询、等待、取消和释放接口。
- 新增 SQLite 任务持久化、并发限制、超时、日志和 30 天终态记录保留策略。
- 新增分析任务只读约束，以及写入任务独立 Git worktree 和任务分支隔离。
- 新增三端用户级安装、卸载脚本和 `smilexx-multi-agent-bridge` 共享 Skill。

### Fixed

- 修复 DSH 委派只使用 headless CLI、任务执行成功但不会出现在桌面端工作区的问题；改为官方 RPC 工作区挂载、会话队列和完成监控。
- 修复 Windows Python 子进程返回中文摘要时的系统代码页乱码问题。

### Changed

- `delegate.sh` 调整为统一 CLI 的兼容入口。
- DSH RPC、会话读取和 watchdog 保留为 DSH 专用诊断与适配工具。

### Deprecated

- `inbox`、`outbox` 文件投递协议和固定主控语义停止作为主流程使用。
