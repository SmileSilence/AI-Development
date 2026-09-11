# 0.7.2 实施与验证记录

## 修改结果

- `sidebar.workspaces` 注册优先级调整为 `10000`，作为宿主单实例槽位的后备提供者；常规优先级的其它工作区插件可以接管侧栏。
- 本插件不再声明公共 `sidebar.workspaces.directoryFlow` 子插槽，新增工作区改为直接调用宿主目录选择能力，消除多插件重复声明冲突。
- 插件补丁取消强制停用 `ui-workspace-archive-manager`；日常 `web` 配置中的历史停用项也已移除。
- 批量键盘焦点容器 `.listArea` 隐藏浏览器默认轮廓，并且只在批量模式进入键盘顺序。Ctrl、Shift、Ctrl+Shift 与 Ctrl+A 的选择逻辑保持不变。

## 自动验证

- `npm run check`：类型检查、10 个测试文件、126 项测试、构建、版本检查和打包预检全部通过。
- 隔离 DSH：工作区后备界面与新增按钮正常显示；Ctrl+Shift 连续选中 3 个工作区；焦点仍位于 `.listArea`，计算样式 `outline-style: none`；无页面异常。
- 日常插件组合：移除 `ui-workspace-archive-manager` 停用项后，DSH Host 与浏览器端均正常启动；工作区界面可用，增强插件的“标签管理”设置仍可用；无 `already declared` 或其它页面异常。

## 证据

- `browser-evidence.json`：批量焦点与选择结果。
- `compatibility-evidence.json`：日常插件组合共存结果。
- `bulk-selection-no-focus-outline.png`：批量选择无外层白框截图。
- `daily-plugin-coexistence.png`：日常组合启动后的界面截图。
