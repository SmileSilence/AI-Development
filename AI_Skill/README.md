# AI_Skill — 技能开发规范

> 本目录按来源管理 AI Agent 的可复用技能。
> `SmlieSkills` 保存 SmileXX 自有技能，`OtherSkills` 保存第三方技能索引和本地文件。

---

## 一、来源目录设计

```
AI_Skill/
├── README.md                       # 本分类设计与维护规范
├── SKILL_LIST.md                   # 技能明细与安装状态
├── QUICK_INSTALL.md                # 快速安装说明
├── INSTALL_README.md               # 完整安装说明
├── skill-manifest.json             # 自有技能安装清单
├── SKILL_CATALOG.xlsx              # 全部技能中文总清单
├── install-skills.ps1              # 技能安装脚本
├── SmlieSkills/                    # 自有技能源码，纳入 Git
│   └── <skill-name>/
├── OtherSkills/                    # 第三方技能本地工作区
│   ├── skill-manifest.json         # 第三方技能清单，纳入 Git
│   ├── OtherSkills.xlsx            # 第三方技能 Excel 清单，纳入 Git
│   └── <downloaded-source>         # 源码与本地适配文档，由 Git 忽略
└── README.md                       # 本设计与维护规范
```

- **SmlieSkills**：只存放自己创建和维护的技能，发布者统一为 `SmileXX`。
- **OtherSkills**：存放下载的第三方源码、压缩包和本地适配文档；GitHub 只上传 `skill-manifest.json` 与 `OtherSkills.xlsx`。
- **第三方复用**：其他环境读取清单中的仓库地址和描述后，直接从上游仓库下载。

## 二、技能目录结构规范

### 2.1 技能目录结构

每个技能必须遵循以下结构：

`
<skill-name>/
├── SKILL.md                 # 必需：技能说明文档
├── agents/                  # 可选：Agent 配置
│   └── openai.yaml          # OpenAI Agent 配置
├── scripts/                 # 可选：可执行脚本
├── references/              # 可选：参考资料文档
└── assets/                  # 可选：静态资源文件
`

### 2.2 命名与元数据规范

- **目录名**：kebab-case 小写（如 `ai-coding-workflow`、`smile-global-config`）；DSH 仅加载 kebab-case 小写技能名，PascalCase 无法在 DSH 中加载
- **SKILL.md 中的 name**：与目录名一致
- **metadata**：包含 `publisher`、`version`、`short-description`、`category`（分类）
- **publisher**：`SmlieSkills` 下统一填写 `SmileXX`；`OtherSkills` 保留原作者或上游组织名
- **description**：建议控制在 40～70 个字符，只保留核心能力与明确触发条件；详细功能写入正文

### 2.3 必需文件

#### SKILL.md

每个技能必须包含 SKILL.md，格式如下：

`yaml
---
name: <skill-name>
description: <简短描述技能功能和触发条件>
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: <更简短的描述>
  category: <分类>
---
`

正文须包含「触发条件」小节，并建议包含功能、使用方法、注意事项。

---

## 三、现有自有技能清单（13 个）

| 技能 | 发布者 | 版本 | 分类 | 说明 |
|------|--------|------|------|------|
| ai-coding-workflow | SmileXX | v6 | 编码开发 | AI 辅助编码完整工作流 |
| anget-manager | SmileXX | v7 | Agent 管理 | Agent 启动、清单安装、会话同步与临时文件清理 |
| code-style | SmileXX | v8 | 代码规范 | 代码规范与代码风格指南 |
| deepseek-harness-plugin-creator | SmileXX | v3 | 插件开发 | dsh 插件开发 |
| mcp-auto-loader | SmileXX | v4 | Agent 管理 | 按需自动加载 MCP 服务器 |
| skill-creator | SmileXX | v6 | 技能开发 | 技能开发工具（本规范） |
| smile-global-config | SmileXX | v14 | 全局配置 | 全局简体中文设置（自动激活） |
| smile-know-collector | SmileXX | v3.6 | 知识管理 | 个人知识库收集整理 |
| smile-project-config | SmileXX | v7 | 项目规范 | 通用项目配置规范 |
| ue-development | SmileXX | v3 | 游戏开发 | Unreal Engine 项目开发 |
| ue-plugin-development | SmileXX | v3 | 游戏开发 | UE 插件/扩展开发 |
| unity-development | SmileXX | v3 | 游戏开发 | Unity 项目开发 |
| unity-plugin-development | SmileXX | v3 | 游戏开发 | Unity 插件/Package 开发 |

### 常用技能详情

#### smile-global-config（全局中文配置）

**位置**：AI_Skill/SmlieSkills/smile-global-config/

**功能**：确保所有交互使用中文，文档和版本同步更新；安装后自动激活，无需触发。

| 规则 | 说明 |
|------|------|
| 交互语言 | 所有回复、解释、确认使用简体中文 |
| 代码相关 | 注释和文档使用中文，变量名保持英文 |
| 文档同步 | 修改代码时必须同步更新相关文档 |
| 版本管理 | 检查并更新 CHANGELOG、VERSION 等版本文档 |

#### smile-project-config（项目配置规范）

**位置**：AI_Skill/SmlieSkills/smile-project-config/

**功能**：通用项目开发规范：项目结构、Git 规范、文档模板与配置管理（语言无关）。

| 章节 | 内容 |
|------|------|
| 核心原则 | 语言、文档同步、版本记录遵循 smile-global-config；代码风格遵循 code-style |
| 项目结构 | 统一目录结构约定（语言无关） |
| 通用规范 | 日志、界面素材获取 |
| Git 规范 | 主分支、分支命名、提交规范 |
| 文档模板 | AGENTS.md、PROJECT_SPEC.md、README.md、.gitignore 模板 |
| 打包发布 | 构建产物输出 dist/ 与清理规范 |
| 配置管理 | 工作区项目配置路径清单 |

#### skill-creator（技能开发工具）

**位置**：AI_Skill/SmlieSkills/skill-creator/

**功能**：创建、开发和维护 AI_Skill 目录下的技能；命名统一 kebab-case。

| 文件 | 用途 |
|------|------|
| SKILL.md | 技能开发规范说明 |
| references/SKILL_TEMPLATE.md | SKILL.md 模板 |
| references/OPENAI_YAML_TEMPLATE.yaml | openai.yaml 模板 |

#### deepseek-harness-plugin-creator（DSH 插件开发工具）

**位置**：AI_Skill/SmlieSkills/deepseek-harness-plugin-creator/

**功能**：创建、开发和发布 DeepSeek Harness 插件。

**支持命令**：
`bash
dsh add https://github.com/<username>/<plugin-name>  # 从 GitHub 安装
dsh add --local /path/to/plugin                       # 从本地安装
dsh remove <plugin-name>                              # 卸载插件
`

---

## 四、自有技能开发规范

### 3.1 开发流程

1. **需求分析**：明确技能的功能边界和触发条件
2. **目录创建**：按规范创建技能目录（kebab-case 命名）
3. **编写 SKILL.md**：包含 YAML frontmatter 和详细说明
4. **配置 Agent**：根据需要创建 `agents/openai.yaml`
5. **添加资源**：如有需要，添加 scripts、references、assets
6. **测试验证**：确保技能可被正确加载和触发

### 3.2 SKILL.md 编写规范

#### Frontmatter 必需字段

`yaml
---
name: <skill-name>
description: <description>
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: <简短描述>
  category: <分类>
---
`

#### 描述编写规范

描述应包含：
- **功能**：技能做什么
- **触发条件**：何时激活
- **长度**：建议 40～70 个字符，避免在技能目录中重复详细说明

排除条件和详细能力写入正文的「触发条件」与「功能」小节，不放入 frontmatter description。

---

## 五、技能安装与使用

### 4.1 安装位置

| Agent | 安装目录 |
|-------|----------|
| Codex / DSH / MiMo | `C:/Users/19163/.agents/skills/`（共享目录） |
| Claude | `C:/Users/19163/.claude/skills/` |

### 4.2 安装方式

将技能目录复制到安装位置：

`powershell
Copy-Item -Path "D:\Work\AI-Development\AI_Skill\SmlieSkills\<skill-name>"
          -Destination "$env:USERPROFILE/.agents/skills/<skill-name>"
          -Recurse -Force
`

或在仓库根目录运行 `AI_Skill/install-skills.ps1`（按同目录的 `skill-manifest.json` 安装）。

仅安装总清单中标记为默认推荐的技能：

`powershell
pwsh -File .\AI_Skill\install-skills.ps1 -RecommendedOnly
`

全部技能及推荐状态见本目录的 `SKILL_CATALOG.xlsx`；自有技能安装脚本读取 `skill-manifest.json`。

### 4.3 使用方式

- **自动触发**：符合触发条件时自动激活
- **显式调用**：部分技能支持通过命令显式调用

---

## 六、技能维护

### 5.1 更新流程

1. 修改 `AI_Skill/SmlieSkills/<skill-name>/SKILL.md`
2. 在仓库根目录运行 `AI_Skill/install-skills.ps1`，同步 `~/.agents/skills` 与 `~/.claude/skills`
3. 更新 `skill-manifest.json` / `SKILL_LIST.md` 及本文件的相关说明

### 5.2 版本管理

- 每次实质性修改后更新版本记录
- 版本号格式：{顺序号}

---

## 七、第三方技能管理

1. 在 `OtherSkills/skill-manifest.json` 和 `OtherSkills.xlsx` 中同步登记名称、发布者、描述、仓库地址、许可协议和安装提示。
2. 第三方源码、压缩包、克隆目录和本地适配文档不上传 GitHub。
3. 不修改第三方技能的发布者归属；本地适配应保留原作者信息。
4. 在其他环境使用时，根据清单中的官方仓库地址重新下载。

## 八、注意事项

1. **技能独立性**：每个技能应功能独立，避免过度耦合（不引用其他技能）
2. **描述准确**：触发条件描述应准确，避免误触发
3. **中文优先**：所有文档使用中文编写
4. **版本同步**：修改后及时更新版本记录
5. **命名合规**：目录名与 name 一律 kebab-case 小写

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-29 | v10 | 删除重复的 skill-catalog.json；总览与默认推荐统一由 Excel 维护，自有技能安装由 skill-manifest.json 驱动 |
| 2026-08-29 | v9 | 技能相关文档、表格、JSON 清单与安装脚本统一归入 AI_Skill 目录 |
| 2026-08-29 | v8 | 新增全部技能总清单与默认推荐安装模式 |
| 2026-08-29 | v7 | 新增 `OtherSkills.xlsx` 第三方技能清单，并规定与 JSON 清单同步维护 |
| 2026-08-29 | v6 | 新增 `SmlieSkills` 与 `OtherSkills` 来源分层；自有技能发布者统一为 SmileXX；第三方源码仅本地保存 |
| 2026-08-29 | v5 | 精简技能 description 规范；改用共享技能目录，避免 Codex 重复注册 |
| 2026-08-28 | v4 | 技能体系整理：命名规范收紧为 kebab-case；smile-* 三个技能改名（smile-global-config / smile-project-config / smile-know-collector）；清单更新为 13 个技能；修正安装路径 |
| 2026-08-28 | v3 | SmileProjectConfig 通用化改造：去除 Python 专属内容，编码规范移交 code-style / ai-coding-workflow |
| 2026-08-22 | v2 | 添加 skill-creator 和 deepseek-harness-plugin-creator |
| 2026-08-22 | v1 | 初始版本 — 包含 SmileGlobalConfig、SmileProjectConfig |

---

*本文档用于规范 AI_Skill 目录下所有技能的开发、维护和使用。*
