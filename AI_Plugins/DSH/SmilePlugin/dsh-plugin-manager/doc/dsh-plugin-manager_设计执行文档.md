# dsh-plugin-manager 设计+执行文档（唯一权威计划）

> 文档版本：1.0.0 | 插件版本：0.2.0 | 形态：可安装插件包
> 基座：dsh-skill-mcp-panel v2.0.2（重构）| 目标 DSH：v0.1.2-alpha.4（已核实）
> 依据技能：dsh-plugin-creator（含 references/package-development.md）、dsh-plugin-dev-kb、design-execution-document、skill-creator、coding-workflow

## 0. 定位与合规

- 以 dsh-skill-mcp-panel v2.0.2 为基座重构出统一 dsh-plugin-manager：新增插件管理模块（移植旧 dpm 核心，**不携带历史+回滚**），并把 Skill 分类 UI 从「工作区/分组横向滚动栏」改为「按类型下拉菜单」；MCP 面板保留。
- 满足 dsh-plugin-creator 判定：插件包形态；运行时接口核实（§A.1）；职责定义（§6X）；生命周期与可选能力降级（§6X）；四种表示（§6Y）；LocalStorage 约定（§6Z）；独立安装 7 步 + 版本门禁链 + CDP e2e（§9）；项目标准（§6A.4）。
- 参考源码归档：`doc\references\dsh-skill-mcp-panel-main\`（与本文档同目录）。

## 1. 需求映射（6 项）

| # | 需求 | 落点 |
|---|---|---|
| 1 | 抽出历史+回滚（保留核心） | 新插件不移植 dpm 的 history/rollback（决策 D1） |
| 2 | 修复卸载/启用/停用失败 | §6C（移植时按根因修复） |
| 3 | 不显示已卸载插件 | §6C（过滤悬挂声明） |
| 4 | 异常项处理 | §6C（结构化异常 + 逐项动作） |
| 5 | Skill 分类改下拉菜单、按类型分 | §6B（去掉横栏，改 `metadata.category` 类型下拉） |
| 6 | 集成到 dsh 设置插件管理部分 | §6E（settings.plugins.tab + settings.section×2） |

## 2. 现状核查

- 旧插件 `DeepSeekPluginManager\` = dsh-plugin-manager v0.1.14：11 个 dpm_* 工具（含 4 个历史工具）、webServer 路由、loader 注入、settings.plugins.tab、lib\core.js 1164 行。**已归档作参考，不删除**。
- 旧设计文档 8 条漏洞已废弃：引用描述造假（参考真实但目录树/代码编造）、REST 假架构、假存根、忽略真实实现、症状无根因、Skill 需求无依据、泛化空话、时间脱节。
- 基座 dsh-skill-mcp-panel v2.0.2 真实架构：客户端 `__ModuleLoader__.load` 注册 `settings.section`（skills order 16 / mcp order 16.5）；Typert RPC（skillsViewer/mcpManager）；skill 存储 `~/.dsh/skills` + 工作区 `.dsh/skills`（停用 = 改名 `*.disabled`）；MCP 受管块写 cordis.patch.yml；chokidar provider。

## 3. 根因分析（插件管理移植时修复）

- 卸载：`dsh plugin remove` = pnpm 转发器，成功后不校验、不清理 `dsh.profile.bundles` 残留；跨盘 EPERM 无兜底；退出码 0 但清单未变当成功。
- 启停：正则改写 patch；特殊字符 rowId 被拒绝；`already` 误报；toggle 后不重读状态。
- 显示已卸载：`dependencies` 中 `installed:false` 悬挂声明照常返回。
- 异常：`scan.anomalies` 仅字符串无处理。

## 4. 设计决策

- **D1**：不移植 history/rollback（旧包归档保留）。
- **D2**：Skill「类型」= `metadata.category`（skill-creator），缺失回退 `rel` 顶层目录段。
- **D3**：新插件替代 dsh-skill-mcp-panel（安装时卸载参考插件防 settings.section id 冲突）；MCP 受管块标记沿用 `dsh-skill-mcp-panel:mcp`。

## 5. 包结构

```
dsh-plugin-manager\            （DSH\SmilePlugin\dsh-plugin-manager\）
├── package.json / cordis.patch.yml / tsconfig.json / CHANGELOG.md / README.md
├── scripts\check.mjs           # 版本门禁链
├── src\
│   ├── index.ts                # 宿主 apply：typert manifest + 工具 + provider + 路由
│   ├── client.ts               # 客户端：settings.plugins.tab + settings.section×2
│   ├── plugin\{scan.ts, patch.ts, service.ts}   # 插件管理（移植+修复）
│   ├── skill\{skill-files.ts, scope.ts, groups.ts, provider.ts}
│   ├── mcp\{patch-editor.ts, gateway.ts, model.ts, probe.ts, status.ts, wire.ts}
│   └── shared\{types.ts, codecs.ts}
├── lib\                          # tsc 编译产物（随仓提交）
├── test\                         # vitest（由基座 *.mjs 迁移）
└── doc\
    ├── dsh-plugin-manager_设计执行文档.md
    └── references\dsh-skill-mcp-panel-main\
```

## 6. 分系统实施变更

### 6A 脚手架与工程化
- 6A.1 运行时接口核实：DSH v0.1.2-alpha.4（harness checkout 已核实）；node v24.18.0 / pnpm 11.7.0；dsh CLI 不在 PATH（命令走 node 直启 / pnpm --dir）。
- 6A.2 版本门禁链：scripts\check.mjs 断言 package.json 版本 pin、结构检查、单测/构建/打包依次通过；CHANGELOG/README/文档随版本同步。
- 6A.3 构建：tsc 编译 lib/（随仓提交）；prepack 自动构建。
- 6A.4 项目标准：界面/注释/文档中文，文件名与标识符英文，语义化版本。

### 6B Skill 面板改造
- skill-files.ts 扩展 frontmatter 解析 `metadata.category/publisher/platforms/keywords`；缺 category 回退 rel 顶层段。
- client.ts 技能面板：去掉工作区分栏与分组横栏，顶部下拉按类型筛选；每行作用域徽标；迁移/分组保留为次级对话框。
- 偏好落 LocalStorage（§6Z）。

### 6C 插件管理模块
- plugin\scan.ts：scanProfile/mergeLoaderEntries/classify/detectDuplicates；anomalies 结构化。
- plugin\patch.ts：enable/disable 修复（rowId 转义、状态统一、patchPath）；remove 修复（成功后校验 dependencies+bundles、EPERM 识别）。
- plugin\service.ts：Typert remote pluginsViewer（list/install/enable/disable/remove/report/duplicates/anomalyAction）。
- 列表过滤 dangling/仅-loader 条目，折叠「悬挂声明（N）」+ 清理动作。

### 6D MCP 面板（基座保留）
list/add/edit/enable/disable/delete/test + HMR + 脱敏。

### 6E 设置集成
settings.plugins.tab（id dsh-plugin-manager, order 20, label 插件管理）+ settings.section（skills order 16 / mcp order 16.5）；安装前卸载参考插件（D3）。

### 6F 工具/CLI 面
dpm_list/install/enable/disable/remove/report/duplicates/anomaly_action；dsh-panel CLI 保留 skill/mcp，新增 plugin 子命令。

### 6X 职责与生命周期
- Host 数据所有者/变更执行；Client 呈现/交互；UI 入口见 6E；硬依赖 inject（typert/skills/slots/locale/remote/sessions/loader）；可选能力（webServer、浏览器、openNativePath——缺失降级）。
- typert manifest / skills provider（chokidar）/ slots / locale / 工具 / 路由注册一律 ctx.effect()/disposer；客户端 apply 重复执行自愈拆旧。
- webServer/浏览器缺失时 dpm_* 工具照常工作。
- 验证卸载/失败激活/HMR 无残留。

### 6Y 工具四种表示
execute 返回 zod 校验无损业务 JSON；render 有界文本；presentationMeta 纯函数投影（回放不重执行业务）；嵌套调用有界持久化投影；只序列化自有 JSON。

### 6Z 客户端用户配置
LocalStorage 键名 `dsh-dsh-plugin-manager:<key>`，read/write/subscribe；写入后本页回填；菜单打开前兜底刷新；单测覆盖回填/跨标签页/旁路写入。

## 7. API / 数据 / 数据流

- 工具：dpm_list/install/enable/disable/remove/report/duplicates/anomaly_action（无历史工具）；skillsViewer/mcpManager 保留；CLI 增 dsh-panel plugin。
- 数据：Skill 沿用 `~/.dsh/skills` + 工作区 `.dsh/skills`；MCP 沿用受管块；插件管理沿用 profile 清单 + data\plugins.json；无 history.json。
- 数据流：用户操作 → client Tab → Typert remote → host service → 文件系统/loader → 重扫 → 回传；异常流 scan.anomalies → 异常面板 → anomalyAction → 修复 → 重扫。

## 8. 边界与失败模式

Skill：frontmatter 损坏归「其他」；*.disabled 不列；同名多作用域精确操作；bundled 只读。插件管理：补丁原子写、正则只匹配首个块、转义后旧块兜底；卸载残留清理失败返回明细；双通道失败结构化报错。MCP：受管块外逐字节保留、锁防并发、env/headers 缺省保留旧值、外部改动校验失败不覆盖。插槽冲突由 D3 规避。

## 9. 测试与验收

1. vitest：基座 test-*.mjs 迁移全绿；插件管理（扫描/补丁/卸载无残留/异常动作）；Skill 分类（下拉按 category、无横栏、多作用域徽标）；MCP 受管块往返；LocalStorage 三单测。
2. 冒烟/e2e（临时 profile）：安装 dshmarket → 停用 → 启用 → 卸载 → 重扫无残留；悬挂声明清理；异常动作。
3. 独立安装 7 步：打 tgz → 隔离临时 DSH_HOME（构建后 DSH CLI 启动，repo node_modules 不参与）→ 从安装目录解析依赖 → --dump-config 确认实际树 → 挂载 → 代表性调用 → 卸载 → 重启 → 清理。
4. CDP 浏览器 e2e：独立 DSH_HOME + 端口，headless Edge/Chromium 经 CDP，断言 DOM 最终状态，落盘证据 JSON。
5. 验收清单对照 §1 六项需求 + §0 合规判定。

## 10. 实施阶段

1. 阶段一 基座吸收 + 接口核实（§6A）
2. 阶段二 Skill 分类改造（§6B + §6Z）
3. 阶段三 插件管理模块（§6C + §6X + §6Y）
4. 阶段四 集成收尾（§6D/E/F + §9 独立安装 7 步 + CDP e2e + 文档/CHANGELOG/README 同步）

## 11. 决策记录

| 决策 | 默认值 | 状态 |
|---|---|---|
| D1 | 不移植历史+回滚 | 已确认 |
| D2 | 类型 = metadata.category 回退 rel | 已确认 |
| D3 | 替代参考插件；受管块标记沿用 | 已确认 |

## 12. 实施状态（2026-09-04）

已完成：阶段一（基座吸收 + dsh-typert-protocol 接口核实 + 版本门禁链 check.mjs）；阶段二（Skill 分类改造：skill-files parseFrontmatter 元数据解析、index.ts list() 下发 category、client 类型下拉 + 作用域徽标，构建通过）；阶段三（插件管理 host 模块 src/plugin/{scan,patch,service,tools,cli}.ts + index.ts 合并 PLUGINS_MANIFEST + 注册 dpm_* Agent 工具 + 设置页「插件管理」Tab 与 pluginsViewer 远程贡献 + LocalStorage 持久化 dsh-plugin-manager:<key>）；阶段四（dsh-panel plugin 子命令、README/CHANGELOG 同步、check.mjs 通过）。

测试：基座 13 个 test-*.mjs 全绿；新增 test-plugin.mjs（7 项）与 test-skill-category.mjs（4 项）全绿；client 束在 mock __ModuleLoader__ 下加载并通过 apply() 注册 settings.plugins.tab（order 20）；CLI 对真实 web profile 执行 plugin list/duplicates/report 通过。

未做（需独立安装 / 浏览器环境）：§9.3 独立安装 7 步、§9.4 CDP 浏览器 e2e——受当前环境（dsh CLI 不在 PATH、无浏览器会话）限制，列入发布前清单。

*创建时间：2026-09-04*
