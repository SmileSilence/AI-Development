---
name: anget-manager
description: 管理本机所有 AI Agent（anget，含 DSH/Codex/Claude/Gemini 等）的启动、临时文件和会话同步流程。支持将 Claude Code、dsh 及反向导入会话按工作区整理、比较差异、合并重复或分支内容并同步到 Codex。Agent 产生的脚本和临时文件统一放入 Downloads\anget-tmp 的任务子目录，完成后自动清理。当用户要求启动/使用/管理 Agent、整理/合并/同步 Claude 或 dsh 会话、或要求清理临时文件时激活。
metadata:
  version: "v4"
  short-description: 管理 Agent 启动、反向会话合并同步与临时文件
  category: Agent 管理
---

# Anget管理（Agent 管理）

管理本机所有 AI 代理（anget = agent，包括 DSH、Codex、Claude Code、Gemini CLI 等）的启动、使用与会话同步。本技能同时提供文件卫生规则，以及 Claude/dsh/反向导入会话按工作区整理、差异合并后同步到 Codex 的工具。

---

## 一、触发条件

### 激活场景
- 用户说「启动 codex / claude / dsh / gemini」「用 anget 做 XXX」「anget 管理」
- 用户要求运行某个 agent 执行任务（编码、审查、查询等）
- 用户说「同步会话」「整理会话」「合并重复会话」「合并反向导入」「导入 Claude 会话」「导入 dsh 会话」
- 用户提到「脚本放下载文件夹」「临时文件清理」「用完删除」

### 不触发（避免误用）
- 创建 dsh 插件 / 其他技能 → 不激活本技能
- 用户仅在当前 DSH 会话内直接对话（本技能只管"启动外部 agent"或"文件卫生规范"）

---

## 二、功能

1. **启动与管理本机 agent**：根据用户指定，用对应命令启动 codex / claude / dsh / gemini 等工具。
2. **强制临时目录规范**：任何 agent 产生的脚本/临时文件，统一写入：
   `%USERPROFILE%\Downloads\anget-tmp\<任务名>\`（下载文件夹下的 `anget-tmp` 子目录）。
3. **自动清理**：任务使用完成后，agent 必须自己删除该任务的临时目录及其内容（`Remove-Item -Recurse -Force`），并确认删除成功。
4. **异常兜底**：任务失败/中断时同样执行清理；清理不依赖用户提醒。
5. **工作区整理**：将会话目录规范化到最近的 Git 仓库根目录；非 Git 目录保留规范化后的原工作目录。
6. **同内容合并**：同一工作区内，角色顺序和正文完全一致的会话只生成一个规范会话，并保留全部来源记录；已导入的同内容会话直接复用。
7. **反向导入合并**：读取 dsh `import-*` 中的 Codex 来源标记，区分完全一致、子集、扩展和分叉；扩展或分叉按对话轮次合并双方独有内容。
8. **会话同步**：将整理后的 Claude Code 与 dsh 有效主会话交给 Codex 原生检测器并同步。
9. **替代归档**：只有合并替代会话全部导入成功后，才归档对应旧 Codex 任务；失败时保留旧任务。
10. **同步保护**：不修改源会话；自动排除子代理和空会话；导入后核验并清理暂存目录。

---

## 三、使用方法

### 3.1 启动 agent

| Agent | 启动命令 | 说明 |
|-------|----------|------|
| DSH | 打开 Web GUI `http://127.0.0.1:3080`（当前环境） | 会话数据在 `%USERPROFILE%\.dsh` |
| Codex | `codex`（交互）或 `codex exec <提示>`（非交互） | 已装于 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` |
| Claude Code | `claude`（交互）或 `claude -p <提示>`（非交互） | npm 全局安装，`claude.ps1` |
| Gemini CLI | `gemini` | 配置目录 `%USERPROFILE%\.gemini` |

### 3.2 文件卫生规则（必须遵守）

1. **建临时目录**：开始任何 agent 任务前，先创建：
   ```powershell
   New-Item -ItemType Directory -Path "$env:USERPROFILE\Downloads\anget-tmp\<任务名>" -Force
   ```
   `<任务名>` 用简短英文 kebab-case，如 `codex-review-api`、`claude-fix-bug`。
2. **产物入下载目录**：agent 执行中生成的一切脚本（.ps1/.py/.sh/.js 等）、临时文件、中间产物、可执行文件，一律写到上述临时目录；**禁止**散落写入工作目录、项目目录或系统目录。
3. **工作目录隔离**：运行 agent 时优先把其工作目录（cwd）指到临时目录，或把输出重定向到临时目录。
4. **使用完自动删除**：任务完成（成功/失败/中断）后立即执行：
   ```powershell
   Remove-Item -Recurse -Force "$env:USERPROFILE\Downloads\anget-tmp\<任务名>"
   Test-Path "$env:USERPROFILE\Downloads\anget-tmp\<任务名>"   # 应返回 False，确认已删
   ```
5. **保留例外**：用户明确要求保留的成果（如最终交付脚本），先询问放置位置或移到用户指定目录，并告知用户；仍不得留在临时目录。

### 3.3 可选脚本

`scripts/` 目录提供辅助脚本（见 `references/` 说明）。

### 3.4 会话同步

先运行检测模式：

```powershell
powershell -File scripts/sync-agent-sessions.ps1 -Mode Detect -Source All
```

用户明确要求同步或导入后，运行导入模式：

```powershell
powershell -File scripts/sync-agent-sessions.ps1 -Mode Import -Source All
```

`-Source` 支持 `All`、`Claude`、`Dsh`。同步规则、格式映射和验证要求见 `references/SESSION_SYNC.md`。

同步实现约束：

1. 先解析 Claude 与 dsh，再按规范化工作区和会话内容指纹整理。
2. 只合并同一工作区内角色顺序与正文完全一致的会话；不同工作区或仅部分相似的会话保持独立。
3. 反向导入比较时忽略机器注入的环境、权限、技能和中断标记，但原始内容保持只读完整。
4. 完全一致或属于原 Codex 会话子集的反向会话直接复用；扩展或分叉会话生成保留双方独有轮次的替代会话。
5. 先读取 Codex 外部导入登记；内容未变化的旧会话直接复用，避免技能升级后再次导入。
6. 整理结果转换为 Claude 兼容 JSONL，再交给 Codex 原生检测器。
7. 只将检测器返回的 `SESSIONS` 传给导入接口，禁止直接写 Codex SQLite 数据库。
8. 只有全部替代会话导入成功，才调用 `thread/archive` 归档对应旧任务；归档可恢复。
9. 无论检测、导入或异常退出，都必须删除 `Downloads\anget-tmp\session-sync` 和本次创建的 `Agent-Import` 暂存目录。
10. `Agent-Import` 只能短暂位于 `.claude\projects`，必须带安全标记，且不得包含用户原始文件。

---

## 四、配置说明

- 临时目录根：`%USERPROFILE%\Downloads\anget-tmp\`
- 下载文件夹：`%USERPROFILE%\Downloads`（默认存在）
- 各 agent 的配置/会话数据目录（`~\.codex`、`~\.claude`、`~\.dsh`、`~\.gemini`）**不属于临时产物，不得删除**。
- 会话同步临时目录：`%USERPROFILE%\Downloads\anget-tmp\session-sync\`
- 规范会话暂存目录：`%USERPROFILE%\.claude\projects\Agent-Import\`（同步结束必须删除）

---

## 五、注意事项

1. **只删自己的临时目录**：`Remove-Item` 前必须核对完整路径，禁止删除下载文件夹下其他内容或用户文件。
2. **不污染工作目录**：脚本/中间文件绝不落到 `D:\Work\AI-Development` 等正常工作区。
3. **失败也要清理**：任务异常中断时，agent 同样执行删除，不留垃圾。
4. **保留需显式确认**：只有用户明确说"保留"，才移动产物到指定位置，并明确告知最终路径。
5. **遵守平台边界**：本技能只负责"启动外部 agent + 文件卫生"，不代理外部 agent 的内部权限决策。
6. **原始会话只读**：不得修改或删除 `.claude\projects`、`.dsh\sessions`、`.codex\sessions` 内的原始会话。
7. **先检测后导入**：未被 Codex 原生检测器返回的会话不得强制写入。
8. **版本兼容**：Codex App Server 属于高级接口；接口不兼容时停止并改用官方“设置 → 导入”或 `/import`。

---

## 六、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-28 | v4 | 新增反向导入来源追踪、差异分类、对话轮次合并及成功后归档旧任务 |
| 2026-08-28 | v3 | 新增按工作区归类、Git 根目录规范化、同内容会话合并和来源追踪 |
| 2026-08-28 | v2 | 新增 Claude/dsh → Codex 会话检测、去重、转换、导入、验证与清理功能 |
| 2026-08-27 | v1 | 初始版本：Agent 启动规范 + 脚本/临时文件放下载文件夹、用完自动删除 |
