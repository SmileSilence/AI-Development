# 快速安装教程（QUICK_INSTALL）

> 目标：在其他电脑上快速安装并使用默认推荐技能
> 整理日期：2026-09-02
> 适用平台：Windows / Codex Desktop

## 一、快速安装清单

| 技能 | 版本 | 作用 |
|------|------|------|
| coding-workflow | v1 | AI 辅助编码工作流与通用代码规范 |
| auto-context-splitter | v1 | 长上下文自动检测与分段处理 |
| smile-global-config | v17 | 全局中文配置与 Agent 管理 |
| unity-development | v3 | Unity 项目开发指南 |
| unity-plugin-development | v3 | Unity 插件 / Package 开发指南 |

---

## 二、前置条件

1. **安装 Codex Desktop**：从官方渠道安装 Codex Desktop 应用。
2. **技能目录**：确认存在 `C:\Users\<你的用户名>\.agents\skills\`；Codex、DSH 和 MiMo 共用该目录。
3. **Git（可选）**：一键安装方式需要 Git，或直接下载仓库压缩包。

---

## 三、安装方式

### 方式一：一键安装（推荐）

```powershell
# 1. 克隆公开仓库（无需 GitHub 登录或 PAT）
git clone https://github.com/SmileSilence/AI-Development.git
cd AI-Development

# 2. 安装总清单中默认推荐的 5 个技能
pwsh -File .\AI_Skill\install-skills.ps1 -RecommendedOnly
# 或安装全部 11 个自有技能
pwsh -File .\AI_Skill\install-skills.ps1
# 可选参数：
#   -UseSymlink   使用符号链接（更新仓库即可同步技能，需管理员/开发者模式）
#   -Force        强制覆盖已存在的技能
#   -KeepCodexCopies  仅用于不扫描 .agents/skills 的旧版 Codex

# 3. 重启 Codex，使技能生效
```

### 方式二：只安装默认推荐的 5 个技能（手动复制）

```powershell
$skills = @("coding-workflow","auto-context-splitter","smile-global-config","unity-development","unity-plugin-development")
$src = ".\AI_Skill\SmlieSkills"
$dst = "$env:USERPROFILE\.agents\skills"
foreach ($s in $skills) {
    Copy-Item -Path (Join-Path $src $s) -Destination $dst -Recurse -Force
    Write-Host "已安装: $s" -ForegroundColor Green
}
```

### 方式三：单技能安装（示例）

```powershell
# 只安装 unity-development
Copy-Item -Path ".\AI_Skill\SmlieSkills\unity-development" -Destination "$env:USERPROFILE\.agents\skills\" -Recurse -Force
```

DSH 插件开发可按需复制 `SmlieSkills/dsh-plugin-creator` 到共享目录，并另行复制到 `~/.claude/skills/`。当前版本为 1.1.1，支持可安装插件包和会话内动态插件；它不在默认推荐的 5 项中。升级旧版时，先验证新副本完整，再清理 `deepseek-harness-plugin-creator` 旧目录；`OtherSkills/cordis-plugin-development` 原文不单独安装。

---

## 四、各技能说明与触发方式

### 1. coding-workflow（AI 编码工作流与代码规范）
- **作用**：覆盖需求分析、代码生成、审查、测试、交付，以及命名、注释、格式和错误处理等通用规范
- **触发**：编写、审查、重构、修复或规范化代码时自动使用
- **依赖**：无

### 2. auto-context-splitter（长上下文分段）
- **作用**：检测上下文压力，并将适合拆分的长文本任务分段处理
- **触发**：处理超长文本或上下文接近限制时自动使用
- **依赖**：无

### 3. smile-global-config（全局配置与 Agent 管理）
- **作用**：统一中文交互、文档规范、Agent 管理、任务并行协作和会话同步规则
- **触发**：安装后自动生效，无需手动调用
- **依赖**：无

### 4. unity-development（Unity 开发）
- **作用**：Unity 项目开发指导（C#、场景设计、结构管理、构建部署），自动检测 Unity 版本与技术栈并查对应文档
- **触发**：说「Unity 开发」「Unity 项目」「帮我写 Unity C#」
- **依赖**：无（推荐本机安装 Unity 编辑器）

### 5. unity-plugin-development（Unity 插件开发）
- **作用**：Unity 插件 / Package 开发（程序集定义、编辑器扩展、Inspector、ScriptableObject）
- **触发**：说「Unity 插件开发」「Unity Package」
- **依赖**：无（推荐本机安装 Unity 编辑器）

---

## 五、安装后验证

```powershell
# 1. 检查技能目录结构（每个技能须含 SKILL.md）
Get-ChildItem "$env:USERPROFILE\.agents\skills" -Directory | Select-Object Name

# 2. 重启 Codex Desktop
# 3. 测试触发，例如输入：「用 AI 帮我写一段代码」应激活 coding-workflow
```

---

## 六、公开仓库下载与更新

本仓库已公开，HTTPS 克隆、拉取和下载 ZIP 均不需要 GitHub 登录、PAT 或 SSH 密钥：

```powershell
# 首次下载
git clone https://github.com/SmileSilence/AI-Development.git

# 已克隆仓库更新
git -C .\AI-Development pull
```

仓库地址：https://github.com/SmileSilence/AI-Development

---

## 七、常见问题（FAQ）

1. **技能未加载**：重启 Codex Desktop；确认 `.agents/skills/<skill-name>/SKILL.md` 存在。
2. **路径错误**：检查 `CODEX_HOME` 环境变量是否指向自定义目录。
3. **符号链接失败**：`-UseSymlink` 需要管理员权限或开启 Windows 开发者模式。
4. **克隆失败**：公开仓库无需认证；请检查网络、代理、Git 安装状态及仓库地址是否正确。

---

## 八、相关文件

| 文件 | 用途 |
|------|------|
| `AI_Skill/install-skills.ps1` | 一键安装脚本（按 `AI_Skill/skill-manifest.json` 安装） |
| `AI_Skill/skill-manifest.json` | 全部 11 个自有技能的安装清单 |
| `AI_Skill/SKILL_CATALOG.xlsx` | 全部技能中文总清单与 Anget 安装规则 |
| `AI_Skill/SmlieSkills/` | 自有技能源文件目录（发布者 SmileXX） |
| `AI_Skill/OtherSkills/skill-manifest.json` | 第三方技能下载索引；第三方源码不上传 |
| `AI_Skill/OtherSkills/OtherSkills.xlsx` | 第三方技能中文 Excel 清单 |
| `AI_Skill/INSTALL_README.md` | 完整安装与故障排除说明 |
