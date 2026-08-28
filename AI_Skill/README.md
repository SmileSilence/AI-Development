# AI_Skill — 技能开发规范

> 本目录用于存放和管理 AI Agent 的可复用技能。
> 每个技能都是独立的模块，可被多种 Agent（DSH / Codex / Claude）加载和使用。

---

## 一、目录结构规范

### 1.1 技能目录结构

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

### 1.2 命名规范

- **目录名**：kebab-case 小写（如 `ai-coding-workflow`、`smile-global-config`）；DSH 仅加载 kebab-case 小写技能名，PascalCase 无法在 DSH 中加载
- **SKILL.md 中的 name**：与目录名一致
- **metadata**：包含 `version`、`short-description`、`category`（分类）

### 1.3 必需文件

#### SKILL.md

每个技能必须包含 SKILL.md，格式如下：

`yaml
---
name: <skill-name>
description: <简短描述技能功能和触发条件>
metadata:
  version: "v1"
  short-description: <更简短的描述>
  category: <分类>
---
`

正文须包含「触发条件」小节，并建议包含功能、使用方法、注意事项。

---

## 二、现有技能清单（13 个）

| 技能 | 版本 | 分类 | 说明 |
|------|------|------|------|
| ai-coding-workflow | v4 | 编码开发 | AI 辅助编码完整工作流 |
| anget-manager | v4 | Agent 管理 | Agent 启动、会话同步与临时文件清理 |
| code-style | v5 | 代码规范 | 代码规范与代码风格指南 |
| deepseek-harness-plugin-creator | v2 | 插件开发 | dsh 插件开发 |
| mcp-auto-loader | v3 | Agent 管理 | 按需自动加载 MCP 服务器 |
| skill-creator | v4 | 技能开发 | 技能开发工具（本规范） |
| smile-global-config | v13 | 全局配置 | 全局简体中文设置（自动激活） |
| smile-know-collector | v3.5 | 知识管理 | 个人知识库收集整理 |
| smile-project-config | v6 | 项目规范 | 通用项目配置规范 |
| ue-development | v2 | 游戏开发 | Unreal Engine 项目开发 |
| ue-plugin-development | v2 | 游戏开发 | UE 插件/扩展开发 |
| unity-development | v2 | 游戏开发 | Unity 项目开发 |
| unity-plugin-development | v2 | 游戏开发 | Unity 插件/Package 开发 |

### 常用技能详情

#### smile-global-config（全局中文配置）

**位置**：AI_Skill/smile-global-config/

**功能**：确保所有交互使用中文，文档和版本同步更新；安装后自动激活，无需触发。

| 规则 | 说明 |
|------|------|
| 交互语言 | 所有回复、解释、确认使用简体中文 |
| 代码相关 | 注释和文档使用中文，变量名保持英文 |
| 文档同步 | 修改代码时必须同步更新相关文档 |
| 版本管理 | 检查并更新 CHANGELOG、VERSION 等版本文档 |

#### smile-project-config（项目配置规范）

**位置**：AI_Skill/smile-project-config/

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

**位置**：AI_Skill/skill-creator/

**功能**：创建、开发和维护 AI_Skill 目录下的技能；命名统一 kebab-case。

| 文件 | 用途 |
|------|------|
| SKILL.md | 技能开发规范说明 |
| references/SKILL_TEMPLATE.md | SKILL.md 模板 |
| references/OPENAI_YAML_TEMPLATE.yaml | openai.yaml 模板 |

#### deepseek-harness-plugin-creator（DSH 插件开发工具）

**位置**：AI_Skill/deepseek-harness-plugin-creator/

**功能**：创建、开发和发布 DeepSeek Harness 插件。

**支持命令**：
`bash
dsh add https://github.com/<username>/<plugin-name>  # 从 GitHub 安装
dsh add --local /path/to/plugin                       # 从本地安装
dsh remove <plugin-name>                              # 卸载插件
`

---

## 三、技能开发规范

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
  version: "v1"
  short-description: <简短描述>
  category: <分类>
---
`

#### 描述编写规范

描述应包含：
- **功能**：技能做什么
- **触发条件**：何时激活
- **排除条件**：何时不应激活（如有，技能应自包含，不引用其他技能）

---

## 四、技能安装与使用

### 4.1 安装位置

| Agent | 安装目录 |
|-------|----------|
| Codex | `C:/Users/19163/.codex/skills/` |
| DSH | `C:/Users/19163/.agents/skills/` |
| Claude | `C:/Users/19163/.claude/skills/` |

### 4.2 安装方式

将技能目录复制到安装位置：

`powershell
Copy-Item -Path "D:\Work\AI-Development\AI_Skill\<skill-name>" 
          -Destination "C:/Users/19163/.codex/skills/<skill-name>" 
          -Recurse -Force
`

或使用仓库根目录的一键安装脚本 `install-skills.ps1`（按 `skill-manifest.json` 安装）。

### 4.3 使用方式

- **自动触发**：符合触发条件时自动激活
- **显式调用**：部分技能支持通过命令显式调用

---

## 五、技能维护

### 5.1 更新流程

1. 修改 AI_Skill/<skill-name>/SKILL.md
2. 同步更新各安装位置的副本（~/.codex、~/.agents、~/.claude）
3. 更新 `skill-manifest.json` / `SKILL_LIST.md` 及本文件的相关说明

### 5.2 版本管理

- 每次实质性修改后更新版本记录
- 版本号格式：{顺序号}

---

## 六、注意事项

1. **技能独立性**：每个技能应功能独立，避免过度耦合（不引用其他技能）
2. **描述准确**：触发条件描述应准确，避免误触发
3. **中文优先**：所有文档使用中文编写
4. **版本同步**：修改后及时更新版本记录
5. **命名合规**：目录名与 name 一律 kebab-case 小写

---

## 七、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-28 | v4 | 技能体系整理：命名规范收紧为 kebab-case；smile-* 三个技能改名（smile-global-config / smile-project-config / smile-know-collector）；清单更新为 13 个技能；修正安装路径 |
| 2026-08-28 | v3 | SmileProjectConfig 通用化改造：去除 Python 专属内容，编码规范移交 code-style / ai-coding-workflow |
| 2026-08-22 | v2 | 添加 skill-creator 和 deepseek-harness-plugin-creator |
| 2026-08-22 | v1 | 初始版本 — 包含 SmileGlobalConfig、SmileProjectConfig |

---

*本文档用于规范 AI_Skill 目录下所有技能的开发、维护和使用。*
