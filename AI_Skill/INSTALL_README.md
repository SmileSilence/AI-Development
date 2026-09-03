# AI技能安装清单

本目录包含AI技能的安装清单和一键安装脚本，方便在其他电脑上快速部署技能。

## 文件说明

- `skill-manifest.json` - 技能清单文件，包含所有可用技能的信息
- `AI_Skill/SKILL_CATALOG.xlsx` - 带“默认安装”栏的全部技能总清单，供 Anget 读取
- `install-skills.ps1` - 一键安装脚本（PowerShell）
- `AI_Skill/SmlieSkills/` - 自有技能源文件目录，发布者统一为 `SmileXX`
- `AI_Skill/OtherSkills/skill-manifest.json` - 第三方技能仓库地址与描述清单
- `AI_Skill/OtherSkills/OtherSkills.xlsx` - 便于人工查看和维护的第三方技能 Excel 清单

## 快速开始

### 方法一：一键安装（推荐）

1. 免认证克隆公开仓库：
   ```powershell
   git clone https://github.com/SmileSilence/AI-Development.git
   cd AI-Development
   ```
2. 打开PowerShell，进入本目录
3. 使用 PowerShell 7（`pwsh`）运行安装命令：

```powershell
# 基本安装（同步共享目录与 Claude 目录，并清理 Codex 重复副本）
.\AI_Skill\install-skills.ps1

# 使用符号链接（便于同步更新）
.\AI_Skill\install-skills.ps1 -UseSymlink

# 强制覆盖已存在的技能
.\AI_Skill\install-skills.ps1 -Force

# 仅安装总清单中默认推荐的技能
.\AI_Skill\install-skills.ps1 -RecommendedOnly

# 仅兼容不扫描 .agents/skills 的旧版 Codex
.\AI_Skill\install-skills.ps1 -KeepCodexCopies
```

### 方法二：手动安装

1. 将 `AI_Skill/SmlieSkills/` 目录下的技能文件夹复制到 `~/.agents/skills/` 目录
2. Claude 用户另行复制到 `~/.claude/skills/`
3. 重启目标 Agent 以加载新技能

## 技能列表

| 技能名称 | 描述 |
|----------|------|
| coding-workflow | AI 辅助编码工作流与通用代码规范 |
| auto-context-splitter | 长上下文自动检测与分段处理 |
| dsh-plugin-creator | DSH 插件包与 Cordis 会话内动态插件开发（1.1.1） |
| design-execution-document | 设计与执行综合文档创建 |
| skill-creator | 技能创建工具 |
| smile-global-config | 全局中文配置与 Agent 管理 |
| smile-project-config | 项目配置规范 |
| ue-development | Unreal Engine开发 |
| ue-plugin-development | UE插件开发 |
| unity-development | Unity开发 |
| unity-plugin-development | Unity插件开发 |

## 注意事项

DSH 技能已由 `deepseek-harness-plugin-creator` 更名为 `dsh-plugin-creator`。升级时先复制新目录到共享技能目录及 Claude 目录，确认文件完整后再移除同一加载目录中的旧名称副本。官方 `cordis-plugin-development` 原文只作参考，不单独安装。当前通用安装脚本不负责这项旧名称迁移。

1. **安装目录**：默认同步到 `~/.agents/skills/` 与 `~/.claude/skills/`；`.codex/skills/.system` 保持不变
2. **符号链接**：使用 `-UseSymlink` 参数需要管理员权限或开启开发者模式
3. **更新技能**：使用符号链接方式安装后，更新本仓库即可同步更新技能
4. **备份**：安装前会备份已存在的技能（使用 `-Force` 参数时）
5. **第三方技能**：根据 `OtherSkills/skill-manifest.json` 或 Excel 清单中的仓库地址下载；第三方源码与本地适配文档不上传本仓库

## 环境要求

- PowerShell 7+（脚本使用无 BOM 的 UTF-8 中文文本）
- Codex Desktop 应用

## 故障排除

1. **权限不足**：以管理员身份运行PowerShell，或开启开发者模式
2. **路径不存在**：检查 `$CODEX_HOME` 环境变量是否正确设置
3. **技能未加载**：重启Codex应用，或检查技能目录结构是否正确

## 更新日志

- 2026-09-03：更新 DSH 插件开发技能名称、双流程和旧副本迁移说明；中文整合版为 1.1.1
- 2026-09-02：仓库改为公开访问；移除私有仓库认证教程，更新为免认证克隆与拉取说明，并同步当前 11 个自有技能和 5 个默认推荐技能
- 2026-08-29：删除重复的 skill-catalog.json；全部技能总览与默认推荐统一由 Excel 维护，自有技能安装由 skill-manifest.json 驱动
- 2026-08-29：新增全部技能 Excel 总清单、默认安装字段及推荐安装模式
- 2026-08-29：新增第三方技能 Excel 清单，并与第三方仓库索引同步维护
- 2026-08-29：拆分 `SmlieSkills` 与 `OtherSkills`；自有技能发布者统一为 SmileXX；第三方技能仅上传索引清单
- 2026-08-29：技能描述精简；改用 `.agents/skills` 共享目录；避免 Codex `skill-catalog` 重复注册
- 2026-08-28：技能名统一为 kebab-case（mcp-auto-loader、smile-global-config、smile-project-config、smile-know-collector），技能总数调整为 13 个，全环境（DSH/Codex/Claude）同步
- 2026-08-24：删除 mode-manager 技能，技能总数调整为 12 个
- 2026-08-24：同步所有技能至最新版本，新增 SmileKnow-Collector，新增 QUICK_INSTALL.md 快速安装教程
- 2026-08-22：初始版本，包含12个AI技能

## 公开仓库下载与更新

本仓库已公开。通过 HTTPS 克隆、拉取或下载 ZIP 时，不需要 GitHub 登录、PAT 或 SSH 密钥。

```powershell
# 首次克隆
git clone https://github.com/SmileSilence/AI-Development.git

# 更新已有仓库
git -C .\AI-Development pull

# 仅安装默认推荐技能
pwsh -File .\AI-Development\AI_Skill\install-skills.ps1 -RecommendedOnly
```

仓库主页：https://github.com/SmileSilence/AI-Development

### 故障排除

1. **无法访问仓库**：确认仓库地址拼写正确，并检查网络与代理设置。
2. **Git 不可用**：运行 `git --version` 检查安装状态，或直接从仓库主页下载 ZIP。
3. **克隆缓慢**：检查网络代理设置，必要时稍后重试。
