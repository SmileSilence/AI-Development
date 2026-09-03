---
name: <skill-name>
description: <简短描述技能功能和触发条件>
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: <更简短的描述>
  category: <分类>
  platforms: [DSH, Claude, OpenAI/Codex]  # 支持的AI平台
  keywords: [keyword1, keyword2]           # 关键词便于搜索
---

# <技能名称>

<核心用法概述（约30-50行，遵循渐进式披露原则）>

---

## 一、触发条件

<精确描述何时激活此技能，使用具体任务场景而非模糊描述>

### 自动触发场景
- 用户说「...」或要求...
- 涉及...任务时

### 不触发场景（避免误用）
- 创建DSH插件（应使用dsh-plugin-creator）
- 普通编码任务（应使用coding-workflow）

---

## 二、核心功能

<功能列表，每个功能点简明扼要>

1. **功能一**：...
2. **功能二**：...
3. **功能三**：...

---

## 三、快速上手

<使用示例和可直接运行的命令/代码>

### 示例1：基本用法
```bash
# 可直接运行的命令
```

### 示例2：进阶用法
```python
# 可直接运行的代码
```

---

## 四、详细指南

详细步骤、长示例、配置说明等请参考：
- `references/详细指南.md`（可选）
- `scripts/`目录中的脚本（可选）
- `assets/`目录中的模板（可选）

---

## 五、平台兼容性

| 平台 | 支持状态 | 安装路径 | 备注 |
|------|----------|----------|------|
| **DSH** | ✅ 完全支持 | `~/.agents/skills/<skill-name>/` | 通过skill-creator安装 |
| **Claude Code** | ✅ 支持 | `~/.claude/skills/<skill-name>/` | 需要SKILL.md格式合规 |
| **OpenAI/Codex** | ✅ 支持 | `~/.codex/skills/<skill-name>/` | 需openai.yaml配置文件 |
| **AGENTS.md项目** | ✅ 支持 | 项目根目录`agents/`或通过AGENTS.md引用 | 遵循agents.md规范 |

---

## 六、配置说明

<相关配置项，如环境变量、配置文件等>

---

## 七、注意事项

<使用限制、已知问题、兼容性注意事项>

---

## 八、故障排除

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 技能不触发 | description不够精确 | 重写description为具体任务场景 |
| 平台不支持 | 缺少对应配置文件 | 添加platforms/metadata字段 |
| 性能问题 | 正文过长 | 遵循渐进式披露，将详细内容移至references/ |

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| {创建日期} | v1 | 初始版本 |
| {更新日期} | v1.1 | 增加多平台支持字段 |
