# smilexx-skill-mcp-manager

DSH **技能管理 + MCP 管理**面板，全部集成在 DSH Web 设置页。

基于 [dsh-skill-mcp-panel](https://github.com/Fishquito7/dsh-skill-mcp-panel) v2.0.2 重构：只保留技能与 MCP 两个页签（挂在官方「插件」设置入口下），移除插件管理模块（清单/安装/功能重复等改由 dshmarket / `dsh plugin` 命令承担）。

## 功能

### 技能管理（设置 → 插件 → 技能）
- 按 **类型（`metadata.category`）下拉筛选**，不再按工作区/分组横栏分类
- **单列列表行**：每行 = 圆形图标 + 技能名 + 单行描述 + 作用域标签 + 启停开关；**点击行弹出详情**（DSH 原生 Modal：SKILL.md 内容、启停开关、删除/关闭）
- 启用/停用（改名 `SKILL.md.disabled`）、删除、添加（单文件 / 目录束 / zip / 拖放）
- 批量迁移 / 分组（次级对话框，保留基座能力）

### MCP 管理（设置 → 插件 → MCP）
- 管理 profile `cordis.patch.yml` 受管块：Stdio / HTTP 两种调用方式
- **单列列表行**：每行 = 圆形图标 + 服务器名 + 摘要（transport/状态/工具数）+ 编辑/测试/删除 + 启停开关；**点击行弹出详情**（状态、配置键值、已发现工具、测试/删除/编辑/关闭）
- 新增、编辑、启停、删除、测试连接；保存后 HMR 热加载
- `env` / `headers` 密钥脱敏（详情仅显示键名）

## 安装

```bash
# 先卸载被替代的旧插件（避免设置页插槽 id 冲突）
dsh plugin --profile web remove dsh-plugin-manager
# 安装本插件（tarball 或本地目录）
dsh plugin --profile web add <smilexx-skill-mcp-manager-0.4.1.tgz>
```

重启网关（`dsh-restart`）后刷新页面。

## 命令行

```bash
dsh-panel skill list                 # 技能列表
dsh-panel mcp list                   # MCP 服务器列表
dsh-panel skill enable|disable <name>
dsh-panel skill delete <name> [--yes]
dsh-panel skill add <path> [--project | --workspace <path>]
dsh-panel skill scope <name> [--global | --workspace <path>] [--copy]
dsh-panel skill migrate <name...> --from <ws> --to <ws> [--copy]
dsh-panel mcp add|remove|enable|disable|test <name>
```

## 开发

源码 TypeScript（`src/`），编译产物 `lib/*.js` 随仓提交。修改后运行 `pnpm build`，发布前 `node scripts/check.mjs`（版本门禁链）。

## License

MIT
