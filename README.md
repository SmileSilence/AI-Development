# AI-Development — AI 技能与配置工作区

> 本工作区用于管理 AI Agent 的可复用技能（`AI_Skill/`）、安装脚本与说明文档。
> 技能命名统一为 kebab-case 小写，支持 DSH / Codex / Claude 等多 Agent 加载。

---

## 一、工作区概述

- **AI_Skill/**：13 个可复用 AI 技能（技能源文件，唯一事实来源）
- **install-skills.ps1**：一键安装脚本（按 `skill-manifest.json` 安装到 `$CODEX_HOME/skills`）
- **skill-manifest.json**：技能安装清单
- **SKILL_LIST.md**：技能总览清单（含安装状态）
- **QUICK_INSTALL.md / INSTALL_README.md**：安装说明

---

## 二、技能清单

| 技能 | 分类 | 说明 |
|------|------|------|
| ai-coding-workflow | 编码开发 | AI 辅助编码完整工作流 |
| anget-manager | Agent 管理 | Agent 启动、会话整理/合并/同步与临时文件清理 |
| code-style | 代码规范 | 代码规范与代码风格指南 |
| deepseek-harness-plugin-creator | 插件开发 | dsh 插件开发 |
| mcp-auto-loader | Agent 管理 | 按需自动加载 MCP 服务器（15+） |
| skill-creator | 技能开发 | AI_Skill 技能开发工具 |
| smile-global-config | 全局配置 | 全局简体中文设置（安装后自动激活） |
| smile-know-collector | 知识管理 | 个人知识库收集、整理与提炼 |
| smile-project-config | 项目规范 | 通用项目结构、Git 规范、文档模板（语言无关） |
| ue-development | 游戏开发 | Unreal Engine 项目开发 |
| ue-plugin-development | 游戏开发 | UE 插件/扩展开发 |
| unity-development | 游戏开发 | Unity 项目开发 |
| unity-plugin-development | 游戏开发 | Unity 插件/Package 开发 |

---

## 三、目录结构

`
AI-Development/
├── AI_Skill/                        # 技能源文件目录（13 个技能，kebab-case 命名）
│   ├── ai-coding-workflow/
│   ├── anget-manager/
│   ├── code-style/
│   ├── deepseek-harness-plugin-creator/
│   ├── mcp-auto-loader/
│   ├── skill-creator/
│   ├── smile-global-config/
│   ├── smile-know-collector/
│   ├── smile-project-config/
│   ├── ue-development/
│   ├── ue-plugin-development/
│   ├── unity-development/
│   └── unity-plugin-development/
├── install-skills.ps1               # 一键安装脚本
├── skill-manifest.json              # 技能安装清单
├── SKILL_LIST.md                    # 技能总览清单
├── QUICK_INSTALL.md                 # 快速安装教程
└── INSTALL_README.md                # 完整安装说明
`

---

## 四、安装与使用

1. 克隆仓库：`git clone https://github.com/SmileSilence/AI-Development.git`
2. 一键安装：`powershell -ExecutionPolicy Bypass -File .\install-skills.ps1`
   - 可选参数：`-UseSymlink`（符号链接）、`-Force`（强制覆盖）
3. 按需安装单个技能：复制 `AI_Skill/<skill-name>` 到对应 Agent 的 skills 目录
   - Codex：`~/.codex/skills/`
   - DSH：`~/.agents/skills/`
   - Claude：`~/.claude/skills/`

详细说明见 `QUICK_INSTALL.md` 与 `INSTALL_README.md`。

---

## 五、开发环境

- Windows 11
- 支持多种 AI Agent 平台（DSH / Codex / Claude 等）

---

## 六、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-28 | v3 | 技能体系整理：全部技能统一为 kebab-case 命名并补齐规范（metadata、触发条件、openai.yaml）；新增 anget-manager、mcp-auto-loader；smile-* 三个技能改名；全环境（DSH/Codex/Claude）同步 13 个技能 |
| 2026-08-22 | v2 | 添加 SmileGlobalConfig 和 SmileProjectConfig 技能 |
| 2026-08-22 | v1 | 初始版本 — 创建 AI-Development 工作区总览 |
