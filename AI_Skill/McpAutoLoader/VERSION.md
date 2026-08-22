# McpAutoLoader 版本记录

## v2 (2026-08-22)

### 新增功能
- MCP 搜索功能：根据关键词搜索可用的 MCP 服务器
- MCP 安装功能：交互式安装 MCP 服务器
- 完善文档结构，符合 skill 规范

### 改进
- 优化触发条件描述
- 完善使用示例
- 添加故障排除指南

### 文件结构
- SKILL.md：技能说明文档
- scripts/auto-load-mcp.sh：MCP 启用脚本
- scripts/search-mcp.sh：MCP 搜索脚本
- scripts/install-mcp.sh：MCP 安装脚本
- agents/openai.yaml：OpenAI Agent 配置
- references/README.md：参考文档

## v1 (2026-08-22)

### 初始版本
- 基本的 MCP 启用功能
- 支持 15+ 个 MCP 服务器
- 命令行脚本和自然语言触发
