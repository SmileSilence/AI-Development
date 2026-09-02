# 技能清单（Skill List）

> 整理日期：2026-09-02
> 环境：Windows 11 / DSH + Codex + Claude
> 用途：汇总当前环境全部可用技能及其安装状态

---

## 一、总览

| 类别 | 数量 | 说明 |
|------|------|------|
| 系统内置技能 | 6 | Codex 自带（`.codex/skills/.system/`） |
| 插件内置技能 | 3 | 随插件捆绑（browser / computer-use / visualize） |
| SmileXX 自有技能 | 11 | 源仓库 `AI_Skill/SmlieSkills/` 管理 |
| ├ 已在 skill-manifest.json 登记 | 11 | 安装脚本按清单驱动 |
| ├ 已安装到 `~/.agents/skills` | 11 | 可被 Codex、DSH、MiMo 共享加载 |
| ├ 已安装到 `~/.claude/skills` | 11 | 可被 Claude 加载 |

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
| coding-workflow | SmileXX | v1 | 编码开发 | AI 辅助编码工作流与通用代码规范（由 ai-coding-workflow + code-style 合并） | “生成代码”“审查重构”“编写测试”“代码规范” | ✅ 已安装 |
| auto-context-splitter | SmileXX | v1 | Agent 工具 | 自动检测上下文超限并智能分段处理长文本任务 | 上下文超限、长文本分段 | ✅ 已安装 |
| deepseek-harness-plugin-creator | SmileXX | v3 | 插件开发 | 创建、测试和发布 dsh 插件 | “创建 dsh 插件” | ✅ 已安装 |
| design-execution-document | SmileXX | v2 | 文档开发 | 创建设计+执行综合文档，确保完整可执行 | 需要设计+执行文档 | ✅ 已安装 |
| skill-creator | SmileXX | v6 | 技能开发 | 创建或维护 AI_Skill 技能 | 涉及 SKILL.md、openai.yaml | ✅ 已安装 |
| smile-global-config | SmileXX | v16 | 全局配置 | 全局简体中文配置 + AI Agent 管理（启动、文件卫生、会话同步；由 smile-global-config + anget-manager 合并） | 安装后自动激活 | ✅ 已安装 |
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

1. **源仓库现有 11 个技能**，全部 11 项已登记在 `skill-manifest.json`。
2. **命名规范**：全部技能名统一为 kebab-case 小写（DSH 仅加载 kebab-case 小写技能名）。
3. **合并与移除（2026-09-02）**：`ai-coding-workflow` 与 `code-style` 合并为 `coding-workflow`；`anget-manager` 内容并入 `smile-global-config`（v16）；删除 `mcp-auto-loader`、`smile-know-collector`。
4. **默认推荐**：共 11 项清单技能，其中 5 个默认安装（coding-workflow、auto-context-splitter、smile-global-config、unity-development、unity-plugin-development）、6 个按需安装；总览以 `SKILL_CATALOG.xlsx` 的“默认安装”列为准，自有技能脚本以 `skill-manifest.json` 的 `default_install` 字段执行。

## 七、技能管理工具

| 文件 | 用途 |
|------|------|
| `AI_Skill/install-skills.ps1` | 一键安装脚本：同步共享目录与 Claude 目录，并清理 Codex 重复副本 |
| `AI_Skill/skill-manifest.json` | 技能安装清单（11 项，源：local） |
| `AI_Skill/SKILL_CATALOG.xlsx` | 全部技能中文清单，包含“默认安装”栏与 Anget 执行规则 |
| `AI_Skill/README.md` | 自有与第三方技能目录规范 |
| `AI_Skill/OtherSkills/skill-manifest.json` | 第三方技能下载索引 |
| `AI_Skill/OtherSkills/OtherSkills.xlsx` | 第三方技能中文 Excel 清单 |

> 提示：在仓库根目录执行 `AI_Skill/install-skills.ps1`，即可按 manifest 同步安装清单内全部技能。
