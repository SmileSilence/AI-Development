---
name: smilexx-photoshop-link
description: 驱动本机 Photoshop 进行绘图、修图、批量处理等自动化操作（COM/DoJavaScript 链路）。用户要求操作 PS/Photoshop 画图、修图、导出，或需要探活 Photoshop 链路时使用。
metadata:
  publisher: SmileXX
  version: "v1"
  short-description: Photoshop COM 自动化控制技能（纯客户端，装了 PS 即可用）
  category: AI工具
  platforms: [DSH, Claude, OpenAI/Codex]
  keywords: [photoshop, ps, com, extendscript, 绘图, 修图, 自动化]
---

# smilexx-photoshop-link

通过 COM 接口 `Photoshop.Application` 的 `DoJavaScript` 在 Photoshop 内执行 ExtendScript，实现绘图、修图、批量处理、导出自动化。**纯客户端**：任何装了 Photoshop 的 Windows 电脑即开即用，无需安装任何服务端。

**适用前提**：Windows + 本机装有 Photoshop。

## 一、触发条件

### 自动触发
- 用户说「用 PS 画/修/处理」「链接 PS」「PS 探活」
- 任务需要 Photoshop：绘图、修图、抠图、批处理、切图导出

### 不触发
- Blender 任务（使用 smilexx-blender-link）
- 通用图像处理且用户未指明 PS（可用其他工具时不必启动 PS）

## 二、核心功能

1. **探活与诊断**：`ps-exec.ps1 -Ping` 返回版本/路径/文档数；`-Doctor` 检查 COM 注册与进程状态
2. **执行 ExtendScript**：`-File <jsx>`（推荐写文件再发，UTF-8 保存）/ `-Code <单行>`
3. **结果回传**：脚本末行表达式的值即返回值；错误信息自带行号

## 三、快速上手

```powershell
# 首次在这台电脑使用（装了 PS 即可，无需安装步骤）
.\scripts\ps-exec.ps1 -Doctor   # 可选：确认 COM 注册与进程状态
.\scripts\ps-exec.ps1 -Ping     # 建链：返回版本，PS 未运行会自动拉起

# 日常：写 jsx → 发送（一个部件一个图层，便于继续编辑）
.\scripts\ps-exec.ps1 -File .\draw.jsx
```

## 四、详细指南

- `references/photoshop-link.md`：COM 调用链、**版本坑清单**（PS 2026 实测：路径 API 报 1280、executeAction 报 8800、select 仅认四点形式）、扫描线椭圆等替代技法、无视觉校验手法
- 写 jsx 的约定：`app.displayDialogs = DialogModes.NO`；`rulerUnits = PIXELS`；末行放返回值表达式

## 五、注意事项

- `DoJavaScript` 同步阻塞：超长脚本由调用方设置足够的外部超时（COM 调用无内置超时）
- PS 未运行时首次 COM 调用会自动启动它（需等待数秒）；用完不退出 PS（保持复用）
- 中间脚本按全局配置放 `<项目目录>\Temp\<任务名>`，成品放用户指定处

## 六、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-09-16 | v1 | 初始版本；执行器 + 坑清单（PS 2026/27.0 实测：扁平插画全流程验证） |
