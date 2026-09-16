# Changelog

本插件所有显著变更记录于此。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## 0.1.0（2026-09-17）

### 新增

- 在官方模型设置页自定义 provider 的模型行展开区域注入"图片输入"复选框（DOM 注入，参照 input-enhancer 生产先例）。
- 内置多模态知识库：按模型 id 模式给出"已知多模态 / 已知纯文本 / 未知"建议（glm、qwen-vl、gpt-4o/5、claude、gemini、doubao-vision、deepseek-vl 等），仅提示不自动修改。
- 勾选变更经官方"保存"按钮提交：以 `settings.mutate` 路径操作写 `llm-pi-ai` 命名空间，整组读改写 `models` 数组（与官方卡片同语义），revision 冲突自动重读重试一次。
- 取消官方卡片时丢弃未提交勾选；provider 卡头读取路由 id 精确定位写入目标。
- 仅对用户层已有 `models` 列表的 provider 注入；锚点缺失时静默空操作，不影响原生功能与其他插件。

### 验证

- vitest：知识库匹配、勾选状态计算、models 整组读改写操作构造、revision 冲突重试（27 项全通过）。
- 真实 web profile（DSH 0.1.6-alpha.1）浏览器实测：
  - 展开 glm-5.3-flash 模型行，注入"图片输入"复选框 + "已知多模态"提示，样式与官方展开区一致；
  - 勾选 → 官方"保存" → settings.yaml 写入 `input: [text, image]`，YAML 其余内容与注释保留；
  - 重开编辑卡勾选回显正确；勾选后点官方"取消"不落盘；
  - 官方再编辑上下文窗口并保存，`input` 字段存活（官方 patch 保留未编辑字段）；
  - 其他已装插件（input-enhancer 样式与命令菜单、模型选择器）功能正常，控制台零报错；
  - 发送带图消息：glm-5.3-flash 准确识别三色块测试图（橙底 + 蓝/绿/黄），无 `session/attachment-invalid` 拦截。

### 修复

- 实测修正 `settingsScope.describe()` 读取链：其返回 mirror face，命名空间数据在 `getSnapshot().view.namespaces`；首次扫描前调用 `ensure()` 等待镜像就绪。
- 模态常量表预留扩展位；DSH llm-pi-ai 当前仅支持 text/image，视频等新模态待上游 schema 开放后同步。
