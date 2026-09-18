# AI_Mcp — MCP 服务分类

本目录用于集中管理 MCP（Model Context Protocol，模型上下文协议）服务相关资源。

## 用途

| 内容类型 | 说明 |
|----------|------|
| 设计文档 | MCP 服务选型、接入方案和配置规范 |
| 清单与表格 | 可用 MCP 服务、仓库地址、安装状态和推荐级别 |
| 安装脚本 | MCP 服务安装、启用、更新和卸载脚本 |
| 具体项目 | 自建 MCP 服务源码或允许纳入仓库的第三方配置 |

## 规划结构

```text
AI_Mcp/
├── README.md                       # 本分类说明
├── <documents-and-manifests>       # MCP 文档、清单和表格
└── <mcp-project>/                  # 具体 MCP 服务或配置
```

## 已实现服务

| 服务 | 位置 | 说明 |
|------|------|------|
| `multi-agent-bridge` | `../multi-agent-bridge/` | Codex、Claude、DSH 任意主控的异步委派、状态查询和 Git worktree 隔离执行层 |

MCP 源码保留在仓库一级目录，便于与 `AI_Skill/` 中的共享编排 Skill 和 DSH 诊断工具共同维护；本目录负责 MCP 分类索引。
