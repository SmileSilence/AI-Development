# 来源与合并记录

## 官方动态插件技能

- 发布者：DeepSeek。
- 仓库：https://github.com/deepseek-ai/deepseek-harness
- 原路径：`apps/cli/config/agent-presets/cordis/skills/cordis-plugin-development/SKILL.md`，已迁移。
- 现行路径：`packages/preset/agent-presets/presets/cordis/skills/cordis-plugin-development/SKILL.md`。
- 本次下载提交：`49a606bc5b5934603f22a26957a07dc799ab0291`，下载时的 master。
- 下载日期：2026-09-03（Asia/Shanghai）。
- 文件 SHA-256：`01811d3ee9c03a466abae12d54d229e7de7bd74ca6b730c54ce9d5e696b294aa`。
- [固定提交原文](https://github.com/deepseek-ai/deepseek-harness/blob/49a606bc5b5934603f22a26957a07dc799ab0291/packages/preset/agent-presets/presets/cordis/skills/cordis-plugin-development/SKILL.md)。
- 许可：MIT，Copyright (c) 2026 DeepSeek；原许可随技能保存在 [LICENSE-DeepSeek.txt](LICENSE-DeepSeek.txt)，分发实质性改编内容时保留。

仓库内的 `OtherSkills/cordis-plugin-development` 保存官方原文、LICENSE 和 source.json；该目录按现有规则不进入 Git，也不单独安装。安装后的本技能已经包含中文参考与许可，不依赖仓库中的原文目录。

## 合并边界

| 材料 | 合并后位置 | 处理方式 |
| --- | --- | --- |
| 本地 dsh-plugin-creator 既有正文 | package-development.md 与主文档 | 中文整理；保留能力图、标准值/展示/持久化分层、回放、业务工具、UI 和独立安装验证 |
| 官方 cordis-plugin-development | cordis-dynamic.md | 中文改编；保留运行时查询、两端边界、事件/计时器、插槽/主题、私有通信、动态工具、版本与审批语义 |
| 既有 failure-atlas.md 与官方故障表 | failure-atlas.md | 按故障边界去重，补充动态版本和执行环境问题 |
| 旧名称技能的历史经验 | 仅保留经本次契约支持的规则 | 不继承 Python/plugin.json 通用模板、固定插槽优先级、禁止 ctx.get 等过时断言 |

本地既有插件包文本缺少可核实的上游版本记录，本次不把它标记为官方发布。`publisher: SmileXX` 表示本地中文整合版本的维护者，不改变 DeepSeek 原文版权归属。

删除了对缺失 `check-plugin-closure.mjs` 的执行要求，改为明确检查发布产物、依赖解析、配置挂载、独立安装和卸载重启。`agents/openai.yaml` 使用当前支持的 `interface` 与 `policy` 字段，保持自动调用，移除未在当前格式中定义的旧字段。

## 后续更新

更新时重新读取官方树和固定提交，比较原文差异，并更新下载日期、提交与哈希。运行插件时仍须检测目标 DSH 版本和查询真实契约，不能把本次 master 快照声明为所有版本的兼容保证。
