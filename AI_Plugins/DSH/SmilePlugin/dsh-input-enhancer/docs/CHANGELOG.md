# 变更日志

## 2.3.1（2026-09-08）

### 变更
- “调整方向”按钮视觉复刻 Codex 的折向箭头与文字布局，同时使用 DSH 主题颜色、悬停色与焦点色，自动适配浅色/深色主题。

## 2.3.0（2026-09-08）

### 新增
- 排队消息操作区新增“调整方向”按钮，保留编辑、删除与原生“插话发送”等全部既有按钮。
- 点击后中止当前活动步骤，将所选排队消息移至队首，并在活动安全收敛后自动启动后继轮次。
- 新增 Host/Client 类型化远程桥接，操作按会话与消息 ID 精确寻址，失败时保留消息并显示中文错误。

## 2.2.0（2026-09-03）

### 变更
- 右键「默认 Plan」开关项改为**方框勾选样式**：icon 槽渲染 14px 方框（勾选态显示 √、未勾选为空框），
  右侧文本位置固定（icon 槽两态恒渲染）；移除 √ 文字前缀。测试桩同步支持 icon 渲染。
- e2e 新增 E4b：方框勾选状态即时同步断言（data-checked false → true）。
- 仓库整理：清理旧构建产物 tgz；补 .gitignore（lib/、*.tgz）；建立 GitHub 仓库
  SmileSilence/dsh-input-enhancer（私有）并推送。

## 2.1.1（2026-09-03）

### 修复
- **右键常驻开关状态与实际不一致**：写入偏好后本标签页不更新本地状态（storage 事件只跨标签页），
  重开菜单显示旧值、自动应用门槛失真。根因修复：`writePreference` 成功后同步通知本标签页订阅者；
  选择后显式回填 `setPersistent`；打开菜单前从存储兜底刷新。新增两条回归测试。

### 变更
- 右键菜单项文案简化为「√ 默认 Plan」（开启）/「默认 Plan」（关闭），移除长状态后缀与原生尾部勾，
  √ 前缀即时反映常驻状态（用户指定样式）。e2e E4 选择器适配。

## 2.1.0（2026-09-03）

输入栏菜单三项优化（用户反馈驱动）。

### 新增
- **命令按来源插件分类**：「其他」中的插件命令不再堆在一起，按来源插件各成一个分类
  （如 dsh-rewind-plugin），排在固定分类之后、「其他」之前。三层归属：
  L3 用户配置（localStorage `dsh-input-enhancer:commandOwners`，JSON 命令名→插件显示名）
  > L1 运行时拦截（包装 `CommandUiRuntime.prototype.register/decorate`，从调用方 ctx 沿
  fiber 链解析 Loader entry 名；只观察不改行为，全守卫，缺失静默跳过）
  > L2 内置默认表（rewind/undo → dsh-rewind-plugin）；归属失败回退「其他」（空则隐藏）。
  新模块 `src/client/menu/owners.js`。
- **「+」菜单每次打开置顶**：新代次打开时滚动回顶部并把高亮同步到视觉首行
  （修复实测重开后 scrollTop=141、高亮停在列表中部的缺陷；Enter 恒触发所见首项）；
  视口加 `overflow-anchor:none` 排除浏览器滚动锚定干扰。
- `scripts/e2e.mjs` 新增第 8 项检查 E6-reopen-scroll-top（滚动→关闭→重开 → scrollTop===0
  且首分类「模式」、高亮 goal），真实浏览器 8/8 通过。

### 变更
- 右键「常驻 Plan 模式」菜单项文案携带状态：「（已开启，点击关闭）/（未开启，点击开启）」，
  保留原生选中勾样式。
- 测试增至 79 项（新增 owners 归属解析、插件分类视图模型、打开置顶同步、开关状态文案）；
  打包物 dsh-input-enhancer-2.1.0.tgz
  （lib/client.js sha256 C568EABB6DABEC4607FD34B66C47F884FEB83CFB850F826B48D4BD682F1DBA58）。

## 2.0.0（2026-09-03）
依据《DSH-输入栏增强插件-设计方案》完成的整体重构。

### 新增
- 分类命令菜单：仅在输入栏 `+` 打开时显示，固定分类（模式/模型/权限/会话/其他）；
  数据来自原生控制器候选快照，选择/钻取/执行走原生管道；上下方向键接管与 IME 放行。
- Plan 按钮三态：关闭 / 单次开启 / 常驻开启；右键菜单“常驻 Plan 模式”；偏好键
  `dsh-input-enhancer:defaultPlanMode`；自动应用（每会话一次、可撤销、不无限重试）。
- 原生菜单兼容分支（`/`、`@` 来源），提取自目标 DSH 提交的 MenuView 行为（MIT 版权保留）。
- 客户端/宿主分层：宿主空 `apply` + 客户端 `window.__ModuleLoader__.load` 注册。
- 测试体系：53 项 vitest 单元/组件测试（含宿主 `useSession` 选择器契约回归）；静态验收脚本 `scripts/check.mjs`；
  真实浏览器端到端驱动 `scripts/e2e.mjs`（`pnpm run test:e2e -- --url <token URL>`，7 项通过）。

### 变更
- 删除旧版单一入口实现与验证用加载器（src/client.js、src/static-loader.js、src/utils）。
- 打包产物改为 `lib/index.js` + `lib/client.js`；平台外置模块白名单化。
- 文档体系重写（README/SKILL/PROJECT_SPEC/DESIGN_EXECUTION/docs/*）。

### 移除
- 1.0.0 旧实现全部源码与旧文档（INSTALL_SUMMARY.md、QUICK_TEST.md、prestart-check.ps1）。
