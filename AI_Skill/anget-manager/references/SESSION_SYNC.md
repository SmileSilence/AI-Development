# Agent 会话整理与同步规范

## 支持范围

- Claude Code 与 dsh：先解析为统一消息结构，按工作区整理并合并重复内容。
- 整理结果 → Codex：转换为 Claude 兼容 JSONL，再交给 Codex 原生外部 Agent 导入器。
- Codex 官方当前未列出 dsh，因此 dsh 路径属于兼容桥接；Codex 更新后应先运行 `Detect`。

官方说明：https://learn.chatgpt.com/docs/import

## 数据位置

| 来源 | 位置 |
|---|---|
| Claude Code | `%USERPROFILE%\.claude\projects\**\*.jsonl` |
| dsh | `%USERPROFILE%\.dsh\sessions\**\session.jsonl.zstd` |
| Codex 导入历史 | `%USERPROFILE%\.codex\external_agent_session_imports.json` |

## dsh 过滤规则

必须排除：

1. 包含 `subagent/descriptor` 的子代理会话。
2. 不含 `type=user/message` 且 `data.source.kind=user` 的空会话。

目录名以 `import-` 开头的反向导入会话不得直接排除，必须读取 `session/imported` 中的 Codex 来源信息后参与比较。

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

## dsh 格式映射

| dsh | 目标 | 规则 |
|---|---|---|
| `user/message` | Claude `type=user` | 仅保留真实用户文本 |
| `assistant/message` | Claude `type=assistant` | 仅保留最终文本块 |
| `session` | 公共元数据 | 保留工作目录和会话编号 |
| 分块、推理、工具事件 | 不导入 | 避免重复并控制体积 |

导入后的会话适合阅读、搜索和继续讨论，不保证完整重放 dsh 工具调用。

## 工作区整理规则

1. 读取每个会话的 `cwd`（当前工作目录）。
2. 路径存在且位于 Git 仓库内时，向上查找最近的 `.git`，以仓库根目录作为工作区。
3. 非 Git 路径保留规范化后的原工作目录。
4. Windows 路径比较忽略大小写，并统一目录分隔符。
5. 规范会话的 `cwd` 写为工作区路径，使 Codex 按项目上下文归类。

## 同内容合并规则

1. 仅在同一工作区内比较和合并。
2. 指纹由消息角色顺序和正文生成；忽略换行格式差异、行尾空格和首尾空行。
3. 指纹完全一致时折叠为一个规范会话，并在清单中保留全部来源文件和 Agent 类型。
4. 不进行模糊合并；仅部分相似、标题相同或不同工作区的会话保持独立。
5. 规范会话编号由“工作区＋内容指纹”稳定生成，重复检测不会产生随机副本。
6. 同组任一来源已按当前内容导入时，复用原有 Codex 会话，不再生成新的规范副本。
7. dsh 会兼容识别 v2 版本使用的 `DSH-Import` 导入登记，防止技能升级后重复导入。

## 安全规则

1. 源会话只读，不得修改或删除。
2. 不直接写 Codex SQLite 数据库。
3. 只导入 Codex `externalAgentConfig/detect` 返回的 `SESSIONS`。
4. `Agent-Import` 必须带技能生成的标记文件；若目录存在但没有标记，立即停止，禁止覆盖。
5. 无论成功、失败或中断，都清理暂存目录和下载临时目录。
6. 导入后核对请求数、成功数、失败数，并抽查任务内容。
7. 归档只用于成功生成替代会话的反向来源任务，归档失败必须单独报告且不得删除任务。

## 执行顺序

1. `Detect`：扫描、过滤、按工作区整理、合并、转换，并输出工作区和新增会话统计。
2. `Import`：再次整理和检测，只导入返回的规范会话。
3. 等待 `externalAgentConfig/import/completed`。
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
