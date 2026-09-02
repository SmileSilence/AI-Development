---
name: smile-global-config
description: 全局简体中文配置与 AI Agent 管理；安装后自动生效，涵盖交流、文档、代码注释、Agent 启动、临时文件卫生与会话同步。
metadata:
  publisher: SmileXX
  short-description: 全局中文配置与 Agent 管理
  version: "v16"
  last-updated: "2026-09-02"
  category: 全局配置
---

# 全局配置与 Agent 管理

确保 AI Agent 在所有场景下使用简体中文交互，同时统一管理本机所有 AI 代理（anget = agent，包括 DSH、Codex、Claude Code、Gemini CLI 等）的启动、使用与会话同步。

## 触发条件

### 全局生效（始终激活）
- 本技能安装后**自动激活，无需任何关键词触发**
- 对所有项目、会话、文档、代码注释生效
- 作为全局基础规则与其他技能并行生效

### Agent 管理激活场景
- 用户说「启动 codex / claude / dsh / gemini」「用 anget 做 XXX」「anget 管理」
- 用户要求运行某个 agent 执行任务（编码、审查、查询等）
- 用户说「同步会话」「整理会话」「合并重复会话」「合并反向导入」「导入 Claude 会话」「导入 dsh 会话」
- 用户提到「脚本放下载文件夹」「临时文件清理」「用完删除」

### 优先级与不触发
- 具体技能规范优先于本技能通用规则（见「技能遵循」）
- 多个技能冲突时，遵循与当前操作最相关的技能
- 创建 dsh 插件 / 其他技能、或用户仅在当前 DSH 会话内直接对话（不涉及启动外部 agent 与文件卫生）→ 不激活 Agent 管理部分

---

## 第一部分 全局中文设置

### A. 语言与文档

#### 1. 语言规范
- **交互语言**：所有回复、解释、确认使用简体中文
- **文档语言**：README、CHANGELOG、注释说明使用中文
- **标点符号**：使用中文标点符号（，。；：！？）
- **沟通风格**：简洁直接，先给结论再展开细节

#### 2. 代码规范
- **命名**：变量名、函数名、类名保持英文（遵循语言规范）
- **注释**：代码注释使用中文
- **文档**：函数/类文档使用中文
- **术语**：技术术语可保留英文（如 API、SDK、JSON）
- **文件命名**：创建文件夹和文件时，名称使用英文，避免使用中文

#### 3. 文档规范
- **文档同步**：修改代码时，若项目存在相关文档，必须同步更新
- **更新要求**：新增功能添加说明，修改接口更新文档，修复问题记录到 CHANGELOG
- **文档内容**：表格、PPT、Word等文档型文件内容使用中文，专业术语除外；专业术语需附带中文翻译或描述

### B. 项目管理

#### 4. 版本管理
- **版本号**：遵循语义化版本规范（SemVer）
  - 主版本号：不兼容的 API 修改
  - 次版本号：向下兼容的功能性新增
  - 修订号：向下兼容的问题修正
- **更新内容**：新增(Added)、修改(Changed)、修复(Fixed)、废弃(Deprecated)、移除(Removed)
- **版本文档**：CHANGELOG.md、CHANGES.md、VERSION、package.json 等

#### 5. 生命周期管理
**安装规范：**
- **自动依赖**：安装任何软件、工具或组件时，必须自动安装其所有依赖项
- **依赖位置**：若依赖可安装在目标软件同目录下，则优先安装在同目录；否则使用系统默认安装目录
- **环境配置**：必要时自动配置环境变量和路径设置
- **安装验证**：安装完成后验证安装是否成功，包括依赖项的完整性检查

**卸载规范：**
- **彻底卸载**：卸载技能、插件或组件时，必须删除所有相关文件，包括配置文件、缓存文件、日志文件等
- **清理残留**：卸载后检查并清理可能残留的临时文件、注册表项（Windows）、环境变量等
- **文档记录**：安装和卸载过程应记录到 CHANGELOG 或日志中，便于后续维护

### C. 技能管理

#### 6. 技能管理
**技能集成：**
- **安装后配置**：安装新技能后，必须在对应 Agent 的全局设置中添加该技能的要求和配置
- **配置位置**：
  - Codex：更新 ~/.codex/AGENTS.md
  - Claude：更新 ~/.claude/ 配置文件
  - DeepSeek Harness：更新 ~/.deepseek/ 配置文件
  - MiMo Code：更新 ~/.mimo/ 配置文件
- **验证配置**：配置完成后，测试技能是否正常工作
- **配置精简**：刻入全局指令时无需刻入版本记录，只需将技能状态和核心规则刻入即可

**技能遵循：**
- **操作前检查**：执行任何操作前，先检查是否有相关 Skill 对该操作有要求
- **规范遵循**：若有相关 Skill，必须遵循该 Skill 的规范和要求
- **优先级**：Skill 规范优先级高于一般规则
- **冲突处理**：多个 Skill 规范冲突时，优先遵循与当前操作最相关的 Skill

### D. 交互行为准则

#### 7. 未找到指定内容时的处理

- **不虚构**：当未找到用户指定的文件、数据、功能或资料时，不得编造、猜测或假装已找到。
- **如实告知**：直接说明未找到的内容和已尝试的查找范围，不隐瞒、不粉饰。
- **交由用户决策**：把后续处理方式的决定权交给用户，等待用户指示下一步操作。

---

## 第二部分 Agent 管理

### E. 启动与管理本机 Agent

根据用户指定，用对应命令启动 codex / claude / dsh / gemini 等工具：

| Agent | 启动命令 | 说明 |
|-------|----------|------|
| DSH | 打开 Web GUI `http://127.0.0.1:3080` | 会话数据在 `%USERPROFILE%\.dsh` |
| Codex | `codex`（交互）或 `codex exec <提示>`（非交互） | 已装于 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` |
| Claude Code | `claude`（交互）或 `claude -p <提示>`（非交互） | npm 全局安装，`claude.ps1` |
| Gemini CLI | `gemini` | 配置目录 `%USERPROFILE%\.gemini` |

### F. 文件卫生规则（必须遵守）

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

### G. 会话同步

会话同步采用「**通用规则统一、分 Agent 规则特化**」架构：各 Agent 只声明自己的特殊部分（数据位置/格式/过滤/映射/目标写入），其余共享同一套通用规则，支持任意 Agent 双向同步（如 Claude/dsh → Codex、Codex/Claude/dsh → DSH）。分 Agent 规则见 `references/AGENT_RULES.md`，执行约定见 `references/SESSION_SYNC.md`。

先运行检测模式（`-Source` 指定源 Agent，`-Target` 指定目标 Agent）：

```powershell
powershell -File scripts/sync-agent-sessions.ps1 -Mode Detect -Source All -Target Codex
powershell -File scripts/sync-agent-sessions.ps1 -Mode Detect -Source Codex -Target Dsh
```

用户明确要求同步或导入后，运行导入模式：

```powershell
powershell -File scripts/sync-agent-sessions.ps1 -Mode Import -Source All -Target Codex
powershell -File scripts/sync-agent-sessions.ps1 -Mode Import -Source Codex -Target Dsh
```

- `-Source` 支持 `All`、`Codex`、`Claude`、`Dsh`；`-Target` 支持 `Codex`、`Dsh`、`Claude`（默认 `Codex`）。
- 默认场景（源=Claude/dsh，目标=Codex）与旧版本兼容，无需额外参数。

同步实现约束：

1. 先按分 Agent 规则解析源会话（数据位置、格式、过滤），再应用通用规则按规范化工作区和会话内容指纹整理。
2. 只合并同一工作区内角色顺序与正文完全一致的会话；不同工作区或仅部分相似的会话保持独立。
3. 反向导入比较时忽略机器注入的环境、权限、技能和中断标记，但原始内容保持只读完整。
4. 完全一致或属于原会话子集的反向会话直接复用；扩展或分叉会话生成保留双方独有轮次的替代会话。
5. 先读取目标 Agent 的外部导入登记；内容未变化的旧会话直接复用，避免技能升级后再次导入。
6. 整理结果转换为目标 Agent 兼容格式，再按目标规则写入（Codex 走原生检测器、dsh 走 workspace RPC、Claude 走暂存目录）。
7. 目标有检测器时只将检测器返回的 `SESSIONS` 传给导入接口，禁止直接写目标私有数据库。
8. 只有全部替代会话导入成功，才归档对应旧任务及同源旧版本；必须排除本批导入返回的目标任务 ID，归档可恢复。
9. 无论检测、导入或异常退出，都必须删除 `Downloads\anget-tmp\session-sync` 和本次创建的暂存目录。
10. 暂存目录（如 `Agent-Import`）必须带安全标记，且不得包含用户原始文件；目标为 dsh 时不修改运行态之外的文件。

### H. 技能清单安装

1. 用户提供 `SKILL_CATALOG.xlsx` 时，读取其“总技能清单”工作表，以“默认安装”列作为安装范围依据。
2. “默认安装=是”的技能直接安装；“否”的技能默认跳过。
3. SmileXX 自有技能只克隆一次 AI-Development 仓库，然后运行 `pwsh -File .\AI_Skill\install-skills.ps1 -RecommendedOnly`；安装脚本读取 `AI_Skill/skill-manifest.json` 中的 `default_install` 字段，不要求额外的总清单 JSON。
4. 第三方技能必须从对应行的官方仓库地址下载，禁止从 AI-Development 仓库复制第三方源码。
5. 安装后检查每个目标目录存在 `SKILL.md`，并汇报成功、跳过和失败项目。
6. 不得自行把“否”改为“是”；扩大安装范围前必须取得用户明确授权。

### I. 辅助脚本

`scripts/` 目录提供辅助脚本，用法见 `references/SCRIPTS.md`（含 `new-task-dir.ps1`、`cleanup-task-dir.ps1`、`sync-agent-sessions.ps1`）。

---

## 配置说明

- 临时目录根：`%USERPROFILE%\Downloads\anget-tmp\`
- 下载文件夹：`%USERPROFILE%\Downloads`（默认存在）
- 各 agent 的配置/会话数据目录（`~\.codex`、`~\.claude`、`~\.dsh`、`~\.gemini`）**不属于临时产物，不得删除**。
- 会话同步临时目录：`%USERPROFILE%\Downloads\anget-tmp\session-sync\`
- 规范会话暂存目录：`%USERPROFILE%\.claude\projects\Agent-Import\`（同步结束必须删除）
- 分 Agent 同步规则表：`references/AGENT_RULES.md`；执行约定：`references/SESSION_SYNC.md`

## 注意事项

1. **只删自己的临时目录**：`Remove-Item` 前必须核对完整路径，禁止删除下载文件夹下其他内容或用户文件。
2. **不污染工作目录**：脚本/中间文件绝不落到 `D:\Work\AI-Development` 等正常工作区。
3. **失败也要清理**：任务异常中断时，agent 同样执行删除，不留垃圾。
4. **保留需显式确认**：只有用户明确说"保留"，才移动产物到指定位置，并明确告知最终路径。
5. **遵守平台边界**：本技能只负责"启动外部 agent + 文件卫生"，不代理外部 agent 的内部权限决策。
6. **原始会话只读**：不得修改或删除 `.claude\projects`、`.dsh\sessions`、`.codex\sessions` 内的原始会话。
7. **先检测后导入**：未被 Codex 原生检测器返回的会话不得强制写入。
8. **版本兼容**：Codex App Server 属于高级接口；接口不兼容时停止并改用官方“设置 → 导入”或 `/import`。

## 示例

### 代码注释
```python
def calculate_total(items):
    """计算总价"""
    total = 0
    for item in items:
        total += item.price  # 累加每个商品的价格
    return total
```

### CHANGELOG
```markdown
## 更新记录

### v1.0.1 (2026-08-22)
- 修复：计算总价时的精度问题
- 优化：提升查询性能

### v1.0.0 (2026-08-21)
- 新增：总价计算功能
- 新增：商品管理模块
```

### 生命周期管理示例
```markdown
## 安装记录
- 安装时间：2026-08-23 10:30
- 安装路径：C:\Tools\MyTool
- 依赖项：Python 3.9+, Node.js 18+
- 环境变量：已配置 MYTOOL_HOME

## 卸载记录
- 卸载时间：2026-08-23 15:45
- 清理文件：配置文件、缓存目录、日志文件
- 残留检查：已完成，无残留
```

## 排除情况

- 变量名、函数名、类名等代码标识符保持英文
- 第三方库名称保持原样

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-09-02 | v16 | 合并 anget-manager：新增 Agent 管理部分（启动、文件卫生、会话同步、技能清单安装、辅助脚本），随附 references/ 与 scripts/ |
| 2026-08-31 | v15 | 新增交互行为准则：未找到用户指定内容时不虚构、如实告知、交由用户决策 |
| 2026-08-29 | v14 | 精简技能目录描述，保留全局自动生效语义 |
| 2026-08-28 | v13 | 技能名改为 kebab-case（smile-global-config），符合 DSH 加载规范 |
| 2026-08-27 | v12 | 优化触发条件：明确全局自动激活、无需关键词，补充优先级与冲突处理说明 |
| 2026-08-22 | v1 | 初始版本 |
| 2026-08-22 | v2 | 新增技能集成、技能遵循规则 |
| 2026-08-22 | v3 | 合并精简核心规则为6条 |
| 2026-08-22 | v4 | 整理优化技能结构 |
| 2026-08-22 | v5 | 修改触发条件为安装及使用，安装后自动激活 |
| 2026-08-23 | v6 | 新增卸载规范，要求卸载时彻底清理所有相关文件 |
| 2026-08-23 | v7 | 新增安装规范，要求自动安装依赖并优先安装在同目录 |
| 2026-08-23 | v8 | 整合优化：合并安装/卸载为生命周期管理，合并技能集成/遵循为技能管理 |
| 2026-08-23 | v9 | 新增文件命名规范：创建文件夹和文件时避免使用中文 |
| 2026-08-23 | v10 | 新增文档内容规范：文档型文件内容使用中文，专业术语需附带中文翻译 |
| 2026-08-24 | v11 | 新增配置精简规范：刻入全局指令时仅刻入技能状态和核心规则 |
