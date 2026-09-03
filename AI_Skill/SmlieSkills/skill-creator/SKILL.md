---
name: skill-creator
description: 创建或维护 AI_Skill 技能；涉及 SKILL.md、openai.yaml、目录结构或安装测试时使用。
metadata:
  publisher: SmileXX
  version: "v7"
  short-description: AI 技能开发工具
  category: 技能开发
  platforms: [DSH, Claude, OpenAI/Codex]
  keywords: [skill, development, AI, agent, template]
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

- **目录名**：kebab-case 小写（如 coding-workflow、smile-global-config）；DSH 仅加载 kebab-case 小写技能名，PascalCase 无法在 DSH 中加载
- **SKILL.md 中的 name**：与目录名一致
- **自有技能发布者**：`SmlieSkills` 目录下的技能统一使用 `metadata.publisher: SmileXX`
- **描述**：简短说明功能和触发条件

### 2.3 SKILL.md 格式

`markdown
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

# <skill-name>

<核心用法概述（约30-50行，遵循渐进式披露原则）>

详细结构参考：`references/SKILL_TEMPLATE.md`
`
`

### 2.4 openai.yaml 格式

`yaml
name: <skill-name>
description: <技能描述>

# 技能元数据
metadata:
  version: "v1"
  publisher: "SmileXX"
  category: <分类>
  platforms: ["OpenAI/Codex", "DSH", "Claude"]
  keywords: [keyword1, keyword2]

# 界面配置
interface:
  display_name: "<显示名称>"
  short_description: "<简短描述>"
  default_prompt: |
    <默认提示词>
    # 技能名称: <技能名称>
    # 功能: <核心功能描述>
    # 使用场景: <主要使用场景>
  hidden: false  # 是否在界面中隐藏

# 调用配置
invocation: auto  # auto（自动触发）或 explicit（显式调用）

# 权限配置（可选）
permissions:
  - file_system: read_write  # 文件系统权限
  - network: read           # 网络访问权限

# 兼容性配置（可选）
compatibility:
  openai_api_version: ">=1.0.0"
  codex_version: ">=2.0.0"
  agents_md_spec: ">=0.8.0"
`

### 2.5 修改规范

修改已有技能时，必须遵守以下规则：

1. **先读后改**：修改前必须先查看整个 Skill（完整阅读 SKILL.md 及 agents/、references/ 等相关文件），判断本次改动属于哪个部分（触发条件 / 功能 / 使用方法 / 注意事项 / 配置等），确认归属后再进行针对性修改，避免破坏其他部分。
2. **局部修改**：仅修改目标部分，不重写无关内容；修改后检查整体结构是否仍完整一致。

### 2.6 分类规范

创建和修改技能时，需按分类（功能模块）组织技能，确保技能体系清晰、易于管理：

#### 常用分类参考
- **游戏开发**：UE开发、Unity开发、游戏引擎插件等
- **编码开发**：编码工作流、代码规范、重构、测试等  
- **AI工具**：技能开发、插件开发、Agent管理等
- **项目配置**：项目初始化、Git管理、文档模板等
- **平台特定**：DSH插件、Claude配置、OpenAI工具等
- **文档与设计**：架构设计、文档生成、图表制作等

#### 分类实施指南
1. **明确分类归属**：创建新技能时首先确定其所属分类（参考上述分类或创建新的合理分类）
2. **metadata标注**：在SKILL.md的metadata中使用`category`字段明确标注分类
3. **命名一致性**：同类技能使用相似的命名前缀或模式
4. **功能边界清晰**：避免跨分类的功能重叠，确保每个技能职责单一
5. **检索优化**：分类有助于技能库的组织和快速检索

### 2.7 措辞与文档规范

创建和修改技能时，需优化措辞和文档质量：

#### 措辞原则
1. **准确性**：表述精确无歧义，使用规范中文，避免模糊描述
2. **简洁性**：用最少的文字表达完整意思，删除冗余重复内容
3. **一致性**：术语前后统一，保持全文风格一致
4. **用户导向**：从用户角度出发，使用用户能理解的语言

#### 文档质量检查
- **语法正确**：检查中文语法和标点使用
- **结构清晰**：使用恰当的标题层级和段落分隔
- **示例丰富**：提供可直接运行的命令和代码示例
- **术语表**：复杂技能可提供术语解释或词汇表
- **版本说明**：重要变更需在版本记录中详细说明

#### 优化技巧
- 将长句拆分为短句，提高可读性
- 使用列表、表格等结构化方式呈现信息
- 为复杂概念添加简要说明或示例
- 定期review和更新文档内容

---

## 三、开发流程

### 3.1 需求分析

1. 明确技能的功能边界
2. 确定触发条件
3. 规划输入输出

### 3.2 创建目录

`powershell
# 在 AI_Skill 目录下创建
New-Item -Path "D:\Work\AI-Development\AI_Skill\SmlieSkills\<skill-name>" -ItemType Directory
New-Item -Path "D:\Work\AI-Development\AI_Skill\SmlieSkills\<skill-name>\agents" -ItemType Directory
`

### 3.3 编写文档

1. 编写 SKILL.md（必需）
2. 编写 gents/openai.yaml（可选）
3. 添加 eferences/ 参考文档（可选）
4. 添加 scripts/ 脚本（可选）

### 3.4 安装技能

`powershell
# 复制到共享 skills 目录；Codex、DSH 和 MiMo 均从此处加载
Copy-Item -Path "D:\Work\AI-Development\AI_Skill\SmlieSkills\<skill-name>"
          -Destination "$env:USERPROFILE/.agents/skills/<skill-name>"
          -Recurse -Force
`

### 3.5 测试验证

1. 重启或刷新目标 Agent 的技能列表
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

参考 eferences/OPENAI_YAML_TEMPLATE.yaml

---

## 六、AI技能开发最佳实践

基于官方文档（Anthropic/OpenAI/AGENTS.md）的最佳实践总结：

### 6.1 渐进式披露（Progressive Disclosure）原则
- **核心原则**：SKILL.md正文只写约30-50行的核心用法/概览
- **详细内容分离**：详细步骤、长示例、参考表放进被引用的子文件（如`references/xxx.md`、脚本）
- **按需加载**：模型只在需要时读取引用文件，避免无关token占用上下文

### 6.2 触发条件优化
- **具体而非模糊**：使用具体任务场景而非模糊描述
- **示例化触发**：包含用户实际可能说的短语
- **避免冲突**：明确不触发场景，减少误用

### 6.3 多平台兼容性
- **字段标准化**：使用`platforms`字段明确支持的AI平台
- **配置文件适配**：根据平台提供对应的配置文件（openai.yaml等）
- **路径一致性**：确保不同平台的安装路径正确

### 6.4 质量保证
- **可测试性**：提供可直接运行的命令/代码示例
- **可维护性**：结构清晰，便于更新和扩展
- **可复用性**：设计为独立、可复用的技能单元

### 6.5 性能优化
- **上下文效率**：避免在SKILL.md中重复通用系统提示
- **资源管理**：大文件、长内容拆分为子文件引用
- **加载策略**：使用metadata字段辅助技能加载决策

---

## 七、技能质量检查清单

在发布技能前，请检查以下项目：

### ✅ 基础检查
- [ ] 目录名使用kebab-case小写
- [ ] SKILL.md存在且格式正确
- [ ] name字段与目录名一致
- [ ] description字段精确描述触发条件

### ✅ 内容检查  
- [ ] 遵循渐进式披露原则（正文30-50行）
- [ ] 详细内容移至references/或scripts/
- [ ] 提供可直接运行的示例
- [ ] 术语统一，无歧义表述

### ✅ 平台兼容性检查
- [ ] platforms字段明确支持的平台
- [ ] 为OpenAI/Codex提供openai.yaml（如需）
- [ ] 为Claude提供合规的SKILL.md格式
- [ ] 为DSH确认kebab-case命名

### ✅ 安装与测试
- [ ] 安装路径正确（~/.agents/skills/等）
- [ ] 测试触发条件是否准确
- [ ] 验证功能正常工作
- [ ] 检查与其他技能的冲突

---

## 八、常见问题

### Q: 技能不触发？

A: 检查 description 中的触发条件是否准确，是否与其他技能冲突。

### Q: 如何更新已安装的技能？

A: 修改源文件后，在仓库根目录运行 `AI_Skill/install-skills.ps1`，同步共享目录与 Claude 目录。

### Q: 如何删除技能？

A: 从 .agents/skills 与 .claude/skills 删除对应目录；Codex 私有目录中如有同名旧副本也应清理。

### Q: 技能在不同平台表现不一致？

A: 检查platforms字段是否完整，各平台配置文件是否正确，确保技能遵循各平台的特定要求。

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-09-01 | v7 | 优化skill-creator技能：<br>• 更新SKILL_TEMPLATE.md模板，增加多平台支持字段<br>• 更新OPENAI_YAML_TEMPLATE.yaml模板，增加完整配置选项<br>• 新增AI技能开发最佳实践章节（渐进式披露、触发优化、多平台兼容等）<br>• 新增技能质量检查清单（基础检查、内容检查、平台兼容性检查、安装与测试）<br>• 优化分类规范，添加详细分类参考和实施指南<br>• 优化措辞与文档规范，提升文档质量标准<br>• 修复文档格式问题；技能源目录命名统一为 SmlieSkills，与仓库实际目录一致 |
| 2026-08-29 | v6 | 适配 SmlieSkills / OtherSkills 来源分层；自有技能模板新增 SmileXX 发布者字段 |
| 2026-08-29 | v5 | 精简技能目录描述，并改用共享技能目录避免 Codex 重复注册 |
| 2026-08-28 | v4 | 命名规范收紧为 kebab-case：DSH 仅加载 kebab-case 小写技能名，PascalCase 无法加载 |
| 2026-08-28 | v3 | 新增修改规范（先读后改、判断改动所属部分）、分类规范（按功能模块分类）、措辞规范（优化措辞）；编写原则补充分类与措辞 |
| 2026-08-27 | v2 | 优化触发条件：补充不触发场景，技能自包含（不引用其他技能）；修正技能源目录路径 |
| 2026-08-22 | v1 | 初始版本 |
