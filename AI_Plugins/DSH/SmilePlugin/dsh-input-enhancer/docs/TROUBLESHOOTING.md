# 故障排查

## 常见问题

### 席位渲染崩溃：`slot entry crashed in conversation.input.plan: TypeError: l is not a function`
- 根因（真实宿主缺陷）：组件调用了 `useSession()`（无参）。宿主将标准套件 `useSession` 绑定到
  `use-sync-external-store` 的选择器钩子，必须传函数选择器；无参时内部 selector 为 `undefined`，
  生产构建里报 `l is not a function`。原生组件一律写 `useSession(s => s)`。
- 修复：`useSession((snap) => snap)`（已内置并增加契约回归测试，见 PlanButton.test.jsx “契约”用例）。
- 排查：先确定是哪个席位（`conversation.input.plan` / `conversation.input.overlay`）、组件内每个
  标准套件钩子是否都传了选择器；`useProjection(key, selector?)` 可省略选择器（内部默认恒等），
  `useSession` / `useSessions` / `useWorkspaces` 必须传选择器。

### 分类菜单不出现，还是原生菜单
- 插件未生效：确认 `dsh` 配置中 `dsh.profile.bundles` 含 `smilexx-input-enhancer`，
  且 `cordis.yml` 有 `smilexx-input-enhancer` 配置行；重载页面后再试。
- 确认在**输入栏 `+`** 打开（`/`、`@` 保持原生菜单是预期行为）。

### Plan 按钮未见或出现两个 Plan
- 会话加载中未见属正常；两个 Plan 说明仍有其他插件占用同一席位（如 `dsh-plan-switch` 未卸载），
  请移除冲突插件后重载。

### 自动开启 Plan 不生效
- 检查偏好：右键 Plan → “常驻 Plan 模式”是否勾选（LocalStorage 键 `smilexx-input-enhancer:defaultPlanMode`）。
- 会话必须：已加载完成、未锁定、无 pending（原生投影 pending 期间跳过）、无在途请求。
- 本停留内已通过任何入口退出过 Plan 时不再自动重开（设计如此）；切换会话后按偏好重新判定。

### 提示“常驻偏好未持久化”
- 浏览器禁用了存储（隐私模式/站点策略），读写失败。插件保持当前页选择并继续工作，
  但跨标签页与新会话不会保留偏好。

### 右键菜单的常驻状态与实际不一致（历史缺陷，2.1.1 已修复）
- 根因：`writePreference` 写入后本标签页收不到 storage 事件（它只跨标签页触发），组件本地状态
  停留旧值——菜单勾选显示旧状态、自动应用门槛也随之失真。
- 修复：写入成功后同步通知本标签页订阅者（preference 本地通知）+ 选择后显式回填状态 +
  打开菜单前从存储兜底刷新。如仍遇到请确认运行 2.1.1+。

### 插件命令没有归到对应插件分类（都堆在“其他”）
- 归属三层优先级：localStorage 配置 > 运行时捕获 > 内置默认表（rewind/undo → dsh-rewind-plugin）。
- 运行时捕获只对**晚于本插件启用**的插件生效（更早注册的插件靠内置表/用户配置补齐）；
  插件重载（HMR）后会被捕获。
- 手工指定：控制台执行
  `localStorage.setItem('smilexx-input-enhancer:commandOwners', JSON.stringify({ 命令名: '插件显示名' }))`
  后刷新页面；删除该键即恢复默认。
- 固定分类名（plan/goal/model/permission/compact/retry/clear/new/fork/export）永远优先于归属映射。

### “+”菜单打开后停在中部（历史缺陷，2.1.0 已修复）
- 根因：原生首高亮指向“首个原生候选”，经分类重排后可能位于列表中部，scrollIntoView 把视口拖走。
- 修复：每次打开（新代次）滚动归零并把高亮同步到视觉首行；如复现请确认运行的是 2.1.0+。

### 提示“命令失败：…”
- `/plan` 或 `/plan off` 执行失败（如会话忙线）。显示真实状态的错误码与信息，
  可点击 Plan 手动重试；自动路径不会无限重试。

## 回滚（Stage D 备选）

1. 停止 Web 服务；
2. 恢复 `<profile>/package.json` 备份（移除本插件依赖、重新加入 `dsh-plan-switch` 依赖与 bundles 条目）；
3. 重启并重载页面，确认恢复单个原生 Plan；
4. 备份副本位于 `_backups/smilexx-input-enhancer-2.0.0/`。

## 诊断命令

```bash
pnpm run check    # 构建产物/入口/补丁/许可/外置依赖一致性
pnpm test         # 单元与组件测试
dsh --profile <p> --dump-config   # 查看当前生效配置
```