# Cordis 会话内动态插件开发

依据 DeepSeek 官方技能中文改编，见[来源与许可](sources.md)。此流程用于进程内的临时动态插件；可安装插件包的持久化、模块和构建规则见[插件包开发](package-development.md)。

## 查询、定义与运行

1. 发现并调用 `cordis_inspect_list`，取得当前 Host（宿主端）和 Client（客户端）的 Provider（能力查询提供方）、方法和输入结构。
2. 用最少的 `cordis_inspect_query` 查询，核实本次需要的 Service（服务）、Event（事件）、Builtin（内置符号）、Slot（界面插槽）、主题或工具协议。目录描述接口可用范围，不证明服务当前已经挂载。
3. 新插件设计首个 Package（不可变代码版本）；修改旧插件先用 `cordis_inspect_self(pluginId, packageId)` 读取原代码、版本指针和诊断。
4. 向用户展示具体代码，再调用 `cordis_define`。`code.host` 和 `code.client` 均为返回 Cordis 插件的纯 JavaScript 函数体。定义只产生版本，不会执行 `apply`、请求运行审批或更新 current。
5. 使用 define 实际返回的 `pluginId`、`packageId` 调用 `cordis_run`。首次启动使用 `run`；已有成功版本时切换到不同版本使用 `update`。
6. 从运行卡片、系统状态通知或 `cordis_inspect_self` 判断审批、依赖等待、客户端加载与渲染结果。收到 `awaiting-approval` 或 `starting` 后结束当前工具流程，等待平台异步通知；不能同步轮询等待用户，也不能报告为成功。
7. `cordis_stop` 暂停效果并保留版本、授权和指针；`cordis_undefine` 永久删除插件、全部版本及历史业务视图，仅在明确不再需要时使用。

工具未暴露时应说明缺少哪些能力，以及需要在哪个 DSH 会话继续。不得依据技能中的示例假装查到了实时接口，也不得擅自改成交付静态包。

## 平台选择与查询路径

下表是导航示例，实际 Provider、方法名、参数与返回类型必须来自当前 `cordis_inspect_list`，不能硬编码后直接使用。

| 需求 | 平台 | 查询重点 |
| --- | --- | --- |
| 文件、命令、进程、网络 | Host | `Service.listService` 中相关服务，如 fs、bash、subprocess、pty、web |
| Agent、持久化会话业务数据、宿主生命周期 | Host | 目标服务及 `Event.listEvents` |
| 注册下一模型步骤可调用的动态工具 | Host | `Builtin.listBuiltins` 中的 harness，以及 `Tool.listTools` |
| 设置、侧边栏、输入区、卡片和悬浮层 | Client | `Slots.listSubTree` |
| 页面主题与状态 | Client | `Theme.listTokens`、客户端服务与插槽参数 |
| 宿主取数据、客户端展示 | 两端 | 宿主服务与 `harness.handle`；插槽与 `host.call` |

- `Service.listService`：先查看用途和签名，再按 `service` 查询访问约束、方法参数、返回值及相关类型。
- `Event.listEvents`：先查看用途、分派模式、监听器签名，再按 `event` 查询详细契约。
- `Builtin.listBuiltins`：查询求值器提供、不能从 `ctx.get()` 取得的符号及签名。
- `Slots.listSubTree`：先无 `root` 查看实际树，再带准确 `root` 查看目标插槽完整协议、参数、占用者及替换风险。
- `Theme.listTokens`：只查询允许覆盖的主题变量，不会修改主题。
- `Tool.listTools`：读取当前 Agent 实际可见的工具及结构，包括动态工具。

使用最靠近数据所有者的能力。插槽已经提供会话快照或页面数据时，直接读取需要的字段，不额外增加宿主请求；不要把查询目录当成业务数据展示。

## 动态执行环境

`code.host` / `code.client` 不经过 TypeScript、JSX 或打包器编译。不能使用 `import`、`require`、类型标注、`as`、装饰器和 JSX。`window`、`document`、`process`、`Buffer`、`fetch` 或原生计时器等全局变量，不能在未获当前 Builtin 契约支持时使用。

客户端用 `React.createElement(...)` 创建元素，元素通过插槽注册。`apply()` 注册生命周期贡献，不能直接返回 React 元素。以下为已查询目标插槽协议后的示意：

```js
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      () => React.createElement('div', null, '状态已就绪'),
    ))
  },
}
```

示例中的插槽与符号仍需按本次运行时查询结果确认。

## 服务、事件与清理

可选服务默认用 `ctx.get(name)` 读取并处理 `undefined`。需要缺失时进入等待、在服务出现后重新激活的硬依赖，才声明 `inject`。直接访问 `ctx.serviceName` 必须先在返回的插件对象上声明对应依赖，不能为了省略空值检查把可选服务全部改成硬依赖。

```js
return {
  inject: ['timer'],
  apply(ctx) {
    ctx.timeout(() => console.log('延迟任务完成'), 300)
  },
}
```

Host 与 Client 的 `timer` 都是服务，不是 Builtin。先在对应平台查询 `{ "service": "timer" }`，声明 `inject: ['timer']` 后才能使用 `ctx.timeout` / `ctx.interval`。组件内周期任务可由 `React.useEffect(() => ctx.interval(callback, 1000), [])` 返回清理函数；不要调用未提供的全局 `setTimeout`。

- 用 `ctx.on()` 注册事件，先确认参数顺序、返回值与模式。Waterfall 监听器最后一个参数是 `next`，除非有意终止链条，否则调用并返回它。
- 用 `ctx.effect(() => service.subscribe(callback))` 管理返回清理函数的外部订阅。若订阅没有返回清理函数，先查询真实注销方式，不能假设卸载会移除任意第三方回调。
- 服务、工具、插槽、计时器和主题 API 返回的清理函数应交给对应作用域管理；停止、更新或删除后所有贡献必须解除。
- 不在 `apply()` 之外或模块级创建进程级、页面级副作用。

## 客户端插槽、页面数据与样式

查询准确插槽后，核实它采用 `single`、`list`、`keyed` 还是 `chain` 协议，以及选项、注册键、标准参数、业务所有者参数和当前占用者。不能猜测 `id`、`key`、selector（选择器）或参数。

用 `ctx.get('slots')` 处理可选服务，再用 `slots.inject` 等待插槽声明，在回调内返回 `slots.register` 的结果。`ctx.get('slots')` 不要求硬依赖；只有声明 `inject: ['slots']` 后才能写 `ctx.slots`。

| 界面需求 | 选择规则 |
| --- | --- |
| 完整设置页面 | 查询 `settings.section`，注册独立区块 |
| 单个通用偏好 | 查询 `settings.general.item`，保持紧凑 |
| 与本次 Package 结果相关的交互 | 查询 `tool.view.cordis`，按契约使用 `key: 'self'` |
| 普通模型工具卡片 | 查询 `tool.call.toolview`，键为工具名；确认 Tool 结构与 `ToolCallOwnerProps` |
| 提示、状态通知、全局浮层 | 查询 `shell.overlay`，遵守指针事件、层叠和显示/隐藏规则；明确拖动需求 |
| 侧边栏小操作 | 优先查询 `sidebar.footer.action` 等内部增量入口 |
| 一轮会话后的补充内容 | 查询 `conversation.chat.turnTail`，遵循链式选择器及回退规则 |

不要默认替换 root、sidebar、conversation 或 details 等整块根级区域；替换占用者可能同时移除其子插槽。普通工具卡片已有键的注册也可能替换默认卡片。

`tool.view.cordis` 的 `self` 绑定 `pluginId + packageId`，不要加入 `pluginRunId`。同一 Package 多次运行时，最新 Run 卡片承载界面，旧卡片会降级。设置、侧边栏等功能应使用各自入口，不能全部塞进运行卡片。

会话作用域可能通过参数提供 `useSession`、`useSessions`、`useWorkspaces`、`useProjection`、输入状态和操作，按查询契约读取必要字段。临时动态插件的设置状态保存在本次插件内存中，不额外添加持久化设置机制；这不禁止通过既有宿主服务完成用户授权的持久化业务操作。

全局主题先查 `Theme.listTokens` 和客户端 `theme` 服务，按协议提供浅色/深色值并管理清理函数。仅修改自有组件样式时使用 `styles.insert(css)` 与主题 CSS 变量，先确认 Builtin；新增内容先选插槽。不要操作 `document.body`、`window` 或硬编码产品 DOM 选择器来替代插槽和主题接口。

## 两端私有通信与动态工具

宿主通过 `harness.handle(method, handler)` 注册 Package 私有方法；客户端使用 `host.call(method, args)` 调用。这是 Client → Host 的 JSON RPC（远程过程调用），先查两端 Builtin 签名。

```js
// 宿主代码：只返回自己构造的业务值。
return {
  apply(ctx) {
    harness.handle('read-state', async (args) => ({ value: args.key }))
  },
}
```

```js
// 客户端代码：等待宿主响应就绪再使用。
return {
  async apply(ctx) {
    const result = await host.call('read-state', { key: 'demo' })
    console.log(result.value)
  },
}
```

参数和返回值必须是无损 JSON；无返回数据时返回 `null`。不能传函数、React 元素、类实例、Context、Service 或其他运行时对象，也不要为包内通信注册公共 Remote Service 或改用 `ctx.remote`。

动态模型工具在 Host 用当前 `harness` 接口注册：先通过 `Builtin.listBuiltins` 查签名，再用 `Tool.listTools` 查冲突和结构。工具在下一模型步骤可调用，注册必须属于当前 Plugin Fiber（插件运行作用域），以便停止或更新时自动移除。

`execute` 负责业务结果，render / presentation 只负责模型和界面展示；输入输出均须兼容 JSON。Service、事件载荷、插槽参数、会话快照及工具状态属于内部实时对象，不能整体 `JSON.stringify`、`structuredClone`、递归枚举或长期保存。先读取必要的字符串、数值、布尔等叶子值，再构建自有 JSON。

## 版本、审批与恢复

`pluginId` 是稳定插件实例；`packageId` 是不可变代码版本；`pluginRunId` 是一次激活尝试。`currentPackageId` 指最近成功的版本，不代表插件当前正在运行；`nextPackageId` 可能正在等审批、激活、等待客户端，或是最近失败的目标。

| 当前状态 | 目标版本 | `cordis_run` 的 mode |
| --- | --- | --- |
| 没有 current | 同一插件下的目标 Package | `run` |
| 已有 current | 同一个 Package，启动或恢复 | `run` |
| 已有 current | 不同 Package，切换版本 | `update` |
| 更新失败 | `nextPackageId`，针对可恢复的运行问题重试 | `update` |
| 更新失败 | `currentPackageId`，回滚旧版 | `run` |

客户端版本尚未获授权时会返回 `awaiting-approval`。官方界面单勾只授权当前 Package，双勾授权同一 Plugin 的未来版本；技术失败后授权仍保留。授权后的 `starting` 表示浏览器异步启动，仍须等实际结果。用户拒绝授权后，不自动重试或新建插件绕过拒绝。

技术失败时先读取失败版本源码和精确诊断，包括 `client-render` 堆栈；未知能力重新 list/query。代码修复必须在原 Plugin 下定义新 Package，不能覆盖失败版本，再按 current/target 关系选择运行模式。不要盲目重复失败操作。

更新失败不会自动恢复旧版本的实际 Run。需要恢复时，明确对 `currentPackageId` 使用 `run` 并检查结果。

### 修改用户指定的 `@pluginId`

1. 从注入身份信息取得基准版本，再调用 `cordis_inspect_self(pluginId, packageId)` 读取实际代码，不能把身份摘要当成源码。只有 pluginId、没有版本摘要时，先按实际 `cordis_inspect_self` 工具结构查询插件与版本指针；不猜测 packageId，也不虚构工具支持的参数。
2. 只修改目标端代码，保留无需修改的 Host 或 Client 半部。
3. 用 `plugin.kind: 'existing'` 和原 `pluginId` 定义新版本；使用返回的 `packageId`，通常通过 `update` 激活。
4. 引用不存在时说明可能已删除、属于另一会话或在进程重启后丢失；不能创建同名替代实例。

## 验证

按实际功能检查：服务缺失/就绪、定义不运行、首次激活、客户端审批与异步结果、插槽真实渲染、两端通信、下一步骤工具可见性、停止后的资源清理、版本更新失败及显式回滚。状态和诊断指向确切 Run；未收到完成结果时保留未完成状态。
