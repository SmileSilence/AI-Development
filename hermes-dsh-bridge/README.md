# Hermes ⇄ DSH ⇄ Codex ⇄ Claude 四方协作桥

让 Hermes（主控）、DSH（DeepSeek Harness）、Codex（OpenAI）、Claude（Anthropic）
四个 AI 代理互相委派任务、互相读取对方会话历史的协作框架。

## DSH 任务正确流程（4 步）

DSH 创建任务的标准流程，和你在桌面端操作一样：

```
1. 选择/添加工作区  →  2. 选择任务模式  →  3. 输入任务  →  4. 发出任务
```

### 交互式向导（推荐）
```bash
PY="/c/Users/19163/AppData/Local/Microsoft/WindowsApps/python3"
"$PY" D:/Work/AI-Development/hermes-dsh-bridge/tools/dsh_flow.py interactive
```

### 非交互
```bash
# 1. 列出工作区
"$PY" tools/dsh_flow.py list-workspaces
# 1. 添加工作区（幂等，不会重复创建）
"$PY" tools/dsh_flow.py add-workspace --path "D:\\Work\\项目"
# 2+3+4. 选模式 + 输入任务 + 发出（会话带模式，实时出现在 DSH 窗口）
"$PY" tools/dsh_flow.py run --workspace <工作区ID> --preset standard --text "任务内容"
```

### 任务模式
| 模式 | 说明 |
|------|------|
| `standard` | 标准（默认）|
| `ptc` | PTC |
| `minimal` | 极简 |
| `cordis` | 创造 |

### 一键执行 + 等结果
```bash
bash tools/dsh_task.sh "任务内容" [模式] [工作区ID]
```

## 参与者

| 代理 | 身份 | 会话存储 | 委派方式 |
|------|------|---------|---------|
| **Hermes** | 主控/协调者 | `C:\Users\19163\AppData\Local\hermes\state.db` (SQLite) | 我是主控 |
| **DSH** | 子代理 | `~/.dsh/sessions/**/session.v2.jsonl.zstd` (zstd JSONL) | 官方 RPC（实时可见）|
| **Codex** | 子代理 | `~/.codex/sessions/**/*.jsonl` | `codex exec`（需额度）|
| **Claude** | 子代理 | `~/.claude/projects/**/*.jsonl` | `claude -p` |

## 关键机制

- **DSH 实时可见**：通过官方 RPC（`session/create` + `session/prompt`）创建的会话，
  天生带 `agentPreset`（模式）并自动挂到工作区，**桌面端窗口实时显示，无需重启**。
- **认证**：自签 HMAC cookie（secret 在 `~/.dsh/.credentials.yaml`），脚本 `tools/dsh_cookie.py`
- **会话互读**：DSH 会话 zstd JSONL、Hermes 会话 SQLite、Codex/Claude jsonl

## 目录结构

```
hermes-dsh-bridge/
├── inbox/<agent>/      # 给某代理的任务
├── outbox/<agent>/     # 某代理执行的结果
├── shared/             # 任务文件、DELEGATE.md、hermes-export.jsonl
├── tools/
│   ├── dsh_flow.py     # ★ 4步流程工具（list/add-workspace, run, interactive）
│   ├── dsh_task.sh     # 一键任务+等结果
│   ├── dsh_rpc.py      # 底层 RPC 客户端
│   ├── dsh_cookie.py   # 自签认证 cookie
│   ├── dsh_new_session.py  # 分步创建会话
│   ├── read_dsh_sessions.py  # 读 DSH 会话
│   └── export-hermes-sessions.py  # 导出 Hermes 会话
└── VERIFY-窗口同步.md  # 同步验证文档
```

## 协作规则

1. **Hermes 是主控**：接收用户需求、拆解、分发、汇总
2. **谁接谁负责**：接收方完成后写结果到 `outbox/<对方>/<task-id>.md`
3. **会话互读只读不写**：不修改对方会话文件（尤其 DSH 的 zstd 文件）
4. **DSH 用正确流程**：永远用官方 RPC，不要手改会话文件
