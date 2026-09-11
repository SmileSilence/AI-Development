# API 参考

## 调整方向

- Host 服务 `directionAdjust.adjust(sessionId, itemId)`：取消当前活动但保留 inbox（收件箱），将指定
  `next-turn` 消息移到队首，并通过 `followup` 锁存后继唤醒。
- Client 席位 `conversation.input.dock` / `direction-adjust`：不替换原生 QueueDock，仅在删除按钮后追加操作。
- 返回 `{ accepted: true }`；会话空闲、消息不存在或远程服务不可用时返回失败。

## 宿主端导出（lib/index.js）

| 导出 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | `'smilexx-input-enhancer'`（配置行 id） |
| `description` | string | 中文描述 |
| `apply(ctx)` | function | 空挂载（宿主端无业务） |
| `default` | object | `{ name, description, apply }` |

## 客户端入口（lib/client.js / src/client/plugin.js）

- `inject = ['slots']`：条目级硬依赖。
- `apply(ctx)`：`ctx.effect` 注入全局样式（幂等）；安装命令归属拦截（L1，可静默降级）；
  读取用户归属配置（L3，localStorage）；随后两个 `ctx.inject` 动态作用域分别注册
  Plan 席位与菜单席位（服务齐备才生效）。

### Plan 功能（src/client/plan/）
- `planSeat.js`：`registerPlanSeat(scope)` → `conversation.input.plan`（single, priority -100）；
  注入面 `{ execute(line) }` 绑定 `remote.commands.execute(sessionId, line, [])`。
- `preference.js`：`PREFERENCE_KEY = 'smilexx-input-enhancer:defaultPlanMode'`；
  `readPreference()` / `writePreference(value)`（成功后**同步通知本标签页**订阅者，v2.1.1）/ `subscribePreferenceSync(listener)`（本地通知 + 跨标签页 storage 事件）。
- `PlanButton.jsx`：组件 props = 标准套件 + `execute`；三态、右键菜单、自动应用、防竞态。
- `planStyles.js`（并入 style.js）：`injectStylesOnce()` 幂等注入 `dsh-ie-*` 样式。

### 菜单功能（src/client/menu/）
- `owners.js`（v2.1.0）：`DEFAULT_COMMAND_OWNERS`（内置默认表）、`noteCommandOwner(name, label)`（运行时捕获，先到先得）、
  `capturedOwners()`、`ownerOf(name, { configOwners, capturedOwners })`（L3>L1>L2 查找）、
  `readConfiguredOwners(storage?)`（localStorage `smilexx-input-enhancer:commandOwners`，非法回空表）、
  `entryLabelOf(ctx)`（沿 fiber 父链解析 Loader entry 的 name/id，异常安全）。
- `menuSeat.js`：`registerMenuSeat(scope, { ownerResolver })` → `conversation.input.overlay`
  （list, id 'slash-menu', order 0, priority -100）；注入面暴露 menu/headers/launcher 快照
  与 `onPick/onCrumb/onHover/onDismiss`（委托原生控制器，默认动作参数省略）及 `ownerResolver`（命令归属解析）。
- `categories.js`：`CATEGORIES`（模式/模型/权限/会话）与 `categoryKeyOf(name)`。
- `viewModel.js`：`buildCategorizedModel(snapshot, { ownerResolver? })` 纯函数 → 行/分类/索引映射/高亮键/代次；
  分类顺序：固定分类 → 插件归属分类（首现序）→ 其他。
- `keyboard.js`：`attachCategoryKeys({ enabled, viewOf, onHover })` 捕获阶段方向键接管。
- `CommandMenu.jsx`：按 launcher 分支（分类视图 / 原生兼容视图）。
- `OriginalMenuView.jsx`：原生 MenuView 兼容提取（MIT，版权见文件头）。

## 平台外置模块（构建 external 白名单）

react, react/jsx-runtime, react-dom, react-dom/client,
@deepseek-ai/cordis, @deepseek-ai/dsh-client-store,
@deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-primitives,
@deepseek-ai/dsh-client-ui-commands（含 /client 子路径；缺失时归属拦截静默跳过）。

## 补丁（cordis.patch.yml）

```yaml
- insert:
    - id: smilexx-input-enhancer
      name: smilexx-input-enhancer
```
