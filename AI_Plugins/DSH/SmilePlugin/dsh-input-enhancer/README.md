# dsh-input-enhancer

# dsh-input-enhancer

GitHub: https://github.com/SmileSilence/dsh-input-enhancer

DSH Web GUI 输入栏增强插件（2.3.1）：**分类命令菜单** + **Plan 模式按钮** + **实时调整方向**。

- 分类命令菜单：仅当点击输入栏 `+` 按钮时出现，候选来源为原生命令目录（含客户端插件贡献的命令），
  按固定分类排序：**模式 / 模型 / 权限 / 会话 → 插件分类（按来源插件各一节）→ 其他**。
  选择、钻取与执行全部走原生管道；每次打开菜单自动置顶并高亮首项。
- Plan 按钮：位于输入栏 Plan 席位，三态（关闭 / 单次开启 / 常驻开启），右键菜单可设“常驻 Plan 模式”，
  偏好保存在浏览器同源存储（`dsh-input-enhancer:defaultPlanMode`），新会话/切换会话自动应用。
- 调整方向：运行过程中排队消息的操作区保留所有原生按钮，并在删除按钮后追加“调整方向”。点击会安全停止
  当前生成，把所选消息移到队首并自动启动后继轮次；原生上箭头“插话发送”仍然保留。

## 安装

通过 DSH 插件命令安装本压缩包（不要发布到 npm / GitHub）：

```bash
dsh plugin --profile <profile> add ./dsh-input-enhancer-2.3.1.tgz
```

补丁 `cordis.patch.yml` 会把一行 `dsh-input-enhancer` 插入配置；宿主端注册调整方向远程服务，
客户端资源（`lib/client.js` 经 `window.__ModuleLoader__.load` 注册）登录 Web 会话时自动生效。

## 使用

| 入口 | 行为 |
| --- | --- |
| 输入栏 `+` | 打开分类命令菜单（原生菜单被覆盖为分类视图） |
| `/` 或 `@` | 保持原生命令/引用菜单行为 |
| Plan 空按钮（左键） | 开启当前会话 Plan（等同 `/plan`） |
| Plan 激活态（左键） | 退出当前会话 Plan（等同 `/plan off`） |
| Plan（右键） | 弹出「默认 Plan」开关项：左侧方框勾选（勾选态显示 √），右侧文本位置固定，状态即时同步；勾选/取消写入浏览器同源存储 |
| 排队消息“调整方向” | 停止当前生成，将所选排队消息置顶并自动继续；区别于等待当前步骤结束的原生“插话发送” |

### 命令归属分类（v2.1.0）

未知分类的命令按**来源插件**归组（如 `dsh-rewind-plugin` 的 `/rewind`、`/undo`）。
归属三层优先级：

1. **用户配置**（最高）：浏览器控制台执行
   `localStorage.setItem('dsh-input-enhancer:commandOwners', JSON.stringify({ 命令名: '插件显示名' }))`
   后刷新页面；
2. **运行时捕获**：插件自动包装命令注册/装饰调用，记录来源插件（对晚于本插件启用的插件生效）；
3. **内置默认表**：`rewind`/`undo` → `dsh-rewind-plugin`。

三层都未命中的命令留在「其他」（空则隐藏）。

常驻 Plan 模式：新会话加载完成且空闲时自动开启一次；本停留中任何入口退出 Plan 后不再自动重开（避免“打死不退出”），
切换会话仍按偏好处理。自动开启失败会显示中文提示，可手动重试；不无限重试。

## 开发

```bash
pnpm install        # 安装开发依赖（含 esbuild 构建脚本授权）
pnpm run build      # 构建 lib/index.js（宿主空挂载）与 lib/client.js（客户端 bundle，外置平台模块）
pnpm test           # vitest 单元 + 组件测试（jsdom，86 项）
pnpm run check      # 静态验收：产物/入口/补丁/许可/外置依赖一致性
pnpm run pack       # 生成 dsh-input-enhancer-2.3.1.tgz
pnpm run test:e2e   # 端到端验收（Stage C 独立安装后的浏览器验证入口）
```

## 结构

```text
src/index.js                宿主端入口与调整方向远程服务
src/client/plugin.js        客户端插件：动态作用域注册三个功能
src/client/direction/       调整方向按钮、队列 DOM 增强与远程贡献
src/client/plan/             Plan 按钮：席位/偏好/组件/样式
src/client/menu/             分类菜单：席位/分类表/归属解析/视图模型/键盘接管/菜单组件
src/tests/                  单元与组件测试（jsdom + 测试桩）
scripts/check.mjs            静态验收脚本
cordis.patch.yml             插件安装补丁
```

## 许可

MIT（客户端原生菜单兼容分支保留 DeepSeek 源版权与本 MIT 声明，见
`src/client/menu/OriginalMenuView.jsx` 文件头）。
