# 技能清单（Skill List）

> 整理日期：2026-08-24
> 环境：Windows 11 / Codex Desktop
> 用途：汇总当前环境全部可用技能及其安装状态

---

## 一、总览

| 类别 | 数量 | 说明 |
|------|------|------|
| 系统内置技能 | 6 | Codex 自带（`.codex/skills/.system/`） |
| 插件内置技能 | 3 | 随插件捆绑（browser / computer-use / visualize） |
| 用户自定义技能 | 12 | 源仓库 `AI_Skill/` 管理 |
| ├ 已安装到 `.codex/skills` | 11 | 可被 Codex 加载 |
| ├ 仅存在于源仓库 | 1 | deepseek-harness-plugin-creator |

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
安装位置：`C:\Users\19163\.codex\skills\`

| 技能名 | 版本 | 领域 | 描述 | 触发条件 | 安装状态 |
|--------|------|------|------|----------|----------|
| ai-coding-workflow | v1 | 编码流程 | AI 辅助编码完整工作流（需求分析、代码生成、审查、测试、迭代） | “AI 帮我写代码”“用 AI 编码”等 | ✅ 已安装 |
| code-style | v1 | 代码规范 | 代码规范、编码标准、风格指南、命名与注释规范 | “格式化代码”“代码规范”“代码审查” | ✅ 已安装 |
| McpAutoLoader | v2 | MCP 工具 | 按需自动加载 MCP 服务器（GitHub、playwright、firebase 等 15+） | “启动 github”“加载 playwright”“启用 MCP” | ✅ 已安装 |
| skill-creator | v1 | 技能开发 | 创建、开发、维护 AI_Skill 技能，遵循开发规范 | “创建一个 skill”“开发技能” | ✅ 已安装 |
| SmileGlobalConfig | v10 | 全局配置 | 全局简体中文设置（语言、文档、代码注释、版本管理） | 安装后自动激活 | ✅ 已安装 |
| SmileKnow-Collector | v3.2 | 知识管理 | 收集整理问题与解决方案，形成个人知识库、提炼习惯 | “记录这个问题”“知识收集”“整理知识库” | ✅ 已安装 |
| SmileProjectConfig | v1 | 项目配置 | Python 桌面项目结构、编码/Git/打包规范模板 | 项目初始化、文档生成 | ✅ 已安装 |
| ue-development | v1 | 游戏开发 | Unreal Engine 项目开发（C++、蓝图、结构、构建部署） | “UE 开发”“虚幻引擎” | ✅ 已安装 |
| ue-plugin-development | v1 | 游戏开发 | UE 插件/扩展开发（模块、蓝图函数库、编辑器扩展） | “UE 插件开发” | ✅ 已安装 |
| unity-development | v1 | 游戏开发 | Unity 项目开发（C#、场景、结构、构建部署） | “Unity 开发”“Unity 项目” | ✅ 已安装 |
| unity-plugin-development | v1 | 游戏开发 | Unity 插件/Package 开发（程序集、编辑器扩展、Inspector） | “Unity 插件开发” | ✅ 已安装 |
| deepseek-harness-plugin-creator | v1 | 插件开发 | 创建、开发、发布 DeepSeek Harness (dsh) 插件 | “创建 dsh 插件” | ⚠️ 仅源仓库 |

## 五、安装状态与差异说明

1. **源仓库共有 12 个技能**，其中 11 个已安装到 `.codex/skills`。
2. **未安装**：`deepseek-harness-plugin-creator`（`skill-manifest.json` 已登记，但未同步安装）。
3. **版本差异**：
   - `SmileGlobalConfig`：安装副本 **v10** > 源仓库 **v5**，源文件需同步更新。
   - `SmileKnow-Collector`：源仓库 **v3.3** > 安装副本 **v3.2**，安装副本需重新安装。
4. **`.agents/skills` 另有一份副本（9 个）**：缺少 `SmileKnow-Collector`、`deepseek-harness-plugin-creator`。
5. **清单文件 `skill-manifest.json`（12 项）**：包含 deepseek-harness-plugin-creator，但缺少 SmileKnow-Collector，建议补全。

## 六、技能管理工具

| 文件 | 用途 |
|------|------|
| `install-skills.ps1` | 一键安装脚本：按 `skill-manifest.json` 安装到 `$CODEX_HOME/skills` |
| `skill-manifest.json` | 技能安装清单（源：local） |
| `AI_Skill/README.md` | 技能开发规范与现有技能说明 |

> 建议：补齐 manifest 中的 SmileKnow-Collector，重新执行 `install-skills.ps1` 即可同步安装 deepseek-harness-plugin-creator 并更新版本。