---
name: smilexx-blender-link
description: 驱动本机 Blender 进行建模、场景、材质、渲染等自动化操作（Agent Link TCP 链路，含新电脑一键安装）。用户要求操作 Blender、建模、渲染、场景搭建，或需要探活/安装 Blender Agent Link 时使用。
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: Blender Agent Link 控制技能（可移植，新机一键装链路）
  category: AI工具
  platforms: [DSH, Claude, OpenAI/Codex]
  keywords: [blender, 3d, 建模, 渲染, agent-link, 自动化]
---

# smilexx-blender-link

通过 `127.0.0.1:9876` 的 JSON-over-TCP 链路在 Blender **主线程**内执行 Python，实现建模、场景、材质、渲染自动化。技能自包含：`scripts/agent-link-server.py` 为服务端，新电脑只需运行一次安装脚本。

**适用前提**：Windows + 本机装有 Blender（GUI 模式）。

## 一、触发条件

### 自动触发
- 用户说「在 Blender 里建/渲染/改」「链接 Blender」「Blender 探活/装链路」
- 任务需要 bpy 操作：建模、材质、灯光、相机、渲染导出

### 不触发
- UE / Unity 项目（使用对应 smilexx 技能）
- 安装或升级 Blender 软件本身

## 二、核心功能

1. **一键装链路**：`install-agent-link.ps1` 自动探测 Blender 并把服务端装入启动目录（幂等，支持 `-Status` / `-Launch` / `-Test` / `-Uninstall`）
2. **执行 Python**：`blink.ps1 -File <py>`（推荐写文件再发，避免转义）/ `-Code <单行>` / `-Ping`
3. **结果回传**：脚本内把返回值赋给 `__result__`；`print` 走 stdout；异常带完整 traceback

## 三、快速上手

```powershell
# 首次在这台电脑使用（装过 Blender 但没配过链路）
.\scripts\install-agent-link.ps1          # 安装服务端到 Blender 启动目录
.\scripts\install-agent-link.ps1 -Launch  # 启动 Blender（禁用 --factory-startup）
.\scripts\blink.ps1 -Ping                 # 探活：返回 Blender 版本 / PID / 当前文件

# 日常：写脚本 → 发送
.\scripts\blink.ps1 -File .\build.py -TimeoutSec 300
```

## 四、详细指南

- `references/blender-link.md`：协议字段表、安装器开关详解、排障表、建模脚本模式（清理旧 collection → 建几何 → 灯光相机 → 渲染 → `__result__`）
- 限制速记：单次执行超时上限 600 秒；9876 端口先到先得；`--factory-startup` 与后台模式（`--background`）下链接不可用

## 五、注意事项

- 服务端随 Blender 启动自动加载；重装或升级 Blender 后重跑安装脚本即可
- 代码在主线程执行：GUI 被模态操作占用时客户端等待直到超时
- 中间脚本按全局配置放 `<项目目录>\Temp\<任务名>`，成品放用户指定处

## 六、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-09-16 | v1 | 初始版本；服务端 / 客户端 / 安装器三件套；协议在本机 Blender 5.2 实测验证 |
