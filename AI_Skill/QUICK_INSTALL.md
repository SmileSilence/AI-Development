# 快速安装教程（QUICK_INSTALL）

> 目标：在其他电脑上快速安装并使用以下 6 个核心技能
> 整理日期：2026-08-29
> 适用平台：Windows / Codex Desktop

## 一、快速安装清单

| 技能 | 版本 | 作用 |
|------|------|------|
| ai-coding-workflow | v6 | AI 辅助编码完整工作流 |
| code-style | v8 | 代码规范与风格指南 |
| mcp-auto-loader | v4 | 按需自动加载 MCP 服务器 |
| smile-global-config | v14 | 全局简体中文交互设置 |
| unity-development | v3 | Unity 项目开发指南 |
| unity-plugin-development | v3 | Unity 插件 / Package 开发指南 |

---

## 二、前置条件

1. **安装 Codex Desktop**：从官方渠道安装 Codex Desktop 应用。
2. **技能目录**：确认存在 `C:\Users\<你的用户名>\.agents\skills\`；Codex、DSH 和 MiMo 共用该目录。
3. **Git（可选）**：一键安装方式需要 Git，或直接下载仓库压缩包。

---

## 三、安装方式

### 方式一：一键安装（推荐，安装全部 13 个技能）

```powershell
# 1. 克隆仓库（私有仓库需认证，见"认证配置"）
git clone https://github.com/SmileSilence/AI-Development.git
cd AI-Development

# 2. 运行一键安装脚本
pwsh -File .\AI_Skill\install-skills.ps1
# 或仅安装总清单中标记为默认推荐的 7 个技能
pwsh -File .\AI_Skill\install-skills.ps1 -RecommendedOnly
# 可选参数：
#   -UseSymlink   使用符号链接（更新仓库即可同步技能，需管理员/开发者模式）
#   -Force        强制覆盖已存在的技能
#   -KeepCodexCopies  仅用于不扫描 .agents/skills 的旧版 Codex

# 3. 重启 Codex，使技能生效
```

### 方式二：只安装这 6 个技能（手动复制）

```powershell
$skills = @("ai-coding-workflow","code-style","mcp-auto-loader","smile-global-config","unity-development","unity-plugin-development")
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

---

## 四、各技能说明与触发方式

### 1. ai-coding-workflow（AI 编码工作流）
- **作用**：需求分析 → 提示设计 → 代码生成 → 审查 → 测试 → 迭代优化的完整流程
- **触发**：说「AI 帮我写代码」「用 AI 编码」「AI 辅助开发」
- **依赖**：无

### 2. code-style（代码规范）
- **作用**：命名约定、注释规范、代码格式与风格指南，保证代码一致性
- **触发**：说「格式化代码」「代码规范」「代码审查」
- **依赖**：无

### 3. mcp-auto-loader（MCP 自动加载）
- **作用**：按需自动启用 MCP 服务器（GitHub、playwright、firebase、context7 等 15+）
- **触发**：说「启动 github」「加载 playwright」「启用 MCP」
- **依赖**：需要先配置好对应的 MCP 服务器（Codex 设置中）

### 4. smile-global-config（全局中文设置）
- **作用**：所有回复、文档、代码注释统一使用简体中文，自动激活
- **触发**：安装后自动生效，无需手动调用
- **依赖**：无

### 5. unity-development（Unity 开发）
- **作用**：Unity 项目开发指导（C#、场景设计、结构管理、构建部署），自动检测 Unity 版本与技术栈并查对应文档
- **触发**：说「Unity 开发」「Unity 项目」「帮我写 Unity C#」
- **依赖**：无（推荐本机安装 Unity 编辑器）

### 6. unity-plugin-development（Unity 插件开发）
- **作用**：Unity 插件 / Package 开发（程序集定义、编辑器扩展、Inspector、ScriptableObject）
- **触发**：说「Unity 插件开发」「Unity Package」
- **依赖**：无（推荐本机安装 Unity 编辑器）

---

## 五、安装后验证

```powershell
# 1. 检查技能目录结构（每个技能须含 SKILL.md）
Get-ChildItem "$env:USERPROFILE\.agents\skills" -Directory | Select-Object Name

# 2. 重启 Codex Desktop
# 3. 测试触发，例如输入：「用 AI 帮我写一段代码」应激活 ai-coding-workflow
```

---

## 六、私有仓库认证配置

本仓库为私有仓库，克隆时需要认证：

| 方式 | 命令 |
|------|------|
| GitHub CLI（推荐） | `gh auth login` 后 `gh repo clone SmileSilence/AI-Development` |
| 个人访问令牌 PAT | `git clone https://github.com/SmileSilence/AI-Development.git`，用户名 `SmileSilence`，密码填 PAT |
| SSH 密钥 | `git clone git@github.com:SmileSilence/AI-Development.git` |

---

## 七、常见问题（FAQ）

1. **技能未加载**：重启 Codex Desktop；确认 `.agents/skills/<skill-name>/SKILL.md` 存在。
2. **路径错误**：检查 `CODEX_HOME` 环境变量是否指向自定义目录。
3. **符号链接失败**：`-UseSymlink` 需要管理员权限或开启 Windows 开发者模式。
4. **MCP 未生效**：确认已在 Codex 中配置对应 MCP 服务器后，再触发 mcp-auto-loader。
5. **克隆认证失败**：参考"六、私有仓库认证配置"，确保 PAT 含 `repo` 权限。

---

## 八、相关文件

| 文件 | 用途 |
|------|------|
| `AI_Skill/install-skills.ps1` | 一键安装脚本（按 `AI_Skill/skill-manifest.json` 安装） |
| `AI_Skill/skill-manifest.json` | 全部 13 个自有技能的安装清单 |
| `AI_Skill/SKILL_CATALOG.xlsx` | 全部技能中文总清单与 Anget 安装规则 |
| `AI_Skill/SmlieSkills/` | 自有技能源文件目录（发布者 SmileXX） |
| `AI_Skill/OtherSkills/skill-manifest.json` | 第三方技能下载索引；第三方源码不上传 |
| `AI_Skill/OtherSkills/OtherSkills.xlsx` | 第三方技能中文 Excel 清单 |
| `AI_Skill/INSTALL_README.md` | 完整安装说明与认证配置 |
