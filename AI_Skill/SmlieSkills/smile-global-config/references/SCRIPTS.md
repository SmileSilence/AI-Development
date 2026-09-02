# Anget管理 — 辅助脚本说明

## new-task-dir.ps1
创建任务临时目录：`%USERPROFILE%\Downloads\anget-tmp\<任务名>`

```powershell
powershell -File new-task-dir.ps1 -TaskName <任务名>
```

## cleanup-task-dir.ps1
删除任务临时目录（递归、强制）并确认结果。

```powershell
powershell -File cleanup-task-dir.ps1 -TaskName <任务名>
```

> 安全说明：脚本只删除 `%USERPROFILE%\Downloads\anget-tmp\` 下的指定子目录；`-TaskName` 为空或含路径穿越（`..`）时拒绝执行。

## sync-agent-sessions.ps1

按「通用规则 + 分 Agent 规则」整理会话并同步到指定目标 Agent：

```powershell
# 只检测，不导入（默认目标 Codex）
powershell -File sync-agent-sessions.ps1 -Mode Detect -Source All

# 导入 Claude 和 dsh 的新增有效会话到 Codex
powershell -File sync-agent-sessions.ps1 -Mode Import -Source All

# 检测 Codex 会话，整理后交给 dsh 目标
powershell -File sync-agent-sessions.ps1 -Mode Detect -Source Codex -Target Dsh
```

参数：

- `-Mode Detect|Import`：检测或正式导入。
- `-Source All|Codex|Claude|Dsh`：选择会话来源。
- `-Target Codex|Dsh|Claude`：同步目标 Agent（默认 `Codex`；非 Codex 目标只输出整理结果，由执行方按 `AGENT_RULES.md` 分 Agent 规则落地）。

脚本会自动检查 Python `zstandard` 依赖、调用 `sync-agent-sessions.py`，输出工作区、输入会话、反向差异、合并数量和候选会话统计。最后修改不足 60 秒的活跃源会话会暂时跳过。正式导入全部成功后会归档已被合并替代的旧任务及同源旧版本；若原生导入复用当前目标任务 ID，则直接更新并排除归档。成功或失败后均清理任务临时目录。详细规则见 `AGENT_RULES.md` 与 `SESSION_SYNC.md`。
