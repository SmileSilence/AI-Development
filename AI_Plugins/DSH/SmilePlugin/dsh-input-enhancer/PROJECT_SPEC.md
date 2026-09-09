# dsh-input-enhancer 项目规格（2.3.1）

## 目标

在 DSH Web GUI 输入栏提供三项增强：分类命令菜单、Plan 模式按钮与实时调整方向，
完全替代旧版 1.0.0 与 `dsh-plan-switch` 0.3.2 的能力。
2.1.0 追加：命令按来源插件分类、菜单打开置顶、常驻开关状态可见。
2.3.0 追加：保留原生队列按钮，在删除后增加可终止当前活动并自动继续的“调整方向”。
2.3.1 追加：按钮复刻 Codex 的折向箭头与文字结构，配色继承 DSH 主题令牌。

## 实时调整方向

- 仅处理主会话中仍位于 `next-turn` 的排队消息。
- 点击后保留其余队列，取消当前活动，将所选消息移动到队首，并锁存后继轮次唤醒。
- 原生编辑、删除与“插话发送”全部保留；调整方向按钮位于删除之后、插话之前。
- Host 与 Client 通过 `directionAdjust.adjust(sessionId, itemId)` 类型化远程接口通信。

## 非目标

- 不创建自有的命令目录：菜单数据直接来自原生输入触发器候选快照（含其他插件贡献）。
- 不接管命令执行：选择、参数认领、发送全部走原生控制器管道。
- 不修改 DSH 内核源码；不发布 npm/GitHub。

## 功能规格（对应设计文档）

### F1 分类命令菜单
- 仅 `launcher === 'command'`（点击 `+` 打开）且菜单打开时显示分类视图。
- 固定分类：模式（plan, goal）/ 模型（model）/ 权限（permission）/ 会话（compact, retry, clear, new, fork, export）。
- 插件分类（v2.1.0）：未知分类命令按来源插件归组（owners.js 三层：localStorage
  `dsh-input-enhancer:commandOwners` > 运行时拦截 CommandUiRuntime.register/decorate >
  内置默认表 rewind/undo → dsh-rewind-plugin），按行首次出现序排在固定分类之后。
- 其他：三层归属都未命中的命令兜底，保留原始相对顺序；空分类（含其他与插件分类）隐藏。
- 空分类隐藏；组内按原生候选顺序；行携带 (source, originalIndex)。
- 交互：mousedown 选择、mousemove 悬停、钻取（Tab 提示 + 按钮）、面包屑（如有）。
- 键盘：菜单打开期间捕获阶段接管 ArrowUp/ArrowDown（按视觉顺序移动原生高亮，环绕）；
  输入法组合（isComposing / keyCode 229）放行；Enter/Tab/Escape 走原生仲裁。
- 每次打开置顶（v2.1.0）：新代次打开时视口 scrollTop 归零、高亮同步到视觉首行
  （Enter 恒触发所见首项；同代次内输入过滤不重复抢滚动）。
- 关闭/切换会话/卸载即解除监听；外部指针点击（菜单与输入栏卡片之外）关闭。
- 原生分支（`/`、`@` 来源）渲染与原生 MenuView 行为兼容的视图（提取自目标提交，保留 MIT 版权）。

### F2 Plan 按钮
- 席位 `conversation.input.plan`，priority -100，注入面提供按会话绑定的 `execute`（仅 `/plan` 与 `/plan off`）。
- 三态：关闭（中性样式）/ 开启（沿用原生 warn 样式 + × 图标）；常驻 = 开启 + 偏好为真。
- 右键菜单：仅「默认 Plan」开关项（Menu，side=top, align=start, portal）。样式（v2.2.0）：icon 槽渲染
  14px 方框勾选（勾选态 √、未勾选空框），右侧文本位置固定；状态即时同步（v2.1.1：writePreference
  本地通知 + 打开菜单前从存储兜底刷新，杜绝状态与实际不一致）。
- 偏好键 `dsh-input-enhancer:defaultPlanMode`；读写失败提示且保持页面选择；storage 事件跨标签页同步。
- 自动应用：常驻且会话加载完成（未锁定、无 pending、无在途请求）时，每会话最多一次；
  意图先入列再于微任务复核（可撤销尚未发送的自动任务）；任一入口退出 Plan 后本停留不重开；
  失败不无限重试，显示中文提示并允许手动重试。
- 防竞态：锁定/提交中/原生 pending 禁用按钮；会话代次 + 卸载标记隔离旧回调；投影普通更新不新建周期。

## 技术约束

- 客户端入口 `inject: ['slots']`（硬依赖），功能服务按需 `ctx.inject`。
- 平台外置模块清单（构建 external + 测试别名桩）：`scripts/check.mjs` 白名单。
- 测试：jsdom + @testing-library/react；原生 UI 包以测试桩替代（`src/tests/stubs/ui-primitives-stub.jsx`）。

## 质量门槛

`pnpm run build`、`pnpm test`（86 项全绿）、`pnpm run check`、`pnpm run pack`、`pnpm run test:e2e`（真实浏览器 8 项，含 E6 打开置顶）全部通过；
Stage C 独立安装后浏览器实测；Stage D 替换线上 Web 插件并验证可回滚。
