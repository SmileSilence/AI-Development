---
name: auto-context-splitter
description: 自动检测上下文超限并智能分段处理长文本任务
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: 自动上下文分段处理器
  category: Agent 工具
---

# Auto Context Splitter — 自动上下文分段处理器

自动检测输入内容或当前会话上下文是否超过模型限制，并根据内容类型智能分段、分批处理、合并结果，解决长文本任务中的上下文超限问题。

## 触发条件

### 自动触发
- 用户提到"上下文超限"、"上下文超过限制"、"token 超限"
- 用户要求"自动分段处理"、"智能分段"、"分段处理长文本"
- 用户说"压缩上下文后继续"、"分段后继续"
- 用户要求处理"很长的文本"、"大文件"、"超长内容"

### 不触发（避免误用）
- 普通短文本问答或代码生成 → 不激活本技能
- 仅讨论上下文概念而无实际处理需求 → 不激活本技能

### 补充：输出 token 截断（区别于输入超限/累计超长）
系统提示「已达到输出 token 上限回答被截断，已有输出保留在对话中。发送"继续"可让模型接着输出」时：
- **含义**：单次回复达到模型输出上限（maxTokens）被截断，非输入问题。
- **立即处理**：发送"继续"从截断处续写（DSH agent loop 支持 max-tokens 续写）。
- **根治**：一次输出不要过长——长内容用 write 写文件、对话只留摘要；大任务拆小步（todo_write）；单次内容超限用本技能分段。
- **配置**：可调 agent 的 maxTokens，但受模型硬性输出上限约束，拆小输出才可靠。

## 功能

### 1. 上下文超限检测
- 估算当前内容 token 数量
- 判断是否超过模型上下文限制
- 提供超限严重程度评估（none/mild/moderate/severe/critical）

### 2. 智能内容分段
- 自动检测内容类型（代码 / Markdown / 文档 / 书籍 / 通用文本）
- 根据内容类型选择最佳分段策略
- 保持函数、章节、段落等语义边界完整

### 3. 多种分段策略
- **intelligent（推荐）**：自动按内容类型选择策略
- **semantic**：按段落语义分段
- **size**：按固定大小分段

### 4. 批量处理与结果合并
- 分批处理每个内容片段
- 自动合并各段处理结果
- 生成统一摘要和关键要点

### 5. 支持多种任务类型
- analysis：内容分析
- coding：代码审查
- research：资料研究
- writing：写作优化
- summary：内容摘要

### 6. 会话累计上下文压缩（重点）
当**整个会话历史累计变长**（数百轮对话、大量工具调用结果堆积）而不是单次内容超限时：
- **检测会话压力**：估算当前会话累计 token 使用量与窗口占比
- **引导内置压缩**：DSH 已内置自动压缩（`compaction-basic`，压力或溢出自动触发）与手动 `/compact` 命令
- **主动建议**：检测到会话接近阈值时，提示用户执行 `/compact`，或主动把早期对话要点提炼后建议压缩
- **压缩 vs 分段**：
  - 单次内容放不下 → 分段（本技能主路径）
  - 整个会话累计过长 → 压缩早期历史释放上下文空间（`/compact` / 自动压缩）

## 使用方法

### 方式一：直接调用处理

```javascript
const AutoContextHandler = require('./scripts/auto-context-handler');

const handler = new AutoContextHandler({
  maxTokens: 4000,
  chunkSize: 1500,
  verbose: true
});

const result = await handler.autoProcess(largeContent, {
  strategy: 'intelligent',
  taskType: 'analysis'
});
```

### 方式二：使用 workflow 协调

```javascript
const meta = {
  name: "auto-context-splitter",
  description: "自动分段处理长文本"
};

const script = `
  const AutoContextHandler = require('./scripts/auto-context-handler');
  const handler = new AutoContextHandler({ maxTokens: 4000 });
  
  const result = await handler.autoProcess(args.content, {
    strategy: args.strategy || 'intelligent',
    taskType: args.taskType || 'analysis'
  });
  
  return result;
`;

workflow({ script, meta, args: { content: "...", strategy: "intelligent" } });
```

### 方式三：配合文件分段读取

对于超大文件，建议先使用 `read` 工具分段读取，再调用本技能处理：

```javascript
// 读取前 2000 行
const part1 = await read('large_file.txt', { limit: 2000 });

// 读取后续内容
const part2 = await read('large_file.txt', { offset: 2001, limit: 2000 });

// 对需要处理的部分调用分段处理器
const result = await handler.autoProcess(part1 + part2);
```

### 方式四：会话累计超长时压缩

当整个会话历史累计过长（不是单次内容超限），应使用 DSH 内置压缩而非分段：

```text
# 用户在 Web GUI 或 CLI 输入
/compact
# 结果：把一段较早的有效历史压缩成摘要，报告替换条目数与估算 token 数
```

- **自动压缩**：`compaction-basic` 在每轮开始前检测压力，达到阈值自动执行，无需干预。
- **手动压缩**：未到自动阈值时，`/compact` 可主动压缩；无可压缩历史时提示 `No compactable history yet.`
- **辅助脚本**：可用 `scripts/session-pressure.js` 估算会话累计 token 用量与窗口占比，帮助判断是否需要压缩。

## 配置说明

### AutoContextHandler 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| maxTokens | number | 4000 | 模型最大 token 限制 |
| chunkSize | number | 1500 | 每个分段的目标 token 数 |
| verbose | boolean | false | 是否输出详细日志 |

### 分段策略

| 策略 | 适用场景 |
|------|----------|
| intelligent | 通用推荐，自动识别内容类型 |
| semantic | 保持段落语义完整 |
| size | 按固定大小快速分段 |

### 任务类型

| 类型 | 用途 |
|------|------|
| analysis | 分析内容观点和关键信息 |
| coding | 分析代码功能和问题 |
| research | 研究关键概念 |
| writing | 优化表达和结构 |
| summary | 总结核心要点 |

## 注意事项

1. **分段大小建议**：根据模型窗口调整，预留 20%-30% 余量给输出。
2. **保持语义完整**：智能分段会尽量不在函数、句子、章节中间断开。
3. **不要过度分段**：分段过多会增加处理复杂度和成本。
4. **并行处理**：独立分段可并行处理以提高效率。
5. **结果验证**：分段处理后需验证合并结果是否完整准确。
6. **超长内容**：若内容极其巨大，建议先使用文件分段读取减少加载量。

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-31 | v1 | 初始版本，实现自动检测、智能分段、批量处理和结果合并 |