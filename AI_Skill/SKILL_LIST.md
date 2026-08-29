# 技能清单（Skill List）

> 整理日期：2026-08-29
> 环境：Windows 11 / DSH + Codex + Claude
> 用途：汇总当前环境全部可用技能及其安装状态

---

## 一、总览

| 类别 | 数量 | 说明 |
|------|------|------|
| 系统内置技能 | 6 | Codex 自带（`.codex/skills/.system/`） |
| 插件内置技能 | 3 | 随插件捆绑（browser / computer-use / visualize） |
| SmileXX 自有技能 | 13 | 源仓库 `AI_Skill/SmlieSkills/` 管理 |
| 第三方技能索引 | 1 | 仓库地址清单与 Excel 表格，源码不上传 |
| ├ 已安装到 `.codex/skills` | 0 | 不保留自定义重复副本，仅保留 `.system` |
| ├ 已安装到 `~/.agents/skills` | 13 | 可被 Codex、DSH、MiMo 共享加载 |
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

## 四、SmileXX 自有技能

源仓库：`D:\Work\AI-Development\AI_Skill\SmlieSkills\`
安装位置：`C:\Users\19163\.agents\skills\`（共享）与 `~/.claude/skills`；不再复制到 `.codex/skills`

| 技能名 | 发布者 | 版本 | 分类 | 描述 | 触发条件 | 安装状态 |
|--------|--------|------|------|------|----------|----------|
| ai-coding-workflow | SmileXX | v6 | 编码开发 | AI 辅助编码完整工作流 | “生成代码”“修复 bug”“编写测试” | ✅ 已安装 |
| anget-manager | SmileXX | v8 | Agent 管理 | Agent 启动、技能安装、会话同步与临时文件清理 | “启动 codex”“同步会话”“按清单安装” | ✅ 已安装 |
| code-style | SmileXX | v8 | 代码规范 | 通用代码风格、命名、注释与审查规范 | 编写、格式化、重构或审查代码 | ✅ 已安装 |
| deepseek-harness-plugin-creator | SmileXX | v3 | 插件开发 | 创建、测试和发布 dsh 插件 | “创建 dsh 插件” | ✅ 已安装 |
| mcp-auto-loader | SmileXX | v4 | Agent 管理 | 按需搜索、安装或启用 MCP 服务器 | 需要 GitHub、浏览器自动化等外部服务 | ✅ 已安装 |
| skill-creator | SmileXX | v6 | 技能开发 | 创建或维护 AI_Skill 技能 | 涉及 SKILL.md、openai.yaml | ✅ 已安装 |
| smile-global-config | SmileXX | v14 | 全局配置 | 全局简体中文设置 | 安装后自动激活 | ✅ 已安装 |
| smile-know-collector | SmileXX | v3.6 | 知识管理 | 个人知识库管理 | “记录问题”“整理知识库”“SmileKnow” | ✅ 已安装 |
| smile-project-config | SmileXX | v7 | 项目规范 | 项目结构、Git、文档模板与配置 | D:\Work\Project 项目配置任务 | ✅ 已安装 |
| ue-development | SmileXX | v3 | 游戏开发 | Unreal Engine 项目开发 | UE 项目、C++、蓝图、构建 | ✅ 已安装 |
| ue-plugin-development | SmileXX | v3 | 游戏开发 | UE 插件与扩展开发 | 模块、编辑器扩展、蓝图函数库 | ✅ 已安装 |
| unity-development | SmileXX | v3 | 游戏开发 | Unity 项目开发 | Unity、C#、场景、构建 | ✅ 已安装 |
| unity-plugin-development | SmileXX | v3 | 游戏开发 | Unity 插件与 Package 开发 | asmdef、编辑器扩展、Inspector | ✅ 已安装 |

## 五、第三方技能索引

第三方技能清单位于 `AI_Skill/OtherSkills/skill-manifest.json` 和 `AI_Skill/OtherSkills/OtherSkills.xlsx`。压缩包、克隆源码和本地适配文档不进入 Git，仅根据清单中的仓库地址与描述在其他环境按需下载。

| 技能名 | 发布者 | 描述 | 仓库地址 |
|--------|--------|------|----------|
| book-to-skill | virgiliojr94 | 将书籍或文档转换为结构化、按需加载的 Agent 技能 | https://github.com/virgiliojr94/book-to-skill |

## 六、安装状态与差异说明

1. **源仓库共有 13 个技能**，同步到 `~/.agents/skills` 与 `~/.claude/skills`；`.codex/skills` 不保留同名副本。
2. **命名规范**：全部技能名统一为 kebab-case 小写（DSH 仅加载 kebab-case 小写技能名）。
3. **版本同步**：各环境副本版本与源仓库一致，无差异。
4. **默认推荐**：总计 14 个技能，其中 7 个默认安装、7 个按需安装；总览以 `SKILL_CATALOG.xlsx` 的“默认安装”列为准，自有技能脚本以 `skill-manifest.json` 的 `default_install` 字段执行。

## 七、技能管理工具

| 文件 | 用途 |
|------|------|
| `AI_Skill/install-skills.ps1` | 一键安装脚本：同步共享目录与 Claude 目录，并清理 Codex 重复副本 |
| `AI_Skill/skill-manifest.json` | 技能安装清单（13 项，源：local） |
| `AI_Skill/SKILL_CATALOG.xlsx` | 全部技能中文清单，包含“默认安装”栏与 Anget 执行规则 |
| `AI_Skill/README.md` | 自有与第三方技能目录规范 |
| `AI_Skill/OtherSkills/skill-manifest.json` | 第三方技能下载索引 |
| `AI_Skill/OtherSkills/OtherSkills.xlsx` | 第三方技能中文 Excel 清单 |

> 提示：在仓库根目录执行 `AI_Skill/install-skills.ps1`，即可按 manifest 同步安装全部 13 个技能。
