# 技能清单（Skill List）

> 整理日期：2026-09-11（smilexx- 前缀统一、技能精简至 9 个、book-to-skill 已安装；版本号与实际 SKILL.md 对齐）
> 环境：Windows 11 / DSH + Codex + Claude
> 用途：汇总当前环境全部可用技能及其安装状态

---

## 一、总览

| 类别 | 数量 | 说明 |
|------|------|------|
| 系统内置技能 | 6 | Codex 自带（`.codex/skills/.system/`） |
| 插件内置技能 | 3 | 随插件捆绑（browser / computer-use / visualize） |
| SmileXX 自有技能 | 9 | 源仓库 `AI_Skill/SmlieSkills/` 管理 |
| ├ 已在 skill-manifest.json 登记 | 9 | 安装脚本按清单驱动 |
| ├ 已安装到 `~/.agents/skills` | 10 | 9 个自有技能 + book-to-skill，可被 Codex、DSH、MiMo 共享加载 |
| ├ 已安装到 `~/.claude/skills` | 10 | 9 个自有技能 + book-to-skill，可被 Claude 加载 |

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
| smilexx-coding-workflow | SmileXX | v1.3 | 编码开发 | AI 辅助编码工作流与通用代码规范（由 ai-coding-workflow + code-style 合并） | “生成代码”“审查重构”“编写测试”“代码规范” | ✅ 已安装 |
| smilexx-dsh-plugin-creator | SmileXX | 1.3.0 | 插件开发 | DSH 可安装插件包与 Cordis 会话内动态插件开发、调试及验证 | “创建 dsh 插件”“添加会话临时界面”“修改 @pluginId” | ✅ 已安装 |
| smilexx-skill-creator | SmileXX | v8 | 技能开发 | 创建或维护 AI_Skill 技能 | 涉及 SKILL.md、openai.yaml | ✅ 已安装 |
| smilexx-global-config | SmileXX | v21 | 全局配置 | 全局简体中文配置 + AI Agent 管理（启动、文件卫生、会话同步；由 smilexx-global-config + anget-manager 合并） | 安装后自动激活 | ✅ 已安装 |
| smilexx-project-config | SmileXX | v7.3 | 项目规范 | 项目结构、Git、文档模板与配置 | D:\Work\Project 项目配置任务 | ✅ 已安装 |
| smilexx-ue-development | SmileXX | v3.2 | 游戏开发 | Unreal Engine 项目开发 | UE 项目、C++、蓝图、构建 | ✅ 已安装 |
| smilexx-ue-plugin-development | SmileXX | v3.2 | 游戏开发 | UE 插件与扩展开发 | 模块、编辑器扩展、蓝图函数库 | ✅ 已安装 |
| smilexx-unity-development | SmileXX | v3.2 | 游戏开发 | Unity 项目开发 | Unity、C#、场景、构建 | ✅ 已安装 |
| smilexx-unity-plugin-development | SmileXX | v3.2 | 游戏开发 | Unity 插件与 Package 开发 | asmdef、编辑器扩展、Inspector | ✅ 已安装 |

## 五、第三方技能索引

第三方技能清单位于 `AI_Skill/OtherSkills/skill-manifest.json` 和 `AI_Skill/OtherSkills/OtherSkills.xlsx`。压缩包、克隆源码和本地适配文档不进入 Git；book-to-skill 已于 2026-09-11 从官方仓库安装到共享目录与 Claude 目录，其余第三方按需下载。

| 技能名 | 发布者 | 描述 | 仓库地址 |
|--------|--------|------|----------|
| book-to-skill | virgiliojr94 | 将书籍或文档转换为结构化、按需加载的 Agent 技能 | https://github.com/virgiliojr94/book-to-skill |
| cordis-plugin-development | DeepSeek | 官方动态插件开发参考，已合入 smilexx-dsh-plugin-creator；不单独安装 | https://github.com/deepseek-ai/deepseek-harness |

## 六、安装状态与差异说明

1. **源仓库现有 9 个技能**，全部 9 项已登记在 `skill-manifest.json`。
2. **命名规范**：全部技能名统一为 kebab-case 小写（DSH 仅加载 kebab-case 小写技能名）。
3. **合并与移除（2026-09-02）**：`ai-coding-workflow` 与 `code-style` 合并为 `smilexx-coding-workflow`；`anget-manager` 内容并入 `smilexx-global-config`（v16）；删除 `mcp-auto-loader`、`smilexx-know-collector`。
4. **默认推荐**：共 9 项清单技能，其中 4 个默认安装（smilexx-coding-workflow、smilexx-global-config、smilexx-unity-development、smilexx-unity-plugin-development）、5 个按需安装；总览以 `SKILL_CATALOG.xlsx` 的“默认安装”列为准，自有技能脚本以 `skill-manifest.json` 的 `default_install` 字段执行。
5. **DSH 技能升级（2026-09-03）**：`deepseek-harness-plugin-creator` 更名并整合为 `smilexx-dsh-plugin-creator` 1.1.0；按插件包与会话内动态插件分流，安装到共享目录和 Claude 目录。官方原文仅保留在第三方来源目录。
6. **版本号同步（2026-09-03）**：11 个自有技能均补充 `metadata.platforms` / `metadata.keywords`（vX.1 系列）；本清单、README 与 `SKILL_CATALOG.xlsx` 的版本号统一到各 SKILL.md 实际版本，smilexx-dsh-plugin-creator 更新为 1.1.1。
7. **复核对齐（2026-09-08）**：核对各 SKILL.md frontmatter，更新三处滞后版本号：smilexx-global-config v17.1→v19、smilexx-project-config v7.1→v7.3、smilexx-design-execution-document v2.1→v2.2。源仓库、`~/.agents/skills` 与 `~/.claude/skills` 三处目录一致（各 11 个技能，无多余副本）。
8. **兼容性规范（2026-09-10）**：smilexx-dsh-plugin-creator 升级至 1.2.0，新增「保持横向兼容」共同工作规范第 7 条与 `references/compatibility.md`（开发/修改插件时不影响其他已装插件）。
9. **编码新规（2026-09-10）**：smilexx-coding-workflow 升级至 v1.2，新增「变更安全」（修改不影响其他功能）与「代码复用」（单一入口/DRY）通用规范。
10. **规划澄清新规（2026-09-10）**：smilexx-global-config 升级至 v20；设计阶段和 Plan 模式先查明可发现事实，仍有影响方案的关键疑问时必须询问用户，并说明提问原因及答案影响的方案决策。

11. **前缀统一与技能精简（2026-09-11）**：自有技能前缀由 `smile-` 调整为 `smilexx-`（9 个）；删除 auto-context-splitter 与 design-execution-document（线上仓库随本次提交移除）；安装第三方技能 book-to-skill（现共 10 个技能在线）。

## 七、技能管理工具

| 文件 | 用途 |
|------|------|
| `AI_Skill/install-skills.ps1` | 一键安装脚本：同步共享目录与 Claude 目录，并清理 Codex 重复副本 |
| `AI_Skill/skill-manifest.json` | 技能安装清单（9 项，源：local） |
| `AI_Skill/SKILL_CATALOG.xlsx` | 全部技能中文清单，包含“默认安装”栏与 Anget 执行规则 |
| `AI_Skill/README.md` | 自有与第三方技能目录规范 |
| `AI_Skill/OtherSkills/skill-manifest.json` | 第三方技能下载索引 |
| `AI_Skill/OtherSkills/OtherSkills.xlsx` | 第三方技能中文 Excel 清单 |

> 提示：在仓库根目录执行 `AI_Skill/install-skills.ps1`，即可按 manifest 同步安装清单内全部技能。
