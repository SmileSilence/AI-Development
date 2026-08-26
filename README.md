# AI-Development — 工作区总览

> 本工作区用于管理 AI Agent 的配置、技能和开发资源。
> 主要包含全局配置、项目规范以及相关配置文件。

---

## 一、工作区概述

**AI-Development** 是一个专注于 AI Agent 开发和配置的工作区，提供以下核心功能：

- **全局配置**：确保所有交互使用中文、文档同步更新、版本管理
- **项目规范**：Python 桌面应用开发的标准规范和模板
- **技能开发**：维护和开发可复用的 AI 技能

---

## 二、目录结构

`
AI-Development/
├── AI_Skill/                        # AI 技能目录
│   ├── SmileGlobalConfig/          # 全局中文配置
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── openai.yaml
│   └── SmileProjectConfig/         # 项目配置规范
│       ├── SKILL.md
│       ├── agents/
│       │   └── openai.yaml
│       └── references/             # 模板文件
│           ├── CLAUDE_PROJECT_TEMPLATE.md
│           ├── PROJECT_SPEC_TEMPLATE.md
│           ├── README_TEMPLATE.md
│           └── GITIGNORE_TEMPLATE.txt
├── modes-unified/                  # 统一模式定义（待创建）
│   └── modes.json
└── README.md                       # 本文件
`

---

## 三、核心模块

### 3.1 全局中文配置（SmileGlobalConfig）

**位置**：AI_Skill/SmileGlobalConfig/

**功能**：
- 确保所有交互使用简体中文
- 代码注释、文档使用中文
- 修改代码时同步更新文档
- 修改代码后检查并更新版本文档

**核心规则**：
1. **交互语言**：所有回复、解释、确认使用中文
2. **代码相关**：注释和文档使用中文，变量名保持英文
3. **文档同步**：修改代码时必须同步更新相关文档
4. **版本管理**：检查并更新 CHANGELOG、VERSION 等版本文档

### 3.2 项目配置规范（SmileProjectConfig）

**位置**：AI_Skill/SmileProjectConfig/

**功能**：
- Python 桌面应用开发的标准规范
- 项目结构、编码规范、Git 规范
- AI 助手行为指南
- 提供项目文档模板

**包含规范**：
1. **核心原则**：中文沟通、文档同步、版本号规则、代码风格
2. **项目结构**：统一目录结构约定
3. **通用规范**：命名、错误处理、防御编程、测试、日志
4. **Git 规范**：主分支、分支命名、提交规范
5. **打包发布**：PyInstaller 打包规范

**模板文件**：
- CLAUDE_PROJECT_TEMPLATE.md — 项目规范模板
- PROJECT_SPEC_TEMPLATE.md — 特殊规范模板
- README_TEMPLATE.md — README 模板
- GITIGNORE_TEMPLATE.txt — .gitignore 模板

---

## 四、使用说明

### 4.1 全局配置

SmileGlobalConfig 会自动激活，确保：
- 所有交互使用中文
- 代码修改时同步更新文档
- 版本文档保持最新

### 4.2 项目开发

使用 SmileProjectConfig 规范进行项目开发：
1. 参考 eferences/ 目录下的模板创建项目文档
2. 遵循编码规范和 Git 规范
3. 完成后打包发布

---

## 五、相关资源

### 外部参考

- [D:\\Work\\Project 工作区](../Project/) — 包含多个桌面工具项目的通用规范
- [CLAUDE_PROJECT_TEMPLATE.md](../Project/CLAUDE_PROJECT_TEMPLATE.md) — 项目文档模板

### 内部资源

- AI_Skill/SmileGlobalConfig/SKILL.md — 全局中文配置详细说明
- AI_Skill/SmileProjectConfig/SKILL.md — 项目配置规范详细说明

---

## 六、开发环境

### 环境要求

- Python 3.10+
- 支持多种 AI Agent 平台

### 配置说明

1. **技能配置**：每个技能目录下的 SKILL.md 和 agents/ 配置
2. **中文支持**：所有界面和文档使用简体中文

---

## 七、注意事项

1. **配置路径**：不同 Agent 使用不同的配置路径，请确保路径正确
2. **中文支持**：所有界面和文档使用简体中文

---

## 八、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-22 | v2 | 添加 SmileGlobalConfig 和 SmileProjectConfig 技能 |
| 2026-08-22 | v1 | 初始版本 — 创建 AI-Development 工作区总览 |

---

*本工作区文档参照 D:\\Work\\Project 工作区的文档结构创建。*
