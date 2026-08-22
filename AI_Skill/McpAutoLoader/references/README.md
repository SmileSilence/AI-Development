# MCP 按需自动加载器

实现"用时即启"的 MCP 服务器管理方式，当需要使用特定功能时自动启用对应的 MCP 服务器。

## 功能特点

- ✅ 按需加载：只在需要时启用 MCP 服务器
- ✅ 自动检测：根据用户需求自动识别需要的 MCP
- ✅ 简单易用：一条命令即可启用
- ✅ 支持 15+ 个 MCP 服务器

## 支持的 MCP 服务器

| MCP 服务器 | 功能 | 触发关键词 |
|-----------|------|-----------|
| **context7** | 上下文管理 | 上下文、记忆、知识库 |
| **github** | GitHub API | GitHub、PR、issue、仓库 |
| **gitlab** | GitLab API | GitLab、MR、merge request |
| **playwright** | 浏览器自动化 | 浏览器、网页、截图、爬虫 |
| **firebase** | Firebase 服务 | Firebase、数据库、认证 |
| **telegram** | Telegram 集成 | Telegram、电报 |
| **discord** | Discord 集成 | Discord |
| **asana** | 项目管理 | 项目管理、任务、看板 |
| **linear** | 项目管理 | 项目管理、任务、看板 |
| **imessage** | iMessage 集成 | iMessage、苹果消息 |
| **laravel-boost** | Laravel 开发 | Laravel、PHP |
| **serena** | 代码搜索 | 代码搜索、语义搜索 |
| **greptile** | 代码搜索 | 代码搜索、语义搜索 |
| **terraform** | 基础设施即代码 | Terraform、基础设施 |
| **fakechat** | 模拟聊天 | 模拟聊天、测试对话 |

## 使用方法

### 方法 1: 使用脚本（推荐）

```bash
# 启用特定 MCP 服务器
~/.claude/skills/mcp-auto-loader/scripts/auto-load-mcp.sh context7
~/.claude/skills/mcp-auto-loader/scripts/auto-load-mcp.sh github

# 查看所有支持的 MCP
~/.claude/skills/mcp-auto-loader/scripts/auto-load-mcp.sh
```

### 方法 2: 使用 Claude Code 命令

```bash
# 添加 MCP 服务器
claude mcp add-json context7 '{"command":"npx","args":["-y","@upstash/context7-mcp"]}'

# 查看已启用的 MCP
claude mcp list

# 移除 MCP 服务器
claude mcp remove context7
```

### 方法 3: 自然语言触发

直接告诉 Claude 你需要什么功能，技能会自动启用对应的 MCP：

- "帮我看看 GitHub issue" → 自动启用 github MCP
- "打开浏览器截图" → 自动启用 playwright MCP
- "搜索代码" → 自动启用 serena/greptile MCP

## 配置文件位置

MCP 配置文件存储在：
```
~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/<mcp-name>/.mcp.json
```

## 注意事项

### 1. 环境变量

某些 MCP 服务器需要配置环境变量：

```bash
# GitHub MCP 需要
export GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"

# 其他 MCP 可能需要的环境变量
export API_KEY="your_api_key"
```

### 2. 性能考虑

- MCP 服务器一旦启用，会在整个会话期间保持连接
- 启用过多 MCP 可能影响性能
- 建议按需启用，不用时及时禁用

### 3. 连接状态

```bash
# 查看 MCP 连接状态
claude mcp list

# 查看特定 MCP 详情
claude mcp get context7
```

## 故障排除

### MCP 连接失败

1. 检查网络连接
2. 确认环境变量已正确设置
3. 查看错误信息：`claude mcp get <mcp-name>`

### 配置文件损坏

重新下载配置：
```bash
cd ~/.claude/plugins/marketplaces/claude-plugins-official
git pull origin main
```

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-22 | v1 | 初始版本 |
