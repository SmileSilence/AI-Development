# 0.7.1 实现与验证报告

## 实现结果

- 运行状态设置默认进入紧凑预览态，只显示启用状态、编辑入口、模拟会话行及名称／效果／速度摘要。
- 编辑态使用独立草稿；取消时丢弃草稿，保存成功后更新摘要并折叠，保存失败时保持展开并显示错误。设置页重新挂载后回到预览态。
- 标签胶囊只保留静态底色、名称和数量。运行效果统一迁移至完整会话行；工作区只在折叠且包含运行会话时显示整行动效。
- 分组、单列表和搜索结果复用 `RunningRowEffect`。选中、批量选中、悬停和菜单打开时宿主底色优先，边缘效果仍保留。
- 四种效果继续由集中注册表管理；底色、主色、辅色和周期通过 CSS 变量传递。减少动态效果时停止动画并保留静态提示。
- `runningTag` schema 与 `RunningTagEffect` 保持 0.7.0 兼容。

## 自动验证

- `npm run typecheck`：通过。
- `npm test`：9 个测试文件、123 项测试全部通过。
- `npm run build`：通过，生成 `lib/index.js` 与 `lib/client.js`，CSS 注入文件已同步。
- `npm run check:version`：README、CHANGELOG 与包版本均为 0.7.1。
- `npm pack --dry-run` 与正式 `npm pack`：通过。
- `git diff --check`：通过。

## 独立 DSH 浏览器验证

验证环境为 DSH `0.1.3-alpha.1-d347e70`、Edge Chromium、独立 `DSH_HOME` 和合成会话数据。机器可读结果见 [browser-evidence.json](./browser-evidence.json)，24 项检查全部通过且无页面异常，覆盖：

- 默认紧凑预览、编辑展开、草稿隔离、取消、保存折叠与刷新后折叠。
- 无动效、边缘流光、跑马灯、渐变流动及减少动态效果。
- 分组、单列表、搜索结果、折叠工作区与展开工作区。
- 标签胶囊静态、悬停、当前会话、菜单打开和批量选中层级。
- 浅色与深色主题截图。

截图：

- [浅色紧凑预览](./settings-compact-light.png)
- [浅色编辑态](./settings-edit-gradient-light.png)
- [深色紧凑预览](./settings-compact-dark.png)
- [深色运行会话行](./running-session-rows-dark.png)

## 包与日常配置

- 包：`dsh-workspace-enhancer-0.7.1.tgz`
- 大小：77,779 字节
- SHA-256：`C62608A623765EC0A04496AB9B801B5A80C1FF4E1621A99FDFE02B6A6EF2514C`
- 日常 `web` 配置已从 0.7.0 升级至 0.7.1。
- `package.json`、`pnpm-lock.yaml`、实际解析的 `node_modules/dsh-workspace-enhancer/package.json` 和插件列表均解析为 0.7.1；bundle 列表仍只包含一个 `dsh-workspace-enhancer` 条目。
- 日常配置在 `127.0.0.1:13072` 完成启动冒烟测试，进程正常保持运行且工作区增强插件无加载错误；随后已停止验证进程。日志中仅有另一个已安装浏览器技能插件缺少 `bsk` CLI 的既有警告。
