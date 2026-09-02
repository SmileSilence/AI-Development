# Agent 会话整理与同步规范

同步采用「**通用规则统一、分 Agent 规则特化**」架构，见 **`AGENT_RULES.md`**：

- **通用规则（G1–G11）**：源只读、工作区整理、同内容合并、活跃防抖、子代理排除、先检测后导入、暂存安全、版本收敛、归档纪律、全程清理、核验。所有 Agent 一律遵守。
- **分 Agent 规则（A/B/C/D）**：每个 Agent 只声明自己的数据位置、日志格式、消息抽取、过滤、格式映射、来源标识、目标写入方式。新增 Agent 只补一节，其余继承通用规则。

本文档记录会话同步的**执行约定与验收**。支持范围与方向见 AGENT_RULES.md「三、方向与编排」。

## 支持范围

| 方向 | 源 | 目标 | 说明 |
|------|----|------|------|
| Claude/dsh → Codex | Claude、dsh | Codex | 先解析为统一消息结构，按工作区整理并合并；转 Claude 兼容 JSONL，交给 Codex 原生外部 Agent 导入器。 |
| → dsh（本次实践） | Codex、Claude、dsh | dsh | 读各源会话 → 整理 → 写入 dsh 工作区/会话（见「dsh 作为目标」）。Codex 官方未原生支持，dsh 路径属于兼容桥接。 |
| → Claude | dsh、Codex | Claude | 通过带安全标记的暂存目录导入。 |

## 数据位置

| 来源 | 位置 |
|---|---|
| Claude Code | `%USERPROFILE%\.claude\projects\**\*.jsonl` |
| dsh | `%USERPROFILE%\.dsh\sessions\**\session.jsonl.zstd` |
| Codex 导入历史 | `%USERPROFILE%\.codex\external_agent_session_imports.json` |
| Codex 归档 | `%USERPROFILE%\.codex\archived_sessions\` |

## dsh 过滤规则（分 Agent B 的特殊部分）

1. 包含 `subagent/descriptor` 的子代理会话。
2. 不含 `type=user/message` 且 `data.source.kind=user` 的空会话。
3. 目录名以 `import-` 开头的反向导入会话不得直接排除，必须读取 `session/imported` 中的 Codex 来源信息后参与比较。

## 反向导入差异与合并

1. 根据 `session/imported.data.sourcePath` 只读加载原 Codex JSONL，并核对 `sourceId`。
   原路径因归档失效时，按 `sourceId` 在 `.codex\archived_sessions` 中定位唯一文件。
2. 比较时忽略机器自动注入的环境、权限、技能、图片占位和中断标记；真实消息原文不修改。
3. 以真实用户消息序列判断关系：
   - `exact`：完全一致，复用原 Codex 任务。
   - `subset`：dsh 内容是原任务子集，保留内容更完整的原任务。
   - `extended`：dsh 在原任务基础上继续对话，生成合并替代会话。
   - `diverged`：双方形成分支，按最长公共对话序列保留双方独有轮次并生成替代会话。
   - `missing_origin`：找不到原 Codex 文件，保留反向会话并报告来源缺失。
4. 替代会话记录原线程编号、来源路径和差异类型。
5. 只有本批导入全部成功后才归档旧线程；任何导入失败时均不归档。

## dsh 格式映射（作为源时）

| dsh | 目标 | 规则 |
|---|---|---|
| `user/message` | Claude `type=user` | 仅保留真实用户文本（`data.source.kind=user`） |
| `assistant/message` | Claude `type=assistant` | 仅保留最终文本块 |
| `session` | 公共元数据 | 保留工作目录和会话编号 |
| 分块、推理、工具事件 | 不导入 | 避免重复并控制体积 |

导入后的会话适合阅读、搜索和继续讨论，不保证完整重放源 Agent 工具调用。

## dsh 作为目标（本次实践验证）

dsh 的工作区由会话头部 `cwd` 决定归属，**没有**「把会话移入某工作区」的 API。整理按以下步骤：

1. **删除空壳工作区**：无任何会话记录、且名称为 `import-xxx`/`session-xxx` 代码或路径片段的工作区，直接删除（`workspace.delete`）；目录与会话日志保留。
2. **归档非项目会话**：对非项目杂目录（Desktop、ChatGPT 导出、ConsoleApp1 等）的会话调用 `workspace.archiveSession`（可逆、保留日志、从分组表面隐藏）。
3. **无标题会话写标题**：读取首条有意义的真实用户消息（跳过 `# AGENTS.md instructions` 等系统注入），截取约 40 字符写入 `session/title` 事件（`source.kind: user` 钉住）。
4. **标题写入方式**：向 `session.jsonl.zstd` **追加**一个独立 zstd 帧（用目标后端同源压缩：node `zstdCompress` + `checksumFlag=1`），绝不整文件重压缩——多帧结构（首帧 = 头部行，后续每帧 = 事件批）一旦破坏会报「corrupt Zstandard session log: first frame is not exactly one header line」。写入前先备份原文件。
5. **运行态权威**：运行中 DSH 内存态是权威，直接编辑 `workspace.json` 会被覆盖；必须通过其 HTTP RPC（`POST /api/workspace.list`、`workspace.delete`、`workspace.archiveSession` 等）操作。磁盘已删除会话的幽灵引用（如 `import-import-*`）在**重启 DSH** 后随 header index 重建自动消失。
6. **孤儿会话**：磁盘存在但不在任何工作区记录的会话，若其 `cwd` 匹配现存工作区则重启后自动归位；否则归档收拢（不删日志，可恢复）。

## 工作区整理规则（通用 G2）

1. 读取每个会话的 `cwd`。
2. 路径存在且位于 Git 仓库内时，向上查找最近的 `.git`，以仓库根目录作为工作区。
3. 非 Git 路径保留规范化后的原工作目录。
4. Windows 路径比较忽略大小写，并统一目录分隔符。
5. 规范会话的 `cwd` 写为工作区路径，使目标按项目上下文归类。

## 同内容合并规则（通用 G3）

1. 仅在同一工作区内比较和合并。
2. 指纹由消息角色顺序和正文生成；忽略换行格式差异、行尾空格和首尾空行。
3. 指纹完全一致时折叠为一个规范会话，并在清单中保留全部来源文件和 Agent 类型。
4. 不进行模糊合并；仅部分相似、标题相同或不同工作区的会话保持独立。
5. 规范会话编号由“工作区＋来源标识”稳定生成，正文更新后仍复用同一暂存路径。
6. 同组任一来源已按当前内容导入时，复用原有目标会话，不再生成新的规范副本。

## 同源版本链规则（通用 G8）

1. 来源标识：Claude 用原 JSONL 路径；dsh 用稳定会话编号。
2. 同一来源内容变化并成功导入新整理结果后，读取该来源此前的 `imported_thread_id`。
3. 目标原生导入若复用已有目标任务 ID，则直接更新该任务且不得归档它；只有返回不同目标任务 ID 时，才在整批成功后归档其他未归档旧版本。
4. 导入失败、结果数量不一致或归档失败时必须报告，禁止删除旧版本。
5. 最后修改不足 60 秒的源文件视为活跃会话（G4），本轮跳过。

## 安全规则（通用 G6–G11）

1. 源会话只读，不得修改或删除。
2. 不直接写目标 Agent 的私有数据库（Codex SQLite、DSH workspace.json 运行态）。
3. 目标有检测器时只导入其返回的 `SESSIONS`。
4. 暂存目录必须带技能生成的标记文件；若目录存在但没有标记，立即停止，禁止覆盖。
5. 无论成功、失败或中断，都清理暂存目录和下载临时目录。
6. 导入后核对请求数、成功数、失败数，并抽查任务内容。
7. 归档只用于成功生成替代会话的反向来源任务或同源旧版本。

## 执行顺序（通用）

1. `Detect`：扫描、过滤、按工作区整理、合并、转换，并输出工作区和新增会话统计。
2. `Import`：再次整理和检测，只导入目标认可的规范会话。
3. 等待目标导入完成通知（如 Codex `externalAgentConfig/import/completed`）。
4. 输出成功和失败明细。
5. 自动清理。

## 验收标准

- 成功数 + 失败数 = 请求数。
- 源文件数量在同步前后不变。
- 暂存目录和任务临时目录均不存在。
- 输入会话数 = 整理后会话数 + 合并重复数。
- 整理后会话数 = 待同步会话数 + 已导入会话数。
- 每个规范会话的来源清单完整，且 `cwd` 等于整理后的工作区。
- 反向导入统计满足：总数 = 完全一致 + 扩展 + 子集 + 分叉 + 来源缺失。
- 替代会话成功数与被归档的旧任务清单可追踪；失败时旧任务仍可访问。
- 至少抽查一个长会话的用户消息与助手回复顺序。
