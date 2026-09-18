# 通用 Agent 交接说明

本文件保留给旧脚本和人工诊断使用。正式委派统一通过 `multi-agent-bridge` MCP，不再依赖 `inbox/outbox` 文件轮询，也不指定固定主控。

每个委派任务至少包含：

- `origin_agent`：本次根协调器。
- `target_agent`：实际执行者，不能与来源相同。
- `workspace`：目标项目绝对路径。
- `mode`：`analysis` 或 `write`。
- `root_task_id`、`delegation_depth`、调用链：由桥接层记录并用于防循环。

被委派 Agent 只能完成当前任务，不得再次调用多 Agent 桥。分析任务不得修改工作区；写入任务只能修改桥接层提供的独立 worktree。执行结果由根协调器审查与汇总，禁止自动合并其他 Agent 分支或修改其他 Agent 的原始会话文件。

