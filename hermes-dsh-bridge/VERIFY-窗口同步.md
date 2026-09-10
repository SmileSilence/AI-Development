# 验证：Hermes 发的消息能否在 DSH 窗口看见

## 已验证的机制（源码级确认）

1. **Hermes → DSH 会话写入**：Hermes 通过 headless 委派 DSH 时，会话完整写入
   `~/.dsh/sessions/--D-Work-AI-Development-hermes-dsh-bridge--/session-*.zstd`
   （已确认 3 个会话存在）

2. **投影缓存同步更新**：headless 写入时同时更新了
   `~/.dsh/storages/session_projcache/sessions/<id>.json`
   （已确认 bridge 会话的投影缓存存在，含标题）

3. **工作区注册**：桌面端会话列表按工作区分组，工作区记录在
   `~/.dsh/storages/workspace.json`。
   ⚠️ 目前 **bridge 工作区未注册**（只有 AI_Plugins / AI_Skill / Tools 三个）。
   桌面端**启动时**扫描 `~/.dsh/sessions/` 目录，为新工作区建记录。

## 结论

**重启 DSH 桌面端后端后**，Hermes 发起的 bridge 会话就会出现在
DSH 窗口的会话列表里（归入 hermes-dsh-bridge 工作区）。

## 验证步骤（1分钟）

1. 在 DSH 桌面端按 `Ctrl+Shift+R`（重启后端）
   —— 或完全退出再打开 DSH 桌面端
2. 等 DSH 重新加载完成
3. 查看会话列表：应该出现 **hermes-dsh-bridge** 项目分组，
   里面有 3 个 Hermes 发起的会话（标题为"你是 Hermes 委派的子代理(dsh)。"等）
4. 点开其中一个，能看到完整的任务委派对话

## 如果依然看不到

- 确认 headless 会话的 zstd 文件确实存在（见上）
- 检查 `~/.dsh/storages/workspace.json` 是否新增了 hermes-dsh-bridge 记录
- 尝试完全退出 DSH 桌面端进程再启动（非仅重启后端）

## 长期方案（可选）

如果要「无需重启、实时同步」，需要给 DSH 写一个插件：
监听 `~/.dsh/sessions/` 目录变化，自动把新会话注册到 workspace.json +
投影缓存。这是 DSH 官方插件机制的活（DSH 有 smilexx-dsh-plugin-creator 技能可参考）。
