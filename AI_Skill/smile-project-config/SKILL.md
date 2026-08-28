---
name: smile-project-config
description: 项目配置规范：通用项目结构、Git 规范、项目文档模板（AGENTS.md/CLAUDE.md、PROJECT_SPEC.md、README.md、.gitignore）与配置管理，语言无关。当涉及 D:\Work\Project 工作区项目初始化、项目文档生成、Git 规范、目录结构约定时激活。
metadata:
  version: "v6"
  short-description: 通用项目配置规范
  category: 项目规范
---

# SmileProjectConfig — 项目配置规范

适用于 D:\Work\Project\ 工作区下所有项目的通用开发规范，与具体语言/技术栈无关（Python、TypeScript 等均适用）。

---

## 触发条件

### 自动触发
- 涉及 D:\Work\Project 工作区下的项目（新建、初始化、结构、规范）
- 用户要求生成/更新 AGENTS.md（CLAUDE.md）、PROJECT_SPEC.md、README.md、CHANGELOG
- 用户询问项目 Git 规范、目录结构、项目文档模板、配置管理
- 用户说「SmileProjectConfig」「项目配置」

### 不触发（避免误用）
- 代码风格、命名、注释、错误处理等编码规范 → 使用 code-style 技能
- AI 编码流程（需求分析 → 编码 → 测试 → 交付）→ 使用 ai-coding-workflow 技能
- 中文语言、文档同步、版本管理等全局通用规则 → 使用 SmileGlobalConfig 技能
- UE / Unity 项目 → 使用对应引擎技能

## 一、核心原则

本技能只约定「项目配置」层面的内容，其余通用规则由对应技能负责，不重复定义：

- **语言与沟通**：遵循 SmileGlobalConfig（中文交互、英文标识符、沟通风格）
- **代码风格**：遵循 code-style（命名、注释、错误处理、防御编程等）
- **编码流程**：遵循 ai-coding-workflow（需求分析、编码、测试、交付等）
- **文档同步**：项目功能/UI/流程变更后，同步更新 AGENTS.md / PROJECT_SPEC.md / README.md 并追加版本记录；工作区级规范变更更新本文档
- **版本记录**：项目文档版本号使用顺序号（v1、v2、v3...）递增，每次实质性修改后 +1 并追加变更记录

## 二、项目结构约定

所有项目遵循统一目录结构（按技术栈取舍）：

`
<项目名>/
├── <入口文件>          # 程序入口（如 main.py、src/index.ts）
├── <依赖清单>          # 依赖声明（如 requirements.txt、package.json）
├── AGENTS.md           # 项目规范（AI 助手行为指南）
├── PROJECT_SPEC.md     # 项目特殊规范（差异、已知问题、变更记录）
├── README.md           # 使用说明
├── .gitignore          # Git 忽略规则
│
├── src/ 或 app/ 或 core/   # 源代码
├── ui/                     # 界面代码（如有）
├── dist/                   # 构建产物（不提交 Git）
├── build/                  # 构建临时文件（不提交 Git）
├── resources/ 或 assets/   # 静态资源
└── output/                 # 运行时输出
`

## 三、通用规范

### 3.1 日志
- 应用统一使用日志组件输出，同时记录到文件和控制台（桌面应用）
- 日志级别：DEBUG（开发调试）、INFO（关键流程）、WARNING（可恢复异常）、ERROR（需关注的错误）

### 3.2 界面素材获取规范
- 项目涉及 UI 界面开发时，优先从网上通用素材库搜索、下载素材
- 常用免费素材库：
  - [Iconfont](https://www.iconfont.cn/) — 矢量图标库
  - [Flaticon](https://www.flaticon.com/) — 矢量图标与贴纸
  - [Material Icons](https://fonts.google.com/icons) — Google Material Design 图标
  - [Pexels](https://www.pexels.com/) / [Unsplash](https://unsplash.com/) — 免费商用图片
  - [Freepik](https://www.freepik.com/) — 矢量图、插画、PSD 素材
- 下载前确认素材的授权协议，确保合规使用
- 素材文件统一归类到项目 resources/ 或 assets/ 目录

## 四、Git 规范

- **主分支**：main
- **分支命名**：
  - feat/<描述> — 新功能
  - fix/<描述> — 修复
  - refactor/<描述> — 重构
  - docs/<描述> — 文档
- **提交粒度**：一个提交对应一个逻辑变更，不混入无关修改
- **提交信息**：中文祈使句，说明「做了什么」而非「改了什么文件」

## 五、项目文档模板

创建新项目或补充项目文档时，参考 references/ 目录下的模板生成：

1. 复制模板中的对应章节到 AGENTS.md / PROJECT_SPEC.md / README.md / .gitignore
2. 将 {项目名} 等占位符替换为实际内容
3. 按项目实际情况（技术栈、平台）填写各章节
4. 删除不适用的部分和占位说明

模板清单：

| 文件 | 用途 |
|------|------|
| CLAUDE_PROJECT_TEMPLATE.md | 项目规范文档（AGENTS.md / CLAUDE.md）模板 |
| PROJECT_SPEC_TEMPLATE.md | 项目特殊规范模板 |
| README_TEMPLATE.md | README 模板 |
| GITIGNORE_TEMPLATE.txt | .gitignore 模板 |

## 六、打包与发布

- 构建产物统一输出到 dist/ 目录
- 构建临时文件（build/ 等）不纳入版本控制，发布后清理
- 打包脚本统一命名（如 build.py / build.js），具体打包工具随技术栈选择

## 七、配置管理

| 项目 | 配置路径 |
|------|----------|
| ClaudeSettingsEditor | 编辑 ~/.Codex/settings.json |
| DeepSeekMonitor | ~/.deepseek_monitor/config.json |
| AudioSwitch | 无持久化配置（即用即走） |

## 八、注意事项

- 工作区项目面向 **Windows 平台**，部分功能依赖 Windows API
- 使用 Git Bash 作为 shell 环境，路径分隔符使用正斜杠 /
- 虚拟环境（venv/、.venv/）、依赖目录（node_modules/）、构建产物（dist/、build/）、缓存目录（__pycache__/ 等）不纳入版本控制
- 具体技术栈的依赖、环境要求以项目文档（README.md / PROJECT_SPEC.md）为准

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-28 | v6 | 技能名改为 kebab-case（smile-project-config），符合 DSH 加载规范 |
| 2026-08-28 | v5 | 通用化改造：去除 Python 专属内容（PEP 8、pytest、PyInstaller 等）；删除与 SmileGlobalConfig 重复的语言/文档同步规则；命名、错误处理、防御编程、测试等编码规范移交 code-style 与 ai-coding-workflow；AI 助手行为指南移交 ai-coding-workflow；保留并优化项目结构、Git 规范、文档模板、配置管理 |
| 2026-08-27 | v4 | 优化触发条件：限定 D:\Work\Project 工作区范围，补充不触发场景；修复 frontmatter 重复 metadata |
| 2026-07-25 | v3 | 新增 3.6 界面素材获取规范 |
| 2026-07-25 | v2 | 新增版本号规则（1.3）；新增 5.5 使用项目模板 |
| 2026-07-19 | v1 | 初始版本 |
