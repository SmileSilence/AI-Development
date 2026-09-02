# Agent 会话同步规则（通用 + 分 Agent）

会话同步遵循「**通用规则统一、分 Agent 规则特化**」的架构：

1. 所有 Agent 共享一套通用规则（工作区整理、去重、防抖、只读、清理）。
2. 每个 Agent 只声明自己的**特殊部分**：数据位置、日志格式、消息抽取、过滤规则、格式映射、反向来源追踪、目标写入方式。
3. 新增 Agent 时，只需在下方「分 Agent 规则」补一行/一节，**其余部分继承通用规则**，不改动共享逻辑。
4. 同步方向不再是单一固定：任何 Agent 既可以是**源**，也可以是**目标**。源 → 目标由用户指定（如 `Claude → Codex`、`Codex → DSH`、`Claude+DSH → Codex`、`All → DSH`）。

---

## 一、通用规则（所有 Agent 共享）

| # | 规则 | 说明 |
|---|------|------|
| G1 | 源会话只读 | 任何 Agent 的原始会话文件（`.claude\projects`、`.dsh\sessions`、`.codex\sessions`）不得修改或删除；只读加载后生成规范会话。 |
| G2 | 工作区整理 | 读取会话 `cwd`，向上找最近 `.git` 仓库根作为工作区；非 Git 路径保留规范化后的原工作目录。Windows 路径比较忽略大小写、统一分隔符。 |
| G3 | 同内容合并 | 仅在同一工作区内合并：指纹 = 消息角色顺序 + 正文（忽略换行差异、行尾空格、首尾空行）；完全一致才折叠；不做模糊合并。 |
| G4 | 活跃会话防抖 | 最后修改不足 60 秒的源会话视为仍在写入，本轮跳过（报告 `active`）；稳定满 60 秒后才进入比较。 |
| G5 | 子代理与空会话排除 | 含子代理标记（`subagent/descriptor` / `isSidechain`）或无可提取用户消息的会话排除。 |
| G6 | 先检测后导入 | 目标 Agent 有原生检测器时，只导入检测器返回的 `SESSIONS`；禁止绕过目标边界直接写其数据库。 |
| G7 | 暂存目录安全 | 规范会话暂存目录必须带技能生成的安全标记；存在无标记同名目录时立即停止，禁止覆盖。 |
| G8 | 版本链收敛 | 同一来源内容更新后复用稳定暂存路径；目标原生导入复用当前任务 ID 时直接更新该任务，只有产生不同任务 ID 才在整批成功后归档旧版本。 |
| G9 | 归档纪律 | 只有全部替代会话导入成功才归档对应旧任务/旧版本；导入失败、数量不一致或归档失败时保留旧任务并单独报告。 |
| G10 | 全程清理 | 无论检测、导入或异常退出，都删除任务临时目录（`Downloads\anget-tmp\session-sync`）和本次创建的暂存目录。 |
| G11 | 核验 | 导入后核对请求数 = 成功数 + 失败数，源文件数量同步前后不变，并抽查至少一个长会话的消息顺序。 |

## 二、分 Agent 规则（只写特殊部分）

### A. Claude Code

| 项 | 规则 |
|----|------|
| 数据位置 | `%USERPROFILE%\.claude\projects\**\*.jsonl`（排除 `subagents\` 子目录和 `Agent-Import` 暂存目录） |
| 日志格式 | JSONL，`type ∈ {user, assistant}`；`isSidechain: true` 跳过 |
| 消息抽取 | `message.content[]` 的 `type=text` 块拼接 |
| 过滤规则 | 同 G5（isSidechain 即子代理）；无 user 消息为空会话 |
| 工作区来源 | 记录内 `cwd`，无则 `~` |
| 来源标识 | 原 JSONL 文件路径 |
| 作为目标 | 通过临时暂存目录（`Agent-Import`）+ 标记文件模拟外部导入；禁止覆盖无标记目录 |
| 特殊 | 反向比较需忽略 `<environment_context>`、`<permissions instructions>`、`<skills_instructions>`、`<image>` 等机器注入块 |

### B. dsh（DeepSeek Harness）

| 项 | 规则 |
|----|------|
| 数据位置 | `%USERPROFILE%\.dsh\sessions\**\session.jsonl.zstd` |
| 日志格式 | 多帧 Zstandard 压缩 JSONL；读取必须用流式解压（`stream_reader`），单帧解压只得到头部 |
| 消息抽取 | `user/message`（仅 `data.source.kind = user` 的真实用户消息）+ `assistant/message`（仅最终文本块） |
| 过滤规则 | 含 `subagent/descriptor` 排除；无 user 消息排除；`import-*` 目录为反向导入会话，需读 `session/imported` 来源标记参与比较而非直接排除 |
| 工作区来源 | 头部 `session` 事件的 `cwd` |
| 来源标识 | 会话编号 `id`（`session-` 前缀剥离后按 UUID 稳定化） |
| 标题处理 | 无 `session/title` 事件的会话，DSH 会在加载时用首条真实用户消息自动派生 fallback 标题；显式标题写入 `session/title` 事件（`source.kind: user` 钉住，防止 fallback 覆盖） |
| 作为目标（本次实践验证） | 工作区由会话头部 `cwd` 决定归属，无「把会话移入某工作区」的 API；整理 = ① 删除空壳工作区（无会话记录）② 归档非项目会话（`workspace.archiveSession`，可逆、保留日志）③ 无标题会话写入可读标题。运行中 DSH 内存态是权威，直接编辑 `workspace.json` 会被覆盖，必须通过其 HTTP RPC（`/api/workspace.*`、`/api/session.rename`）操作；彻底清理需重启后重建 header index |
| 特殊 | 标题事件追加进 `session.jsonl.zstd` 时，必须用目标后端同源的独立帧压缩（node `zstdCompress` + `checksumFlag=1`）**追加**到文件末尾，绝不能整文件重压缩（破坏多帧结构） |

### C. Codex

| 项 | 规则 |
|----|------|
| 数据位置 | `%USERPROFILE%\.codex\sessions\**\*.jsonl`（rollout 格式） |
| 导入历史 | `%USERPROFILE%\.codex\external_agent_session_imports.json`（source_path → content_sha256） |
| 归档 | `%USERPROFILE%\.codex\archived_sessions\`（按 thread_id / sourceId 定位） |
| 日志格式 | JSONL；`session_meta` 提供 `cwd`；`response_item` + `payload.type=message`，`payload.role ∈ {user, assistant}` |
| 消息抽取 | `payload.content[]` 的 `input_text`/`output_text`/`text` 块 |
| 作为目标 | 走 `codex app-server --stdio`：`initialize` → `externalAgentConfig/detect` → `externalAgentConfig/import` → 等待 `import/completed`；只把检测器返回的 `SESSIONS` 交给导入接口 |
| 反向来源追踪 | 作为「源」时，供 dsh `import-*` 会话反向比对：按 `sourcePath` 定位原文件，失效则按 `sourceId` 在 `archived_sessions` 中定位 |
| 归档接口 | 仅 `thread/archive` 接口；禁止直接写 SQLite |

### D. Gemini CLI（预留）

| 项 | 规则 |
|----|------|
| 数据位置 | `%USERPROFILE%\.gemini\history\...` |
| 状态 | 仅登记启动规范；同步格式待 Gemini 官方导出接口稳定后补充，当前按通用规则扩展 |

## 三、方向与编排

| 同步方向 | 源 Agent | 目标 Agent | 走哪个分 Agent 规则 |
|----------|----------|-----------|---------------------|
| Claude/dsh → Codex | Claude、dsh | Codex | 源走 A/B 抽取，目标走 C 导入 |
| → dsh（本次实践） | Codex、Claude、dsh | dsh | 源走 C/A/B 抽取，目标走 B 的「作为目标」写入 |
| → Claude | dsh、Codex | Claude | 源走 B/C，目标走 A 的暂存导入 |

## 四、执行顺序（任意方向通用）

1. **Detect**：按 `--source` 声明抽取源 Agent 会话 → 应用通用规则 G1–G5 整理 → 输出工作区与新增会话统计。
2. **Import**：再次整理与检测，只导入目标 Agent 认可的规范会话。
3. **写入目标**：按目标 Agent 的「作为目标」规则落地（Codex 走 app-server 检测器；dsh 走 workspace RPC；Claude 走暂存目录）。
4. 核验（G11）、归档（G8/G9）、清理（G10）。

## 五、验收标准

- 成功数 + 失败数 = 请求数。
- 源文件数量在同步前后不变（G11）。
- 暂存目录和任务临时目录均不存在（G10）。
- 输入会话数 = 整理后会话数 + 合并重复数。
- 整理后会话数 = 待同步会话数 + 已导入会话数。
- 每个规范会话的来源清单完整，且 `cwd` 等于整理后的工作区。
- 反向导入统计满足：总数 = 完全一致 + 扩展 + 子集 + 分叉 + 来源缺失。
- 至少抽查一个长会话的用户消息与助手回复顺序。
