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

按工作区整理、比较反向导入、合并并检测或同步 Claude Code、dsh 会话到 Codex：

```powershell
# 只检测，不导入
powershell -File sync-agent-sessions.ps1 -Mode Detect -Source All

# 导入 Claude 和 dsh 的新增有效会话
powershell -File sync-agent-sessions.ps1 -Mode Import -Source All
```

参数：

- `-Mode Detect|Import`：检测或正式导入。
- `-Source All|Claude|Dsh`：选择会话来源。

脚本会自动检查 Python `zstandard` 依赖、调用 `sync-agent-sessions.py`，输出工作区、输入会话、反向差异、合并数量和候选会话统计。正式导入全部成功后会归档已被合并替代的旧 Codex 任务；成功或失败后均清理任务临时目录。详细规则见 `SESSION_SYNC.md`。
