---
name: dsh-input-enhancer
description: 维护 dsh-input-enhancer 插件（分类命令菜单 + Plan 模式按钮 + 实时调整方向）的构建、测试、打包与验收流程。
---
# dsh-input-enhancer 维护

本技能用于 dsh-input-enhancer 2.3.1 的构建、测试、打包与验收。

## 常用命令

```bash
pnpm run build      # 构建 lib/index.js + lib/client.js
pnpm test           # vitest 单元/组件测试（含调整方向事务与按钮顺序回归）
pnpm run check      # 静态验收（产物/入口/补丁/许可/外置依赖）
pnpm run pack       # 生成 dsh-input-enhancer-2.3.1.tgz
pnpm run test:e2e   # Stage C 浏览器端到端验收
```

## 关键约束

- 宿主端 `lib/index.js` 只提供空 `apply`；全部业务在客户端 `lib/client.js`。
- 客户端 bundle 只能依赖平台外置模块（react / @deepseek-ai/cordis / dsh-client-store /
  dsh-client-ui-slots / dsh-client-ui-primitives / dsh-client-ui-commands 等，
  见 `scripts/check.mjs` 白名单）。
- 命令归属拦截包装的是宿主 `CommandUiRuntime.prototype`：只观察、全守卫、可静默降级，
  任何改动不得影响原生注册/装饰行为。
- 功能通过 `ctx.inject` 动态作用域独立注册，互不阻塞；席位 `priority: -100` 覆盖原生默认优先级。
- 界面文字、注释、文档一律简体中文；文件名与标识符用英文。
- 不得修改 DSH 内核；不得发布到 npm/GitHub。
