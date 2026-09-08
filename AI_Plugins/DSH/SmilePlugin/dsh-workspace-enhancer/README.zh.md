# dsh-workspace-enhancer

DSH (DeepSeek Harness) 右侧工作区增强插件。

## 功能

1. **工作区置顶 + 会话置顶** — 工作区 `···` 菜单、会话 `···` 左侧快捷按钮与 `···` 菜单
2. **悬停 Codex 式信息卡** — 工作区目录可点击，在系统文件管理器打开
3. **右键 = `···` 菜单** — 工作区菜单含「打开工作区」
4. **空白区右键** — 新建工作区 / 新会话
5. **批量归档会话 + 批量删除工作区**（归档语义：界面消失、数据保留磁盘）
6. **会话默认模式选择器** — 标题栏上方类权限选择器，选择新建会话默认 agent preset
7. **工作区/会话标签** — 集成 dsh-workspace-tagger：标签显示在工作区/会话名称左侧，并支持双色胶囊、行内微着色和标签管理设置页；标签管理页和行内标签弹窗都可修改标签颜色（配置 `tags.enabled` 可开关）
8. **标签弹窗下拉 + 运行标签增强** — 设置标签改为单个下拉菜单（运行中标签不出现，只在设置页配置）；折叠工作区显示「运行标签名×N」；运行中会话/有运行会话的工作区自动置顶
9. **标签筛选（飞书式 7 种操作符）** — 工作区标题栏右侧「筛选」漏斗按钮（仅宽侧栏）弹出筛选面板：多条件行、行间 AND，每行独立选择范围（全部/工作区/会话）与条件（等于/不等于/包含/不包含/包含全部/为空/不为空 7 种操作符），标签选择（等于/不等于单选、包含族多选、为空/不为空无值），支持添加/删除条件行、清除全部，实时显示「已筛选 N 项」；筛选生效时按钮高亮 + 角标；搜索框与图标按钮保持同一组紧挨

## 安装

```bash
# npm（发布后）
dsh plugin --profile web add dsh-workspace-enhancer

# tarball 离线
dsh plugin --profile web add ./dsh-workspace-enhancer-0.5.0.tgz

# git（需 pnpm allowBuilds 授权 prepare 脚本）
dsh plugin --profile web add github:user/dsh-workspace-enhancer#<sha>
```

全局生效：把 patch 行追加到 `$DSH_HOME/cordis.patch.yml`（所有 profile 共享）。

## 卸载

```bash
dsh plugin --profile <name> remove dsh-workspace-enhancer
```

核对四处清单（dependencies、dsh.profile.bundles、node_modules、patch 层）确认无残留。

## 开发

```bash
npm install
npm run check   # typecheck + test + build + pack dry-run
```
