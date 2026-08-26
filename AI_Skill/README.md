# AI_Skill — 技能开发规范

> 本目录用于存放和管理 AI Agent 的可复用技能。
> 每个技能都是独立的模块，可被多种 Agent 加载和使用。

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

- **目录名**：使用 PascalCase（如 SmileGlobalConfig）或 kebab-case（如 ai-coding-workflow）
- **SKILL.md 中的 name**：与目录名一致

### 1.3 必需文件

#### SKILL.md

每个技能必须包含 SKILL.md，格式如下：

`yaml
---
name: <skill-name>
description: <简短描述技能功能和触发条件>
metadata:
  short-description: <更简短的描述>
---
`

---

## 二、现有技能清单

### 2.1 SmileGlobalConfig（全局中文配置）

**位置**：AI_Skill/SmileGlobalConfig/

**功能**：确保所有交互使用中文，文档和版本同步更新

**核心规则**：

| 规则 | 说明 |
|------|------|
| 交互语言 | 所有回复、解释、确认使用简体中文 |
| 代码相关 | 注释和文档使用中文，变量名保持英文 |
| 文档同步 | 修改代码时必须同步更新相关文档 |
| 版本管理 | 检查并更新 CHANGELOG、VERSION 等版本文档 |

---

### 2.2 SmileProjectConfig（项目配置规范）

**位置**：AI_Skill/SmileProjectConfig/

**功能**：Python 桌面应用开发的标准规范和模板

**包含规范**：

| 章节 | 内容 |
|------|------|
| 核心原则 | 中文沟通、文档同步、版本号规则、代码风格 |
| 项目结构 | 统一目录结构约定 |
| 通用规范 | 命名、错误处理、防御编程、测试、日志 |
| Git 规范 | 主分支、分支命名、提交规范 |
| 打包发布 | PyInstaller 打包规范 |

**模板文件**：

| 文件 | 用途 |
|------|------|
| CLAUDE_PROJECT_TEMPLATE.md | 项目规范模板 |
| PROJECT_SPEC_TEMPLATE.md | 特殊规范模板 |
| README_TEMPLATE.md | README 模板 |
| GITIGNORE_TEMPLATE.txt | .gitignore 模板 |

---

### 2.3 skill-creator（技能开发工具）

**位置**：AI_Skill/skill-creator/

**功能**：创建、开发和维护 AI_Skill 目录下的技能

**包含内容**：

| 文件 | 用途 |
|------|------|
| SKILL.md | 技能开发规范说明 |
| references/SKILL_TEMPLATE.md | SKILL.md 模板 |
| references/OPENAI_YAML_TEMPLATE.yaml | openai.yaml 模板 |

**触发条件**：
- 用户说「创建一个 skill」「开发技能」「新建 AI 技能」
- 用户要求为某个功能创建可复用的技能

---

### 2.4 deepseek-harness-plugin-creator（DSH 插件开发工具）

**位置**：AI_Skill/deepseek-harness-plugin-creator/

**功能**：创建、开发和发布 DeepSeek Harness 插件

**包含内容**：

| 文件 | 用途 |
|------|------|
| SKILL.md | DSH 插件开发规范 |
| references/PLUGIN_JSON_TEMPLATE.json | plugin.json 模板 |
| references/README_TEMPLATE.md | README 模板 |
| references/MAIN_PY_TEMPLATE.py | Python 入口模板 |
| scripts/install.sh | Linux 安装脚本 |
| scripts/install.bat | Windows 安装脚本 |

**触发条件**：
- 用户说「创建 dsh 插件」「开发 DeepSeek Harness 插件」
- 用户要求发布插件到 GitHub

**支持命令**：
`ash
dsh add https://github.com/<username>/<plugin-name>  # 从 GitHub 安装
dsh add --local /path/to/plugin                       # 从本地安装
dsh remove <plugin-name>                              # 卸载插件
`

---

## 三、技能开发规范

### 3.1 开发流程

1. **需求分析**：明确技能的功能边界和触发条件
2. **目录创建**：按规范创建技能目录结构
3. **编写 SKILL.md**：包含 YAML frontmatter 和详细说明
4. **配置 Agent**：根据需要创建 gents/openai.yaml
5. **添加资源**：如有需要，添加 scripts、references、assets
6. **测试验证**：确保技能可被正确加载和触发

### 3.2 SKILL.md 编写规范

#### Frontmatter 必需字段

`yaml
---
name: <skill-name>
description: <description>
---
`

#### 描述编写规范

描述应包含：
- **功能**：技能做什么
- **触发条件**：何时激活
- **排除条件**：何时不应激活（如有）

---

## 四、技能安装与使用

### 4.1 安装位置

技能统一安装在 C:/Users/19163/.codex/skills/ 目录下。

### 4.2 安装方式

将技能目录复制到安装位置：

`powershell
Copy-Item -Path "D:\Work\Config\AI-Development\AI_Skill\<skill-name>" 
          -Destination "C:/Users/19163/.codex/skills/<skill-name>" 
          -Recurse -Force
`

### 4.3 使用方式

- **自动触发**：符合触发条件时自动激活
- **显式调用**：部分技能支持通过命令显式调用

---

## 五、技能维护

### 5.1 更新流程

1. 修改 AI_Skill/<skill-name>/SKILL.md
2. 同步更新安装位置的副本
3. 更新本文件的相关说明

### 5.2 版本管理

- 每次实质性修改后更新版本记录
- 版本号格式：{顺序号}

---

## 六、注意事项

1. **技能独立性**：每个技能应功能独立，避免过度耦合
2. **描述准确**：触发条件描述应准确，避免误触发
3. **中文优先**：所有文档使用中文编写
4. **版本同步**：修改后及时更新版本记录

---

## 七、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-22 | v2 | 添加 skill-creator 和 deepseek-harness-plugin-creator |
| 2026-08-22 | v1 | 初始版本 — 包含 SmileGlobalConfig、SmileProjectConfig |

---

*本文档用于规范 AI_Skill 目录下所有技能的开发、维护和使用。*
