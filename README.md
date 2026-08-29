# AI-Development — AI 开发资源目录

本仓库按资源类型分类管理 AI 开发相关内容。根目录只负责说明各分类文件夹的用途；每个分类的文档、清单、表格、脚本和具体内容均存放在对应子文件夹中。

## 分类目录

| 文件夹 | 分类 | 用途 | 包含内容 |
|--------|------|------|----------|
| `AI_Skill/` | AI 技能 | 管理 SmileXX 自有技能、第三方技能索引与跨 Agent 安装 | 设计文档、技能清单、Excel 表格、安装清单、安装脚本、具体技能源码 |
| `AI_Mcp/` | MCP 服务 | 管理 MCP（模型上下文协议）服务、配置与接入资料 | 分类说明；后续可存放服务清单、配置文档、安装脚本和具体 MCP 项目 |
| `AI_Plugins/` | AI 插件 | 按 Agent 平台管理 SmileXX 自有插件和第三方插件资料 | 平台说明、插件分类、本地第三方源码与后续插件清单 |

## 仓库结构

```text
AI-Development/
├── README.md                       # 各分类文件夹的用途、分类与描述
├── AI_Skill/                       # AI 技能相关的全部内容
│   ├── README.md                   # AI_Skill 分类设计与维护规范
│   ├── SKILL_LIST.md               # 技能明细清单
│   ├── QUICK_INSTALL.md            # 快速安装说明
│   ├── INSTALL_README.md           # 完整安装说明
│   ├── skill-manifest.json         # 自有技能安装清单
│   ├── SKILL_CATALOG.xlsx          # 全部技能中文总表
│   ├── install-skills.ps1          # 技能安装脚本
│   ├── SmlieSkills/                # SmileXX 自有技能源码
│   └── OtherSkills/                # 第三方技能清单与本地工作区
├── AI_Mcp/
│   └── README.md                   # MCP 分类用途与规划
└── AI_Plugins/
    ├── README.md                   # AI 插件分类用途与维护规则
    └── DSH/                        # DeepSeek Harness 插件
        ├── README.md               # DSH 插件分类说明
        ├── OtherPlugin/            # 第三方插件本地工作区
        └── SmilePlugin/            # SmileXX 自有插件源码
```

## 使用入口

- AI 技能的设计、清单、安装和维护：查看 [`AI_Skill/README.md`](AI_Skill/README.md)
- MCP 服务的分类规则：查看 [`AI_Mcp/README.md`](AI_Mcp/README.md)
- AI 插件的平台分类与维护规则：查看 [`AI_Plugins/README.md`](AI_Plugins/README.md)

## 管理原则

1. 根目录不堆放某一分类的业务文件。
2. 文档、表格、JSON、脚本与具体项目必须归入对应分类文件夹。
3. 每个一级分类文件夹必须包含 `README.md`，说明用途、目录结构和维护规则。
4. 文件夹与文件名使用英文；文档与表格内容使用简体中文。

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-29 | v9 | 新增 AI_Plugins 分类，并补充 DSH 自有插件与第三方插件的目录规范 |
| 2026-08-29 | v8 | 根目录改为分类导航；技能相关文档、表格、清单和脚本统一归入 AI_Skill；补充 AI_Mcp 分类说明 |
