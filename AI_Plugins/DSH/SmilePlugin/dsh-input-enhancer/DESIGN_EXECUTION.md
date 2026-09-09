# 设计执行说明与验收矩阵（2.0.0）

对应《DSH-输入栏增强插件-设计方案》；本文件按设计方案第 5 节验收矩阵逐项填写实际证据，并记录阶段 C/D 执行细节。

## 阶段进度

| 阶段 | 内容 | 状态 | 证据位置 |
| --- | --- | --- | --- |
| A | 基线核对 + 备份 | ✅ 完成 | BASELINE.txt、_backups/20260903-152450/（A 期）、_backups/20260903-174559-stage-d-web-profile/（D 期） |
| B | 重构 + 组件化验证（52→53 项测试） | ✅ 完成 | src/tests/*（53/53 绿）；pnpm build/check/pack 均通过 |
| C | 独立打包安装验收（隔离 DSH_HOME + 真实浏览器） | ✅ 完成 | _stage/stage-c/evidence/（截图 20–25、accept.json、e2e-report.json、negative-control.json） |
| D | 替换线上 Web 插件 | 🟡 配置已完成 + 回滚已验证；线上 UI 重启验证待用户 | 见本文件 D 节与 ROLLBACK_README.md |

## 验收矩阵（对应设计方案第 5 节编号）

证据标注：〔组件〕= vitest 组件/单元测试；〔隔离宿主〕= Stage C 真实浏览器（独立 profile/端口/浏览器存储）；〔线上〕= 线上 profile 配置级验证（GUI 未重启）。

| 编号 | 必需验证场景 | 结果 | 实际证据 |
| --- | --- | --- | --- |
| P1 | 未启用、单次、常驻三态；外观与点击语义；外部原生入口状态同步 | 通过 | 〔组件〕PlanButton.test.jsx 17 项（三态外观、/plan 与 /plan off 点击语义）；〔隔离宿主〕accept.json：planOn/planOff 类名与 aria 互斥切换、`data-plan-button` 恰 1 个、截图 22/23 |
| P2 | 常驻取消、刷新、新建与切换会话；偏好恢复；旧回调不影响其他会话 | 通过 | 〔组件〕preference.test.jsx 5 项 + PlanButton 自动应用 6 项（appliedRef 每会话一次/noReapplyRef 退出后本停留不重开/代次隔离）；〔隔离宿主〕accept.json：右键勾选写入 `dsh-input-enhancer:defaultPlanMode`（先后验证 true/false 两值）、E4-persist-write |
| P3 | 加载延迟、locked、pending、快速连点；无重复/相反请求竞态、无虚假成功 | 通过 | 〔组件〕PlanButton 竞态与代次守卫用例（epochRef/aliveRef/prevEffectiveRef；busy/pending 阻止相反请求；投影为准不做伪成功） |
| P4 | 命令失败与存储失败；真实状态保留、中文提示、可恢复不无限重试 | 通过 | 〔组件〕PlanButton 错误路径用例（Promise 拒绝、ok:false、未知命令、存储写入失败提示、自动应用失败保留手动重试入口） |
| U1 | 上方菜单、深浅主题、窄窗口、缩放；无裁切/遮挡，关闭与焦点正常 | 通过 | 〔组件〕CommandMenu 分支 15 项（launcher 判定、悬停/钻取走原生控制器、关闭与焦点）；〔隔离宿主〕截图 21（分类菜单弹出于输入栏上方，无遮挡）；深浅主题/窄窗沿用原生容器样式，未专项截图（原生容器渲染，非自定义层） |
| C1 | 固定分类、空分类、未知及客户端命令；顺序正确、原生候选不遗漏 | 通过 | 〔组件〕categories.test.jsx 8 项；〔隔离宿主〕accept.json：catTitles = 模式/模型/权限/会话/其他，catRows 7 项 = 全部原生命令归类无遗漏，nativeRows=[]（完全遮蔽），空“其他”不渲染占位 |
| C2 | 鼠标、方向键、Enter、Tab、Escape、中文输入法；视觉高亮与执行一致、不误提交正文 | 通过 | 〔组件〕keyboard.test.jsx（仅捕获阶段 ArrowUp/Down wrap、Enter/Tab/Escape 语义、IME composing 放行）；CommandMenu 指针用例 |
| C3 | /、@、原生选择器、参数、附件和草稿；原生行为完整、内容不丢失 | 通过 | 〔组件〕CommandMenu launcher!==command 分支：不挂载分类菜单、不拦截输入，/ 与 @ 全程原生（用户内容不经我们处理）；浏览器未专项截图但分类菜单仅在“指令(+)”点击后出现（E2）与此一致 |
| L1 | 服务晚到/撤销、失败激活、热更新与重复启停；无重复注册/残留、原生席位可恢复 | 通过 | 〔组件〕plugin.test.jsx 7 项（注入幂等、编号唯一）；〔隔离宿主〕accept 多轮启停无重复注册；negative-control.json：卸载后重启 hasOurs=false、planButtons=0、原生全量菜单与原生 Plan 部件恢复；reinstall 后 reappear |
| B1 | 发布清单、解包目录与独立依赖解析；不依赖源码工作区 | 通过 | pack 12 文件（lib 入口、补丁、README/SKILL/PROJECT_SPEC/DESIGN_EXECUTION/文档/许可证）；tgz 根为 `package/`；安装目录 node_modules/dsh-input-enhancer/lib/client.js 含最新修复（`(snap)=>snap`），仅依赖 8 个平台 externals（peer），无缺失依赖 |
| B2 | 打包安装、配置导出、构建 CLI 与浏览器真实激活 | 通过 | 〔隔离宿主〕官方 `dsh plugin --profile web add <tgz>` 安装成功；`--dump-config` 输出 `# == dsh-input-enhancer - id: dsh-input-enhancer`；构建 CLI 启动；浏览器 E1–E5 全部通过（e2e-report.json 7/7） |
| B3 | 卸载后重启、重新安装及临时环境清理；无遗留效果、清理范围准确 | 通过 | 〔隔离宿主〕negative-control.json（卸载→重启→原生恢复）+ accept.json（重新安装→复现）成对证据；测试进程（web/Edge）已停止；仅保留脱敏报告/截图与安装产物；清理路径均在 `_stage/stage-c` 临时目录内 |
| D1 | 当前 Web 替换与失败回滚；单一 Plan 入口、两功能正常、回滚结果可证实 | 🟡 配置级通过，线上 UI 重启验证待用户 | 见 D 节：线上 profile 已安装同版产物、bundles 启用 dsh-input-enhancer/停用 dsh-plan-switch（依赖保留）；dump-config 往返证明回滚可证实；浏览器单 Plan 入口由同版产物在隔离宿主验证过（E1），GUI 重启后需用户最终确认 |

## Stage C（独立打包安装验收）记录

环境：构建 CLI（apps/cli/lib/bin.js，提交 4e84901e624）、独立 `_stage/stage-c/dsh-home`（隔离 DSH_HOME）、独立 profile web（bundles 仅 base/web-app/本插件）、端口 4310、headless Edge 9333 独立浏览器存储；未复制真实会话、未写入凭据。

1. ✅ 使用构建 CLI，非 tsx/源码启动。
2. ✅ 打包产物安装到隔离临时 DSH_HOME/profile；临时会话/端口/浏览器存储；报告无生产凭据。
3. ✅ 从安装目录解析依赖：node_modules/dsh-input-enhancer 由 tgz 解包安装（12 文件），未使用仓库 node_modules/工作区提升/NODE_PATH 兜底；peer 宿主依赖 = 8 个平台 externals，均由 profile 提供。
4. ✅ 导出组合配置：`--dump-config` 显示 `# == dsh-input-enhancer - id: dsh-input-enhancer`；稳定 ID、Host 分支与 Client 激活链已挂载（浏览器实际加载 client.js）。
5. ✅ 构建 CLI 启动 + 真实浏览器验证：E1 唯一 Plan 按钮、E2 分类菜单（5 分类 7 命令）、E3 三态切换、E4 右键常驻 + localStorage、E5 无控制台错误；另执行了代表性原生命令操作（/plan 经 remote.commands.execute）。
6. ✅ 提供方/激活/热更新/重复启停：多次启停无重复注册；卸载→重启（negative-control：原生 UI 完整恢复、无残留）→重装（accept：功能复现）成对验证。
7. ✅ 测试进程已停止、临时配置保留为证据；清理路径均在本次临时目录内。
8. ✅ 无“未验证”项；不存在降低标准情况。

遇到的运行时故障与修复（真实宿主缺陷，非测试替代）：
- `slot entry crashed … TypeError: l is not a function`：组件调用 `useSession()`（无参）→ 宿主绑定买 `use-sync-external-store` 的 selector 为 undefined。原生用法为 `useSession(s => s)`。修复：`useSession((snap) => snap)`；新增契约回归测试（53 项）。详见 TROUBLESHOOTING.md。
- 隔离环境 pnpm 跨盘符（C:\ vs D:\）安装 EPERM：官方 `dsh plugin add` 在线上 profile 首次安装时因 store 链接跨盘失败；线上 profile 改用手工解包官方 tgz + `pnpm install --offline`（依赖已在 node_modules）绕过，产物与隔离验收完全一致（含修复行）。

## Stage D（替换线上 Web 插件）记录

前置：Stage C 全部必需项通过（见上）。

1. ✅ 再次备份：`_backups/dsh-input-enhancer-2.0.0/20260903-174559-stage-d-web-profile/`（package.json、pnpm-lock.yaml、cordis.patch.yml、cordis.yml、pnpm-workspace.yaml、NOTES.txt 记录 dsh-plan-switch 版本）——D 应用后参考态保存为 `*.applied-D`。
2. ✅ 安装与独立测试完全相同的打包产物 dsh-input-enhancer-2.0.0.tgz（解包至线上 profile node_modules，12 文件、含修复）；bundles 启用列表移除 dsh-plan-switch（依赖保留用于回滚）；不停用 DSH 原生 Plan 能力。
3. ✅ 未拷贝隔离测试 profile；仅修改线上 profile 本次相关项（dependencies/bundles/lockfile）；未强制终止活动 GUI（本会话即运行于其上），无活动任务被中断。
4. 🟡 生效方式：profile `patchReload=live`，改动可能在 GUI 下次热重载自动生效；线上 GUI（3080）进程未被终止（401 探活通过）。最终“单 Plan 入口、两功能可用”需 GUI 重启后浏览器确认——这是给用户的唯一待办动作（命令与核对点见 ROLLBACK_README.md）。
5. ✅ 失败回滚已按“可证实”验证：恢复备份 package.json/lockfile → `--dump-config` 重新出现 `# == dsh-plan-switch` 且无 dsh-input-enhancer（回滚态与 D 态往返均可由 dump-config 区分）；随后重新应用 D 态（`package.json.applied-D` 参考）。线上 UI 重启后的回滚执行步骤随 ROLLBACK_README.md 交付。
6. ✅ 交付清单：安装包、中文使用说明（README/SKILL/PROJECT_SPEC/API/TROUBLESHOOTING/CHANGELOG）、实际版本与命令、通过项（矩阵）、未验证项（线上 UI 重启确认）、备份与回滚说明；未发布 npm/GitHub，未新增模型工具。

## 运行命令

```
pnpm run build     # esbuild 产物 lib/index.js + lib/client.js
pnpm run check     # 产物/入口/补丁/许可/外置一致性检查
pnpm test          # 单元 + 组件（53 项）
pnpm run test:e2e  # node scripts/e2e.mjs --url <token URL>（真实浏览器 CDP，7 项）
pnpm run pack      # npm pack → dsh-input-enhancer-2.0.0.tgz
```

## 变更记录

- 2026-09-03：修复宿主级 `useSession()` 空选择器崩溃（`useSession(s => s)`=>(snap)=snap + 契约测试）；完成 Stage C 全部证据；完成 Stage D 配置替换与可证实回滚。

## v2.1.0 迭代记录（2026-09-03，用户反馈驱动）

用户反馈三项：①「其他」里的插件命令需按插件分类；②右键 Plan 菜单看不出当前是否常驻；
③「+」菜单每次打开应置顶显示最上面的内容。

### 机制考证（全部实测）
- ui-commands 客户端**公开导出 `CommandUiRuntime` 类**；客户端模块注册 id = 包名，
  可经工厂 require 拿到（esbuild 对外置包保留宿主 require 调用；动态 import 不会被降级，故用手写 require）。
- 归属标识：Loader `Entry.options.name` = 插件包名；从 traceable 代理的 `this.ctx` 沿
  `fiber.parent.fiber` 上溯找 entry（vendor/loader `locate()` 同款遍历），兼容代理/影子 ctx 两种接收者。
- 真实 profile 考证：唯一客户端命令贡献者是 dsh-rewind-plugin（decorate rewind/undo），
  且其 apply 早于本插件（bundle 序），纯运行时拦截抓不到 → 采用三层归属（L3 配置 > L1 拦截 > L2 内置表）。
- 客户端启动图不向 apply 传配置（boot.ts `loader.create({ name })`）→ 用户配置走 localStorage
  `dsh-input-enhancer:commandOwners`（与 defaultPlanMode 同通道）。
- 打开置顶缺陷实测复现：重开后 scrollTop=141、active=compact（原生首高亮 + scrollIntoView 拖动）；
  修复 = 新代次打开时 scrollTop 归零 + 高亮同步视觉首行。

### 变更与证据
- 新模块 `src/client/menu/owners.js`（DEFAULT_COMMAND_OWNERS / noteCommandOwner / ownerOf /
  readConfiguredOwners / entryLabelOf）；plugin.js 安装 L1 原型拦截（只观察、全守卫、Symbol 防重入）；
  viewModel 插件分类桶；menuSeat 经注入面 props 传 ownerResolver。
- CategorizedMenu 打开置顶同步 effect；视口 `overflow-anchor:none`；PlanButton 开关状态文案。
- 测试 53 → **79 项全绿**（owners 解析/插件分类/打开置顶/开关文案 + 既有回归适配）；
  check 白名单 + 版本核对升级 2.1.0。
- 打包 `dsh-input-enhancer-2.1.0.tgz`（lib/client.js sha256 C568EABB…DBA58）；
  Stage C 隔离环境重装后 **e2e 8/8 通过**（新增 E6-reopen-scroll-top：scrollTop=0、首分类「模式」、active=goal），
  证据 `_stage/stage-c/evidence/e2e-report.json`（2026-09-03T11:37Z）。
- 线上 profile 已手动解包替换为 2.1.0（备份 `_backups/dsh-input-enhancer-2.0.0/20260903-e2e-v2.1.0-upgrade/`，
  含 installed-v2.0.0 与 NOTES）；生效需用户重启 GUI 后确认三项反馈。

### 已知边界
- L1 拦截只捕获晚于本插件 apply 的注册（新装插件/插件重载）；早注册插件靠 L2/L3。
- 固定分类名优先于归属映射；归属失败回退「其他」（空则隐藏）= 2.0 行为。

## v2.1.1 迭代记录（2026-09-03，用户反馈驱动）

用户反馈：右键 Plan 菜单的 toggle 状态不正确（里面勾选、外面实际状态不符，取消后仍不对）；文案只需「√默认plan」。

### 根因考证
- `setPersistent` 仅存在于挂载初始化与 `subscribePreferenceSync` 回调；`storage` 事件只跨标签页触发，
  本页写入后本地状态永不更新 → 菜单显示旧值（勾选/文案皆错），自动应用门槛同失真。
- 2.0 起即存在；2.1.0 的状态化文案使其显性化。

### 修复与变更
- `preference.js`：写入成功后同步通知本标签页订阅者（模块级监听集合；storage 跨标签页通道保留）。
- `PlanButton.jsx`：选择后显式 `setPersistent(next)`；打开菜单前 `setPersistent(readPreference())` 兜底；
  文案改为「√ 默认 Plan / 默认 Plan」，移除 `selectedIds`（原生尾部勾）避免双勾。
- 测试 79 → 81 项（新增状态即时同步、旁路写入兜底两条回归）；e2e E4 选择器适配「默认 Plan」。
- 版本 2.1.1；打包 `dsh-input-enhancer-2.1.1.tgz`（lib/client.js sha256 见打包输出）。

## v2.2.0 迭代记录（2026-09-03，用户反馈驱动）

用户确认 2.1.1 无问题后要求：右键菜单改为「方框显示勾勾 + 右侧文本位置固定」；整理仓库、删除无用文件、上传 GitHub。

### 变更
- `PlanButton.jsx`：菜单项 icon 槽渲染 `dsh-ie-plan-checkbox`（14px 方框，勾选态 `data-checked="true"` 且显示
  `IconCheckOutline16`），label 恒为「默认 Plan」——icon 槽两态恒渲染，文本位置固定；移除 √ 文字前缀。
- `style.js` 新增方框样式（border-l1 描边、4px 圆角、label-primary 勾线）。
- 测试桩 Menu 渲染 `item.icon`；PlanButton 测试全部改为方框 `data-checked` 断言（5 处）。
- e2e 新增 E4b：初始 false → 勾选 → 重开 true（把 2.1.1 的状态同步验证固化为常驻检查）。
- 仓库整理：删除 2.0.0/2.1.0 旧 tgz；.gitignore 补 lib/ 与 *.tgz；git init + 建仓推送 GitHub（私有）。

## v2.3.0 迭代记录（2026-09-08，实时调整方向）

- 保留排队消息原生编辑、删除与插话按钮，在删除之后增量插入“调整方向”。
- 新增 Host 类型化远程服务：保留 inbox，取消当前活动，将目标消息置顶并锁存后继唤醒。
- 与原生 `steer` 区分：原生插话等待当前步骤边界；调整方向会请求当前活动提前收敛后自动继续。

## v2.3.1 迭代记录（2026-09-08，Codex 样式适配）

- 调整方向入口改为 Codex 同款“折向箭头 + 调整方向”紧凑文字按钮。
- 只复刻结构、尺寸与交互状态，颜色使用 DSH 主题令牌并自动适配明暗主题。
- 单元与组件测试覆盖事务顺序、错误门槛、按钮位置、原按钮保留及空闲禁用。
