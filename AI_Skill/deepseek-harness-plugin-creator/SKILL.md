---
name: deepseek-harness-plugin-creator
description: 创建和开发 DeepSeek Harness (dsh) 插件：plugin.json 清单、命令实现、本地测试与发布 GitHub。当用户要求创建 dsh 插件、开发 DeepSeek Harness 扩展、发布插件到 GitHub 时使用。
metadata:
  version: "v2"
  short-description: DeepSeek Harness 插件开发工具
---

# DeepSeek Harness Plugin Creator — 插件开发工具

用于创建、开发和发布 DeepSeek Harness (dsh) 插件。

---

## 一、触发条件

### 自动触发
- 用户说「创建 dsh 插件」「开发 DeepSeek Harness 插件」「dsh 插件开发」
- 用户要求创建可安装的 dsh 扩展（plugin.json + src/ + commands/）
- 用户说「发布插件到 GitHub」「dsh add 安装」
- 用户说「deepseek-harness-plugin-creator」

### 不触发（避免误用）
- 创建 Agent 技能（SKILL.md）→ 不激活本技能
- 修改 dsh 内核/源码本身 → 直接操作 deepseek-harness 源码 checkout，不使用本技能

---

## 二、插件结构规范

### 2.1 标准目录结构

`
<plugin-name>/
├── plugin.json              # 必需：插件清单文件
├── README.md                # 必需：插件说明文档
├── LICENSE                  # 推荐：许可证文件
├── src/                     # 源代码目录
│   ├── __init__.py
│   └── main.py              # 插件入口
├── commands/                # 命令定义目录
│   └── <command>.py         # 命令实现
├── assets/                  # 静态资源（可选）
└── tests/                   # 测试文件（可选）
    └── test_<command>.py
`

### 2.2 plugin.json 格式

`json
{
  "name": "<plugin-name>",
  "version": "1.0.0",
  "description": "<插件描述>",
  "author": "<作者名>",
  "homepage": "<GitHub 仓库地址>",
  "min_dsh_version": "1.0.0",
  "commands": [
    {
      "name": "<command-name>",
      "description": "<命令描述>",
      "usage": "<命令用法>",
      "handler": "src.main:<handler_function>"
    }
  ],
  "dependencies": [],
  "tags": ["<标签1>", "<标签2>"]
}
`

### 2.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✅ | 插件名称，小写+连字符 |
| version | string | ✅ | 语义化版本号 |
| description | string | ✅ | 插件功能描述 |
| author | string | ✅ | 作者名称 |
| homepage | string | ✅ | GitHub 仓库 URL |
| min_dsh_version | string | ✅ | 最低 dsh 版本要求 |
| commands | array | ✅ | 命令列表 |
| dependencies | array | ❌ | 依赖的其他插件 |
| tags | array | ❌ | 标签，便于搜索 |

---

## 三、开发流程

### 3.1 创建插件项目

`powershell
# 创建目录结构
New-Item -Path "<plugin-name>" -ItemType Directory
New-Item -Path "<plugin-name>/src" -ItemType Directory
New-Item -Path "<plugin-name>/commands" -ItemType Directory
New-Item -Path "<plugin-name>/tests" -ItemType Directory
`

### 3.2 编写 plugin.json

按规范填写插件清单文件。

### 3.3 实现命令

在 src/ 或 commands/ 目录下实现命令处理函数：

`python
# src/main.py
def handle_command(args):
    """命令处理函数"""
    # 实现逻辑
    return {"status": "success", "message": "操作完成"}
`

### 3.4 编写 README.md

`markdown
# <插件名称>

<插件描述>

## 安装

`ash
dsh add <github-url>
`

## 使用

`ash
dsh <command> [args]
`

## 命令列表

| 命令 | 说明 |
|------|------|
| <command> | <命令说明> |
`

---

## 四、本地测试

### 4.1 本地安装测试

`ash
# 在插件目录下执行
dsh add --local .
`

### 4.2 运行测试

`ash
dsh <command> [args]
`

### 4.3 卸载测试

`ash
dsh remove <plugin-name>
`

---

## 五、发布到 GitHub

### 5.1 初始化 Git 仓库

`ash
cd <plugin-name>
git init
git add .
git commit -m "Initial commit: <plugin-name> v1.0.0"
`

### 5.2 创建 GitHub 仓库

`ash
gh repo create <plugin-name> --public --description "<插件描述>"
git remote add origin https://github.com/<username>/<plugin-name>.git
git push -u origin main
`

### 5.3 发布版本

`ash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
`

---

## 六、安装方式

### 6.1 从 GitHub 安装

`ash
dsh add https://github.com/<username>/<plugin-name>
`

### 6.2 从本地安装

`ash
dsh add --local /path/to/<plugin-name>
`

### 6.3 卸载插件

`ash
dsh remove <plugin-name>
`

---

## 七、最佳实践

### 7.1 命令设计

- 命令名称简洁明了
- 提供清晰的 help 信息
- 支持常用参数

### 7.2 错误处理

- 捕获异常并提供友好提示
- 返回有意义的错误信息
- 记录日志便于调试

### 7.3 文档编写

- README 包含安装和使用说明
- 每个命令提供示例
- 说明依赖和系统要求

---

## 八、常见问题

### Q: dsh add 失败怎么办？

A: 检查 plugin.json 格式是否正确，确保 GitHub 仓库可访问。

### Q: 如何更新插件？

A: 在 GitHub 发布新版本后，用户可执行 dsh update <plugin-name> 更新。

### Q: 插件冲突如何处理？

A: 避免与其他插件命令重名，如冲突需修改命令名称。

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-27 | v2 | 优化触发条件：补充自动触发关键词与不触发场景，技能自包含（不引用其他技能） |
| 2026-08-22 | v1 | 初始版本 |


