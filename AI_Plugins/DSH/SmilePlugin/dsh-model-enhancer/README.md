# smilexx-model-enhancer

增强 DSH（DeepSeek Harness）模型设置页：在自定义 provider 的模型行展开区域内注入**图片输入能力勾选**与**知识库建议**，解决第三方多模态模型（如火山方舟接入的 GLM 系列）因未声明 `input` 字段而被会话层拦截图片的问题。

## 解决的问题

DSH 的 llm-pi-ai 适配器对模型图片输入的判定依赖模型条目的 `input` 字段（`[text, image]`）。通过设置页手动添加的模型没有该字段入口，解析链落到默认 `[text]`，会话层在用户消息携带图片时直接报 `session/attachment-invalid`（模型不支持图片）——即使模型本身是多模态的。

本插件在官方设置页的模型行展开区（"上下文窗口 / 最大输出 token"所在区域）注入一个"图片输入"复选框：

- 勾选 → 该模型条目写入 `input: [text, image]`；
- 取消勾选 → 删除 `input` 字段，恢复继承默认（`[text]`）；
- 旁边按内置知识库显示"已知多模态 / 已知纯文本 / 未知"建议，不自动修改任何配置。

写入与官方设置页走同一条 `settings.mutate` 链路（revision 冲突守卫、注释保留的原子落盘），且仅在用户点官方"保存"按钮后提交，官方"取消"则丢弃勾选变更。llm-pi-ai 热生效，无需重启。

## 适用范围

- 仅影响 `llm-pi-ai` 命名空间下、用户层（`settings.yaml`）显式声明了 `models` 列表的 provider（官方设置页添加或手写均算）；继承部署配置（cordis.yml base 层）模型的 provider 不注入，避免把继承值固化进用户层。
- 官方 DeepSeek 家族模型已在目录中声明图片能力，不在本插件范围。

## 已知限制

- 注入依赖官方设置页 DOM 锚点（CSS Modules 本地名 `modelEntry`/`modelRow`/`modelAdvanced`、展开按钮 `aria-label`"容量 N"/"Capacities N"）。DSH 大版本更新若重构该区域，注入会静默失效（不报错、不影响原生功能），需等插件适配。
- 勾选变更在官方卡片打开期间保存在内存中，关闭浏览器标签页即丢失；以官方"保存"提交为准。

## 安装

```powershell
dsh plugin --profile web add smilexx-model-enhancer-0.1.0.tgz
# 重启 DSH 网关后生效
```

## 使用

1. 打开 DSH Web 设置 → 模型 → 自定义 provider → 编辑；
2. 点击模型行右侧"容量"箭头展开；
3. 在展开区勾选/取消"图片输入"，参考旁边的能力建议；
4. 点击卡片"保存"提交（与上下文窗口等字段一并生效）。

## 验证

见 [CHANGELOG.md](./CHANGELOG.md) 各版本的验证记录。开发与验收约定见 `SmilePlugin/README.md`。

## 许可

[MIT](./LICENSE)
