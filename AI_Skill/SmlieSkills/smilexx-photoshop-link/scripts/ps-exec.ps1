# ps-exec.ps1 - 通过 COM 驱动本机 Photoshop（DoJavaScript），装了 PS 的 Windows 即开即用。
# PS 未运行时首次调用自动拉起（需等待数秒）；调用后不退出 PS，保持复用。
# 用法：
#   .\ps-exec.ps1 -Ping            # 探活：返回版本 / 安装路径 / 文档数
#   .\ps-exec.ps1 -Doctor          # 诊断：枚举 COM ProgID 与进程状态
#   .\ps-exec.ps1 -File .\x.jsx    # 执行脚本（UTF-8 读取，末行表达式即返回值）
#   .\ps-exec.ps1 -Code "app.version"
[CmdletBinding()]
param(
    [switch]$Ping,
    [switch]$Doctor,
    [string]$File,
    [string]$Code
)

$ErrorActionPreference = 'Stop'

if ($Doctor) {
    Write-Host "=== Photoshop 安装诊断 ==="
    $progids = Get-ChildItem 'Registry::HKEY_CLASSES_ROOT' -Name -ErrorAction SilentlyContinue |
        Where-Object { $_ -like 'Photoshop.Application*' }
    if ($progids) {
        Write-Host "COM ProgID："
        $progids | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "未找到 Photoshop.Application COM ProgID —— 可能未安装 Photoshop 或 COM 未注册。" -ForegroundColor Yellow
    }
    $proc = Get-Process -Name Photoshop* -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "运行中进程："
        $proc | ForEach-Object { Write-Host ("  PID {0}  {1}" -f $_.Id, $_.MainWindowTitle) }
    } else {
        Write-Host "Photoshop 当前未运行（首次 COM 调用会自动拉起，需等待数秒）。"
    }
    return
}

try {
    $app = New-Object -ComObject Photoshop.Application
} catch {
    Write-Error ("无法连接 Photoshop COM：{0}。请先运行 .\ps-exec.ps1 -Doctor 检查安装。" -f $_.Exception.Message)
    exit 1
}

if ($Ping) {
    Write-Host ("PS_VERSION: " + $app.Version)
    Write-Host ("PS_PATH: " + $app.Path)
    Write-Host ("DOC_COUNT: " + $app.Documents.Count)
    return
}

if ($File) {
    if (-not (Test-Path -LiteralPath $File)) {
        Write-Error "找不到脚本文件：$File"
        exit 2
    }
    # 显式 UTF-8 读取，保证含中文注释的 .jsx 不乱码
    $Code = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $File), [System.Text.Encoding]::UTF8)
}
if (-not $Code) {
    Write-Error "提供 -File、-Code 或 -Ping。"
    exit 2
}

try {
    $result = $app.DoJavaScript($Code)
    if ($null -ne $result) { $result }
} catch {
    Write-Error ("DoJavaScript 执行失败：{0}" -f $_.Exception.Message)
    exit 1
}
