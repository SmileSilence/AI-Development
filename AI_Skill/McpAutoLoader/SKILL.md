---
name: McpAutoLoader
description: 按需自动加载 MCP 服务器。当用户需要使用 GitHub、浏览器自动化、代码搜索等功能时，自动检测并启用对应的 MCP 服务器。支持 context7、github、gitlab、playwright、firebase、telegram、discord 等 15+ 个 MCP 服务器。当用户说"启动 github""加载 playwright""启用 MCP"等时激活。
metadata:
  short-description: MCP 按需自动加载器
  version: "v2"
  author: AI Development Team
---

# MCP 按需自动加载器

根据用户需求自动启用对应的 MCP 服务器，实现"用时即启"。支持搜索、安装和启用 MCP 服务器。

---

## 一、触发条件

当用户提到以下关键词或功能时，自动启用对应的 MCP 服务器：

| 用户需求关键词 | 对应 MCP 服务器 | 功能描述 |
|--------------|----------------|---------|
| GitHub、PR、issue、仓库 | github | GitHub API 集成 |
| GitLab、MR、merge request | gitlab | GitLab API 集成 |
| 浏览器、网页、截图、爬虫 | playwright | 浏览器自动化 |
| Firebase、数据库、认证 | firebase | Firebase 服务 |
| Telegram、电报 | telegram | Telegram 集成 |
| Discord | discord | Discord 集成 |
| 上下文、记忆、知识库 | context7 | 上下文管理 |
| 项目管理、任务、看板 | asana, linear | 项目管理 |
| iMessage、苹果消息 | imessage | iMessage 集成 |
| Laravel、PHP | laravel-boost | Laravel 开发 |
| 代码搜索、语义搜索 | serena, greptile | 代码搜索 |
| Terraform、基础设施 | terraform | 基础设施即代码 |
| 模拟聊天、测试对话 | fakechat | 模拟聊天 |

---

## 二、功能

### 2.1 MCP 搜索

根据关键词搜索可用的 MCP 服务器，显示配置信息和安装状态。

### 2.2 MCP 安装

交互式安装 MCP 服务器，显示配置信息并确认后自动安装。

### 2.3 MCP 启用

按需启用已安装的 MCP 服务器，实现"用时即启"。

### 2.4 自然语言触发

根据用户需求自动识别并启用对应的 MCP 服务器。

---

## 三、使用方法

### 3.1 命令行脚本

```bash
# 搜索 MCP 服务器
./scripts/search-mcp.sh <关键词>

# 安装 MCP 服务器
./scripts/install-mcp.sh <mcp-name>

# 启用 MCP 服务器
./scripts/auto-load-mcp.sh <mcp-name>

# 查看所有支持的 MCP
./scripts/auto-load-mcp.sh
```

### 3.2 Claude Code 命令

```bash
# 添加 MCP 服务器
claude mcp add-json <mcp-name> '<config-json>'

# 查看已启用的 MCP
claude mcp list

# 移除 MCP 服务器
claude mcp remove <mcp-name>
```

### 3.3 自然语言触发

直接告诉 Claude 你需要什么功能，技能会自动启用对应的 MCP：

- "帮我看看 GitHub 上有什么 issue" → 自动启用 github MCP
- "打开浏览器截图" → 自动启用 playwright MCP
- "搜索相关代码" → 自动启用 serena/greptile MCP
- "我需要处理 GitHub API" → 搜索 github MCP → 让用户选择安装

---

## 四、工作流程

### 4.1 检测需求

分析用户输入，识别是否需要特定 MCP 服务器的功能。

### 4.2 检查状态

```bash
# 检查 MCP 是否已启用
claude mcp get <mcp-name>
```

### 4.3 搜索可用 MCP

如果 MCP 未启用，搜索相关的 MCP：

```bash
./scripts/search-mcp.sh <关键词>
```

### 4.4 安装 MCP

如果 MCP 未安装，让用户选择安装：

```bash
./scripts/install-mcp.sh <mcp-name>
```

### 4.5 启用 MCP

安装后自动启用，或手动启用：

```bash
./scripts/auto-load-mcp.sh <mcp-name>
```

### 4.6 确认就绪

告知用户 MCP 服务器已启用，可以正常使用。

---

## 五、配置说明

### 5.1 配置文件位置

MCP 配置文件存储在：
```
~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/<mcp-name>/.mcp.json
```

### 5.2 环境变量配置

某些 MCP 服务器需要配置环境变量，编辑 `~/.claude/settings.json` 的 `env` 部分：

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxx",
    "GITLAB_TOKEN": "glpat-xxxx",
    "FIREBASE_TOKEN": "xxxx"
  }
}
```

---

## 六、使用示例

### 示例 1: GitHub 操作

**用户**: "帮我看看 GitHub 上有什么 issue"

**自动操作**:
1. 检测到 GitHub 需求
2. 检查 github MCP 是否已启用
3. 如果未启用，搜索并安装
4. 启用 github MCP
5. 执行查询

### 示例 2: 浏览器自动化

**用户**: "打开浏览器截图"

**自动操作**:
1. 检测到浏览器需求
2. 检查 playwright MCP 是否已启用
3. 如果未启用，搜索并安装
4. 启用 playwright MCP
5. 执行截图

### 示例 3: 代码搜索

**用户**: "搜索相关代码"

**自动操作**:
1. 检测到代码搜索需求
2. 检查 serena/greptile MCP 是否已启用
3. 如果未启用，搜索并安装
4. 启用 serena/greptile MCP
5. 执行搜索

---

## 七、注意事项

- MCP 服务器一旦启用，会在整个会话期间保持连接
- 某些 MCP 服务器需要额外配置（如 API Token）
- 启用过多 MCP 可能影响性能，建议按需启用
- 可以使用 `claude mcp list` 查看当前启用的 MCP
- 配置文件修改后需要重启 Claude Code 才能生效
- 搜索功能会显示所有可用的 MCP，包括已安装和未安装的

---

## 八、故障排除

### 8.1 MCP 连接失败

1. 检查网络连接
2. 确认环境变量已正确设置
3. 查看错误信息：`claude mcp get <mcp-name>`

### 8.2 配置文件损坏

重新下载配置：
```bash
cd ~/.claude/plugins/marketplaces/claude-plugins-official
git pull origin main
```

### 8.3 环境变量未生效

重启 Claude Code 或重新加载配置。

### 8.4 MCP 未找到

使用搜索功能查找相关 MCP：
```bash
./scripts/search-mcp.sh <关键词>
```

### 8.5 安装失败

检查网络连接和权限，或手动安装：
```bash
claude mcp add-json <mcp-name> '<config-json>'
```

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-22 | v2 | 新增 MCP 搜索与安装功能，完善文档结构 |
| 2026-08-22 | v1 | 初始版本 |

