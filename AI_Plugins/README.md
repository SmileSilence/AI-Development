# AI_Plugins — AI 插件分类

本目录用于按 Agent 平台集中管理插件开发资料、自有插件源码和第三方插件索引。

## 目录结构

```text
AI_Plugins/
├── README.md                       # 本分类说明
└── DSH/                            # DeepSeek Harness 插件
    ├── README.md                   # DSH 插件维护说明
    ├── OtherPlugin/                # 第三方插件索引与本地工作区
    └── SmilePlugin/                # SmileXX 自有插件源码
```

## 管理规则

1. 插件先按 Agent 平台分类，再区分第三方插件与 SmileXX 自有插件。
2. `OtherPlugin/` 中下载的源码、压缩包和本地适配产物不上传 GitHub；仅上传说明文档和后续建立的公开清单。
3. `SmilePlugin/` 中由 SmileXX 创建并允许发布的插件与工具直接纳入本仓库统一管理，不保留嵌套 `.git` 仓库。
4. 新增平台或插件后，同步更新对应平台的 `README.md` 和根目录分类导航。
