# dsh-plugin-manager

DSH 统一插件管理器：**插件管理 + 技能管理 + MCP 管理**，全部集成在 DSH Web 设置页。

基于 [dsh-skill-mcp-panel](https://github.com/Fishquito7/dsh-skill-mcp-panel) v2.0.2 重构，新增插件管理模块并改造技能分类 UI。

## 功能

### 插件管理（设置 → 插件 → 「插件管理」Tab）
- 插件清单（状态/版本/描述/启用情况/异常项统计）
- 安装（含功能重复检测）、启用/停用（HMR 生效）、卸载（校验 `dependencies` 与 `dsh.profile.bundles` 无残留）
- 功能重复扫描（可直接停用/卸载重复项）
- Markdown 清单生成（面板复制 / `dsh-panel plugin report`）
- 异常项：结构化展示 + 逐项处理动作 + 诊断复制
- 不携带旧版 dsh-plugin-manager 的操作历史与回滚功能

### 技能管理（设置 → 插件 → 插件管理 → 技能）
- 按 **类型（`metadata.category`）下拉筛选**，不再按工作区/分组横栏分类
- 卡片列表：展开查看 SKILL.md 内容；行内作用域徽标（全局/工作区）
- 启用/停用（改名 `SKILL.md.disabled`）、删除、打开目录
- 批量迁移 / 分组（次级对话框，保留基座能力）

### MCP 管理（设置 → 插件 → 插件管理 → MCP）
- 管理 profile `cordis.patch.yml` 受管块：Stdio / HTTP 两种调用方式
- 新增、编辑、启停、删除、测试连接；保存后 HMR 热加载
- `env` / `headers` 密钥脱敏

## 安装

```bash
# 先卸载被替代的旧插件（避免设置页插槽 id 冲突）
dsh plugin --profile web remove dsh-skill-mcp-panel
# 安装本插件（tarball 或本地目录）
dsh plugin --profile web add <dsh-plugin-manager-0.2.2.tgz>
```

重启网关（`dsh-restart`）后刷新页面。

## 命令行

```bash
dsh-panel skill list                 # 技能列表
dsh-panel mcp list                   # MCP 服务器列表
dsh-panel plugin list                # 插件清单（含异常项）
dsh-panel plugin install <spec> [--keep auto|all|new|existing] [--category <name>]
dsh-panel plugin enable|disable <name>
dsh-panel plugin remove <name> --yes
dsh-panel plugin report               # 生成 Markdown 插件清单
dsh-panel plugin duplicates           # 功能重复检测
dsh-panel plugin anomalies            # 异常项
dsh-panel plugin anomaly-action <plugin> <kind>   # cleanup | remove | retry | manual
```

## 开发

源码 TypeScript（`src/`），编译产物 `lib/*.js` 随仓提交。修改后运行 `pnpm build`，发布前 `node scripts/check.mjs`（版本门禁链）。

## License

MIT
