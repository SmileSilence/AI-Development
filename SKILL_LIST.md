# 技能清单（Skill List）

> 整理日期：2026-08-28
> 环境：Windows 11 / DSH + Codex + Claude
> 用途：汇总当前环境全部可用技能及其安装状态

---

## 一、总览

| 类别 | 数量 | 说明 |
|------|------|------|
| 系统内置技能 | 6 | Codex 自带（`.codex/skills/.system/`） |
| 插件内置技能 | 3 | 随插件捆绑（browser / computer-use / visualize） |
| 用户自定义技能 | 13 | 源仓库 `AI_Skill/` 管理 |
| ├ 已安装到 `.codex/skills` | 13 | 可被 Codex 加载 |
| ├ 已安装到 `~/.agents/skills` | 13 | 可被 DSH 加载 |
| ├ 已安装到 `~/.claude/skills` | 13 | 可被 Claude 加载 |

---

## 二、系统内置技能

位置：`C:\Users\19163\.codex\skills\.system\`

| 技能名 | 描述 |
|--------|------|
| imagegen | 生成或编辑位图图像（照片、插画、贴图、UI 原型等） |
| openai-docs | 查询 Codex 模型/定价、定时任务、技能、设置及 OpenAI API/产品 等文档 |
| plugin-creator | 创建并搭建 Codex 插件目录（`.codex-plugin/plugin.json`） |
| review-agent | 对指定代码变更进行只读、缺陷优先审查，返回所有可操作发现 |
| skill-creator | 创建或更新 Codex 技能（含必要资源文件） |
| skill-installer | 从精选列表或 GitHub 仓库安装 Codex 技能 |

## 三、插件内置技能

位置：`C:\Users\19163\.codex\plugins\cache\openai-bundled\`

| 技能名 | 描述 |
|--------|------|
| browser:control-in-app-browser | 控制应用内浏览器：打开、导航、点击、输入、截图、本地 Web 测试 |
| computer-use | 通过 ChatGPT 控制 Windows 应用 |
| visualize | 在对话中创建可视化与交互式工具（图表、模拟器、UI 原型等） |

## 四、用户自定义技能

源仓库：`D:\Work\AI-Development\AI_Skill\`
安装位置：`C:\Users\19163\.codex\skills\`（同时已同步到 `~/.agents/skills`、`~/.claude/skills`）

| 技能名 | 版本 | 分类 | 描述 | 触发条件 | 安装状态 |
|--------|------|------|------|----------|----------|
| ai-coding-workflow | v4 | 编码开发 | AI 辅助编码完整工作流（需求分析→提示设计→生成→审查→测试→迭代） | “AI 帮我写代码”“用 AI 编码”等 | ✅ 已安装 |
| anget-manager | v4 | Agent 管理 | Agent 启动、会话整理/合并/同步与临时文件清理 | “启动 codex”“同步会话”“清理临时文件” | ✅ 已安装 |
| code-style | v5 | 代码规范 | 格式化、命名、注释、region 划分与代码审查 | “格式化代码”“代码规范”“代码审查” | ✅ 已安装 |
| deepseek-harness-plugin-creator | v2 | 插件开发 | 创建、开发、发布 DeepSeek Harness (dsh) 插件 | “创建 dsh 插件” | ✅ 已安装 |
| mcp-auto-loader | v3 | Agent 管理 | 按需自动加载 MCP 服务器（GitHub、playwright、firebase 等 15+） | “启动 github”“加载 playwright”“启用 MCP” | ✅ 已安装 |
| skill-creator | v4 | 技能开发 | 创建、开发、维护 AI_Skill 技能（kebab-case 命名规范） | “创建一个 skill”“开发技能” | ✅ 已安装 |
| smile-global-config | v13 | 全局配置 | 全局简体中文设置（语言、文档、代码注释、版本管理） | 安装后自动激活 | ✅ 已安装 |
| smile-know-collector | v3.5 | 知识管理 | 记录/检索/整理/提炼个人知识库 | “记录这个问题”“整理知识库”“SmileKnow” | ✅ 已安装 |
| smile-project-config | v6 | 项目规范 | 通用项目结构、Git 规范、文档模板与配置管理（语言无关） | “项目配置”“生成项目文档” | ✅ 已安装 |
| ue-development | v2 | 游戏开发 | Unreal Engine 项目开发（C++、蓝图、结构、构建部署） | “UE 开发”“虚幻引擎” | ✅ 已安装 |
| ue-plugin-development | v2 | 游戏开发 | UE 插件/扩展开发（模块、蓝图函数库、编辑器扩展） | “UE 插件开发” | ✅ 已安装 |
| unity-development | v2 | 游戏开发 | Unity 项目开发（C#、场景、结构、构建部署） | “Unity 开发”“Unity 项目” | ✅ 已安装 |
| unity-plugin-development | v2 | 游戏开发 | Unity 插件/Package 开发（程序集、编辑器扩展、Inspector） | “Unity 插件开发” | ✅ 已安装 |

## 五、安装状态与差异说明

1. **源仓库共有 13 个技能**，全部安装到 `.codex/skills`、`~/.agents/skills`、`~/.claude/skills`，三处与源仓库内容一致。
2. **命名规范**：全部技能名统一为 kebab-case 小写（DSH 仅加载 kebab-case 小写技能名）。
3. **版本同步**：各环境副本版本与源仓库一致，无差异。

## 六、技能管理工具

| 文件 | 用途 |
|------|------|
| `install-skills.ps1` | 一键安装脚本：按 `skill-manifest.json` 安装到 `$CODEX_HOME/skills` |
| `skill-manifest.json` | 技能安装清单（13 项，源：local） |
| `AI_Skill/README.md` | 技能开发规范与现有技能说明 |

> 提示：安装/更新技能时执行 `install-skills.ps1` 即可按 manifest 同步安装全部 13 个技能。
