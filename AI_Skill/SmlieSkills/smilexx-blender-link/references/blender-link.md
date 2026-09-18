# Blender Agent Link 详细指南

## 一、架构与协议

- **服务端**：`agent-link-server.py` 位于 Blender 用户配置的 `scripts\startup\`，随 Blender 启动自动加载；也可在 3D 视图 `N 面板 → Agent Link` 手动启停。
- **地址**：`127.0.0.1:9876`，仅限本机、无鉴权（刻意设计，勿暴露到局域网）。
- **报文**：newline 分隔 UTF-8 JSON，一条连接一个请求。

| 请求 | 响应 |
| --- | --- |
| `{"type": "ping"}` | `{"status":"success","result":{"blender":"5.2.0","python":"3.x.x","pid":123,"background":false,"file":null}}` |
| `{"type":"execute_code","params":{"code":"...","timeout":60}}` | `{"status":"success\|error","stdout":"...","result":...,"error":"..."}` |

- **执行环境**：代码经 `bpy.app.timers` 在 Blender **主线程**执行（线程安全）；命名空间预载 `bpy`、`bmesh`、`Vector`、`Matrix`、`Euler`。
- **返回值约定**：脚本内 `__result__ = {...}` 即返回值（不可 JSON 序列化时回传 `repr`）；`print()` 输出进 `stdout`；异常回传完整 traceback。
- **限制**：请求体上限 64MB；`timeout` 钳制在 5–600 秒；服务器 socket 读超时 120 秒。

## 二、安装器 `install-agent-link.ps1` 开关详解

| 开关 | 行为 |
| --- | --- |
| 无参数 | 安装到所有检测到的 Blender 版本目录（幂等：哈希一致则跳过） |
| `-Version 5.2` | 只针对指定版本目录 |
| `-Status` | 列出各版本安装状态（哈希是否与技能版本一致）+ 端口 9876 监听情况 |
| `-Launch` | 探测 blender.exe 并启动 GUI（探测顺序：PATH → 注册表卸载项 → Steam 多 library → 常见目录） |
| `-Test` | 调用 blink.ps1 ping 正在运行的 Blender |
| `-Uninstall` | 从所有版本目录移除服务端文件 |

**手工等价步骤**（无 PowerShell 环境时）：把 `agent-link-server.py` 复制到
`%APPDATA%\Blender Foundation\Blender\<版本>\scripts\startup\`，重启 Blender。

## 三、排障表

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 连接被拒（9876） | Blender 未启动，或服务端未安装 | `-Status` 检查 → 未装则安装；已装则 `-Launch` 启动 |
| 装了但启动后连不上 | 用 `--factory-startup` 启动（跳过用户 startup 脚本） | 正常方式重启 Blender |
| 请求超时（timeout waiting for main thread） | GUI 正被模态操作占用，主循环停摆 | 关闭占用主线程的弹窗/操作后重试；或加大 `-TimeoutSec` |
| 端口占用报错（Blender 面板可见） | 多个 Blender 实例，先启的占 9876 | 链接指向第一个实例；要切实例先关前一个 |
| 后台模式无响应 | `--background` 下主循环不运转，链路仅 GUI 可用 | 用 GUI 模式 Blender |

## 四、建模脚本模式（实测可复用的骨架）

参照本技能验证过的低多边形塔脚本（同结构见原项目 `build_tower.py`）：

```python
import bpy, math

COL_NAME = "MyBuild"
# 1) 清理旧 collection（幂等重跑）
old = bpy.data.collections.get(COL_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
col = bpy.data.collections.new(COL_NAME)
bpy.context.scene.collection.children.link(col)

# 2) 建几何（bpy.ops 或直接 bmesh；材质用 Principled BSDF 设 Base Color/Roughness）
# 3) 灯光 + 相机（TRACK_TO 约束对准目标空物体），scene.camera 指定相机
# 4) 渲染：设 render.engine（EEVEE 系列带 fallback）、resolution、filepath 后
#    bpy.ops.render.render(write_still=True)
# 5) 回传统计信息
__result__ = {"objects": N, "render_saved": "D:/...png"}
```

要点：
- 一次性长任务把 `-TimeoutSec` 给足（协议上限 600s）；渲染类任务注意调用方 pwsh 的外部超时也要配套。
- 输出文件路径建议绝对路径；成品放用户指定处，中间产物按全局配置进 `<项目目录>\Temp\<任务名>`。
- 收尾时把临时隐藏/临时代码清理干净，避免污染用户场景。

## 五、安全边界

- 服务端在本机 9876 端口执行任意 Python——只用于本机可信 Agent 链路，不要暴露到局域网。
- `__result__` 返回值会被 JSON 序列化，超大对象请回传摘要（数量、路径、关键指标）而非完整数据。
- 本技能的 .ps1 均带 UTF-8 BOM：Windows PowerShell 5.1（含 DSH harness 外壳）对无 BOM 文件按 ANSI 解析，中文注释会碎成语法错误；用写文件工具重写脚本后必须重新补 BOM。
