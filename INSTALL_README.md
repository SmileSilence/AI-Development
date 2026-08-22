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

- 2026-08-22：初始版本，包含12个AI技能
