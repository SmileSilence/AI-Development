# Photoshop COM / DoJavaScript 详细指南

## 一、调用链

`ps-exec.ps1` → COM `Photoshop.Application`（未运行自动拉起，运行中则连当前实例，PS 为单实例）→ `app.DoJavaScript(jsx字符串)`。

- **返回值**：脚本末行表达式的值。约定末行输出 `"XXX_OK ..."` 形式的确认串。
- **编码**：ps-exec.ps1 用 `[System.IO.File]::ReadAllText($path, UTF8)` 读取——jsx 含中文注释必须以 UTF-8 保存。
- **环境设置**（写进每个 jsx 开头）：`app.displayDialogs = DialogModes.NO;` 与 `app.preferences.rulerUnits = Units.PIXELS;`
- **超时**：`DoJavaScript` 同步阻塞、无内置超时；超长脚本由调用方（pwsh 工具 `timeoutMs`）控制，建议给脚本估时的 2 倍以上。

## 二、版本坑清单（已在 PS 2026 / 27.0 实测；旧版本若未复现可正常用标准写法）

| 症状 | 原因 | 替代方案 |
| --- | --- | --- |
| `doc.pathItems.add(...)` 报 **1280 属性未初始化**（SubPathInfo 四种标准写法全炸） | COM/DoJavaScript 上下文路径 API 不可用 | 完全不用路径选区，改用第三节扫描线技法 |
| `executeAction(charIDToTypeID("Elps"), ...)` 等报 **8800 命令当前不可用** | ActionManager 事件在此上下文整体不可用 | 只用 DOM API（`doc.selection.select/fill/feather`、`artLayers`、`colorSamplers` 等） |
| `doc.selection.select([l,t,r,b])` 边界数组形式报 **1220 非法参数**（浮点坐标同样报错） | 此上下文 `select` 仅接受四点多边形形式 | 统一用 `[[x1,y1],[x2,y1],[x2,y2],[x1,y2]]`，坐标 `Math.floor/ceil` 取整 |

**可靠 API 白名单**（实测通过）：`documents.add`、`artLayers.add`、`activeLayer`、`selection.select(四点形, REPLACE/EXTEND/DIMINISH/INTERSECT)`、`selection.fill(SolidColor, ColorBlendMode.NORMAL, 100, false)`、`selection.deselect`、`selection.feather`、`saveAs(PNGSaveOptions, asCopy=true)`、`colorSamplers.add`。

## 三、扫描线椭圆技法（替代椭圆选框）

用 1px 一行的四点矩形 `EXTEND` 并集拼出圆/椭圆，末尾羽化当抗锯齿：

```jsx
function selEllipse(cx, cy, rx, ry) {
    var first = true;
    for (var y = cy - ry; y < cy + ry; y += 1) {
        var t = (y + 0.5 - cy) / ry;
        if (t < -1) { t = -1; } if (t > 1) { t = 1; }
        var hw = rx * Math.sqrt(1 - t * t);
        var b = [[Math.floor(cx - hw), Math.floor(y)], [Math.ceil(cx + hw), Math.floor(y)],
                 [Math.ceil(cx + hw), Math.ceil(y + 1)], [Math.floor(cx - hw), Math.ceil(y + 1)]];
        doc.selection.select(b, first ? SelectionType.REPLACE : SelectionType.EXTEND);
        first = false;
    }
    try { doc.selection.feather(0.7); } catch (e1) {} // 0.7px 羽化 ≈ 抗锯齿
}
```

- **形状组合**：并集 = 连续 `EXTEND`；交集/裁剪 = 先建好选区再 `doc.selection.select(rect4points, SelectionType.INTERSECT)`（例：椭圆 ∩ 半平面矩形 = 弓形，可做双色穹顶分段且弦线保持锐利）。
- **多边形/旋转矩形**：直接算好各顶点传四点形式（顶点数 >4 的凹凸形同样按顺序给点）。
- **一个部件一个图层**：`doc.artLayers.add()` → 设 `activeLayer` → 填充 → `deselect`，命名部件名，便于后续继续编辑。

## 四、常用模板

```jsx
// 新建文档（fill 白底会生成背景层）
var doc = app.documents.add(1600, 1200, 72, "Name", NewDocumentMode.RGB, DocumentFill.WHITE);

// 颜色
function hex(h) {
    var c = new SolidColor();
    c.rgb.red   = parseInt(h.substr(1, 2), 16);
    c.rgb.green = parseInt(h.substr(3, 2), 16);
    c.rgb.blue  = parseInt(h.substr(5, 2), 16);
    return c;
}

// 选区 + 填充（rect 部分）
doc.selection.select([[x1,y1],[x2,y1],[x2,y2],[x1,y2]]);
doc.selection.fill(hex("#F2994A"), ColorBlendMode.NORMAL, 100, false);
doc.selection.deselect();

// 导出 PNG（asCopy=true，文档保留在 PS 中可继续编辑）
doc.saveAs(new File("D:/out/x.png"), new PNGSaveOptions(), true, Extension.LOWERCASE);

// 幂等重建：脚本开头关闭同名旧文档
for (var i = app.documents.length - 1; i >= 0; i--) {
    if (app.documents[i].name === "Name") app.documents[i].close(SaveOptions.DONOTSAVECHANGES);
}
```

## 五、无视觉校验手法（模型读不了图时的验收方案）

- **图层级**：遍历 `doc.artLayers` 输出 `layer.bounds`，与设计坐标逐项比对（羽化会让边界外扩 1–2px，属预期）。
- **像素级**：`doc.colorSamplers.add([x, y])` 采样 `s.color.rgb.hexValue`，与预期色比对后 `s.remove()`。
- 两者都过 = 形状落位与配色正确，可交付。

## 六、文件卫生与安全

- 中间 jsx 脚本放 `<项目目录>\Temp\<任务名>`，任务结束删除；成品图放用户指定处。
- 脚本会静默关闭同名旧文档（幂等重建），对用户已打开的同名文档要先确认再跑。
- 不退出 Photoshop（保持用户会话与文档状态）。
- 本技能 .ps1 已带 UTF-8 BOM（Windows PowerShell 5.1 兼容）；用写文件工具重写脚本后需重新补 BOM，否则中文注释会在 PS 5.1 下碎成语法错误。
