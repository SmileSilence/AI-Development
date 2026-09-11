# DSH 通知管理插件

`smilexx-notification-manager` 1.0.1 适配 DSH 0.1.5-rc.2，在“设置 → 插件 → 通知管理”集中管理任务完成、权限请求以及问题/计划确认通知。所有插件及派生对外标识均使用 `smilexx-notification-manager*` 前缀。

## 功能

- 任务完成通知支持“关闭”“仅失焦时”“始终”三种模式。
- 权限请求和问题/计划确认可分别启停。
- 使用浏览器标准 Notification API，兼容 DSH Desktop 与普通浏览器。
- 通知仅包含固定类型和会话标题，不包含消息正文、问题、工具参数或错误内容。
- Web Locks + BroadcastChannel 保证同源多页签仅由一个页面发送；不支持 Web Locks 时自动使用过期租约选主。
- 点击通知会聚焦 DSH 并打开对应会话。

## 安装

```powershell
npm install
npm run check
npm pack
dsh plugin --profile web add .\smilexx-notification-manager-1.0.1.tgz
```

重新启动 DSH web profile 后，在“设置 → 插件 → 通知管理”点击“发送测试通知”完成系统授权。插件加载时不会主动请求权限。

卸载命令：

```powershell
dsh plugin --profile web remove smilexx-notification-manager
```

## 开发验证

`npm run check` 依次执行类型检查、单元测试、构建、版本一致性检查和 `npm pack --dry-run`。所有订阅、页面协调频道、Web Lock、样式和通知点击处理均随 Cordis 插件生命周期清理。
