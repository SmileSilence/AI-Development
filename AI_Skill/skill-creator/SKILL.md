---
name: skill-creator
description: 创建和开发 AI_Skill 技能：SKILL.md 编写、agents/openai.yaml、目录结构与安装测试。当用户要求创建新技能、开发 skill、添加 AI 能力时使用。技能源目录 D:\Work\AI-Development\AI_Skill。
metadata:
  version: "v4"
  short-description: AI 技能开发工具
  category: 技能开发
---

# Skill Creator — AI 技能开发工具

用于创建、开发和维护 AI_Skill 目录下的技能。

---

## 一、触发条件

### 自动触发
- 用户说「创建一个 skill」「开发技能」「新建 AI 技能」「技能开发」
- 用户要求为某个功能创建可复用的 Agent 技能（SKILL.md 资产）
- 用户说「skill-creator」

### 不触发（避免误用）
- 创建 dsh 插件（plugin.json + 命令）→ 不激活本技能
- 普通编码 / 编码流程 → 不激活本技能

---

## 二、开发规范

### 2.1 目录结构

每个技能必须遵循以下结构：

`
<skill-name>/
├── SKILL.md                 # 必需：技能说明文档
├── agents/                  # 可选：Agent 配置
│   └── openai.yaml          # OpenAI Agent 配置
├── scripts/                 # 可选：可执行脚本
├── references/              # 可选：参考资料文档
└── assets/                  # 可选：静态资源文件
`

### 2.2 命名规范

- **目录名**：kebab-case 小写（如 ai-coding-workflow、smile-global-config）；DSH 仅加载 kebab-case 小写技能名，PascalCase 无法在 DSH 中加载
- **SKILL.md 中的 name**：与目录名一致
- **描述**：简短说明功能和触发条件

### 2.3 SKILL.md 格式

`markdown
---
name: <skill-name>
description: <简短描述技能功能和触发条件>
metadata:
  version: "v1"
  short-description: <更简短的描述>
---

# <技能名称>

<详细说明>

## 触发条件
<何时激活此技能>

## 功能
<功能列表>

## 使用方法
<如何使用>

## 注意事项
<使用时的注意事项>
`

### 2.4 openai.yaml 格式

`yaml
name: <skill-name>
description: <技能描述>
interface:
  display_name: "<显示名称>"
  short_description: "<简短描述>"
  default_prompt: "<默认提示词>"
  hidden: true          # 是否在界面中隐藏
invocation: auto        # auto（自动）或 explicit（显式）
`

### 2.5 修改规范

修改已有技能时，必须遵守以下规则：

1. **先读后改**：修改前必须先查看整个 Skill（完整阅读 SKILL.md 及 agents/、references/ 等相关文件），判断本次改动属于哪个部分（触发条件 / 功能 / 使用方法 / 注意事项 / 配置等），确认归属后再进行针对性修改，避免破坏其他部分。
2. **局部修改**：仅修改目标部分，不重写无关内容；修改后检查整体结构是否仍完整一致。

### 2.6 分类规范

创建和修改技能时，需按分类（功能模块）组织技能：

1. 明确技能所属分类（如 游戏开发、编码开发、代码规范、Agent 管理 等），在 SKILL.md 的 description 或 metadata 中标注分类。
2. 同类技能命名、结构保持一致，便于检索与复用。
3. 新技能或修改时先确认分类归属，避免与其他技能功能重叠。

### 2.7 措辞规范

创建和修改技能时，需优化措辞：

1. 表述准确、简洁、无歧义，使用规范中文。
2. 术语前后统一，避免口语化、冗余和重复表达。
3. 修改已有内容时，对涉及部分的措辞一并优化，保持全文风格一致。

---

## 三、开发流程

### 3.1 需求分析

1. 明确技能的功能边界
2. 确定触发条件
3. 规划输入输出

### 3.2 创建目录

`powershell
# 在 AI_Skill 目录下创建
New-Item -Path "D:\Work\AI-Development\AI_Skill\<skill-name>" -ItemType Directory
New-Item -Path "D:\Work\AI-Development\AI_Skill\<skill-name>\agents" -ItemType Directory
`

### 3.3 编写文档

1. 编写 SKILL.md（必需）
2. 编写 gents/openai.yaml（可选）
3. 添加 eferences/ 参考文档（可选）
4. 添加 scripts/ 脚本（可选）

### 3.4 安装技能

`powershell
# 复制到 Codex skills 目录
Copy-Item -Path "D:\Work\AI-Development\AI_Skill\<skill-name>" 
          -Destination "C:/Users/19163/.codex/skills/<skill-name>" 
          -Recurse -Force
`

### 3.5 测试验证

1. 重启 Codex 或刷新技能列表
2. 测试触发条件
3. 验证功能正常

---

## 四、SKILL.md 编写指南

### 4.1 Frontmatter

`yaml
---
name: skill-name              # 必需
description: 功能描述...      # 必需
metadata:                     # 可选
  short-description: 简短描述
---
`

### 4.2 正文结构

1. **概述**：一句话说明技能用途
2. **触发条件**：何时激活
3. **功能**：详细功能列表
4. **使用方法**：如何使用
5. **配置说明**：相关配置项
6. **注意事项**：使用限制和注意点

### 4.3 编写原则

- **简洁**：只包含必要信息
- **准确**：触发条件描述准确
- **中文**：所有文档使用中文
- **示例**：提供使用示例
- **分类**：明确所属分类（功能模块），避免与其他技能重叠
- **措辞**：优化措辞，准确简洁、术语统一、无歧义

---

## 五、模板文件

### 5.1 SKILL.md 模板

参考 eferences/SKILL_TEMPLATE.md

### 5.2 openai.yaml 模板

参考 eferences/OPENAI_YAML_TEMPLATE.md

---

## 六、常见问题

### Q: 技能不触发？

A: 检查 description 中的触发条件是否准确，是否与其他技能冲突。

### Q: 如何更新已安装的技能？

A: 修改源文件后，重新复制到 C:/Users/19163/.codex/skills/ 目录。

### Q: 如何删除技能？

A: 删除 C:/Users/19163/.codex/skills/<skill-name> 目录即可。

---

## 七、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-28 | v4 | 命名规范收紧为 kebab-case：DSH 仅加载 kebab-case 小写技能名，PascalCase 无法加载 |
| 2026-08-28 | v3 | 新增修改规范（先读后改、判断改动所属部分）、分类规范（按功能模块分类）、措辞规范（优化措辞）；编写原则补充分类与措辞 |
| 2026-08-27 | v2 | 优化触发条件：补充不触发场景，技能自包含（不引用其他技能）；修正技能源目录路径 |
| 2026-08-22 | v1 | 初始版本 |


