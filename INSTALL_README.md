# AI技能安装清单

本目录包含AI技能的安装清单和一键安装脚本，方便在其他电脑上快速部署技能。

## 文件说明

- `skill-manifest.json` - 技能清单文件，包含所有可用技能的信息
- `install-skills.ps1` - 一键安装脚本（PowerShell）
- `AI_Skill/` - 技能源文件目录

## 快速开始

### 方法一：一键安装（推荐）

1. 克隆或下载本仓库
2. 打开PowerShell，进入本目录
3. 运行安装命令：

```powershell
# 基本安装（复制技能到Codex目录）
.\install-skills.ps1

# 使用符号链接（便于同步更新）
.\install-skills.ps1 -UseSymlink

# 强制覆盖已存在的技能
.\install-skills.ps1 -Force
```

### 方法二：手动安装

1. 将 `AI_Skill/` 目录下的技能文件夹复制到 `$CODEX_HOME/skills/` 目录
2. 重启Codex以加载新技能

## 技能列表

| 技能名称 | 描述 |
|----------|------|
| ai-coding-workflow | AI辅助编码工作流程 |
| code-style | 代码规范指南 |
| deepseek-harness-plugin-creator | DeepSeek Harness插件创建 |
| McpAutoLoader | MCP服务器自动加载 |
| mode-manager | AI Agent模式管理 |
| skill-creator | 技能创建工具 |
| SmileGlobalConfig | 全局中文设置 |
| SmileProjectConfig | 项目配置规范 |
| SmileKnow-Collector | 个人知识库收集与整理 |
| ue-development | Unreal Engine开发 |
| ue-plugin-development | UE插件开发 |
| unity-development | Unity开发 |
| unity-plugin-development | Unity插件开发 |

## 注意事项

1. **安装目录**：默认安装到 `$CODEX_HOME/skills/`，可通过环境变量 `CODEX_HOME` 自定义
2. **符号链接**：使用 `-UseSymlink` 参数需要管理员权限或开启开发者模式
3. **更新技能**：使用符号链接方式安装后，更新本仓库即可同步更新技能
4. **备份**：安装前会备份已存在的技能（使用 `-Force` 参数时）

## 环境要求

- Windows PowerShell 5.1+ 或 PowerShell Core 7+
- Codex Desktop 应用

## 故障排除

1. **权限不足**：以管理员身份运行PowerShell，或开启开发者模式
2. **路径不存在**：检查 `$CODEX_HOME` 环境变量是否正确设置
3. **技能未加载**：重启Codex应用，或检查技能目录结构是否正确

## 更新日志

- 2026-08-24：同步所有技能至最新版本，新增 SmileKnow-Collector，新增 QUICK_INSTALL.md 快速安装教程
- 2026-08-22：初始版本，包含12个AI技能

## 私有仓库认证配置

本仓库为私有仓库，拉取时需要身份验证。以下是几种配置方式：

### 方式一：使用个人访问令牌（PAT）✅ 推荐

1. **获取PAT**：
   - 访问 https://github.com/settings/tokens
   - 点击"Generate new token"
   - 选择权限：`repo`（完整仓库访问权限）
   - 生成并复制令牌

2. **配置认证**：
   ```powershell
   # 克隆时输入凭证
   git clone https://github.com/SmileSilence/AI-Development.git
   # 用户名：SmileSilence
   # 密码：粘贴您的PAT令牌
   
   # 或者设置环境变量（推荐）
   $env:GITHUB_PAT_TOKEN = "ghp_xxxxxxxxxxxx"
   ```

### 方式二：使用SSH密钥

1. **生成SSH密钥**（如果没有）：
   ```powershell
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **添加公钥到GitHub**：
   - 复制 `~/.ssh/id_ed25519.pub` 内容
   - 访问 https://github.com/settings/ssh/new 添加密钥

3. **使用SSH URL克隆**：
   ```powershell
   git clone git@github.com:SmileSilence/AI-Development.git
   ```

### 方式三：使用GitHub CLI

1. **安装GitHub CLI**：
   ```powershell
   winget install GitHub.cli
   ```

2. **登录并克隆**：
   ```powershell
   gh auth login
   gh repo clone SmileSilence/AI-Development
   ```

### 自动认证检测

安装脚本会自动检测认证配置：
- ✅ 检查SSH密钥认证
- ✅ 检查HTTPS凭证
- ✅ 检查环境变量中的PAT令牌
- ⚠️ 如果未检测到认证，会显示配置提示

### 故障排除

1. **认证失败**：
   - 检查PAT令牌是否过期
   - 确认SSH密钥已添加到GitHub
   - 验证网络连接

2. **权限不足**：
   - 确保PAT有 `repo` 权限
   - 确保SSH密钥有读取权限

3. **克隆缓慢**：
   - 尝试使用SSH协议
   - 检查网络代理设置
