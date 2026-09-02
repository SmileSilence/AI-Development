# 设计+执行文档创建技能安装脚本
# 将技能安装到共享目录；用法：powershell -File scripts\install.ps1
# 基于脚本自身路径定位技能根目录，可安全地在任意位置运行，避免复制到自身内部。

$skillDir = Split-Path -Parent $PSScriptRoot   # scripts 的上一级 = 技能根目录
$targetDir = Join-Path $env:USERPROFILE '.agents\skills\design-execution-document'

if (-not (Test-Path $targetDir)) {
    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
}

Copy-Item -Path (Join-Path $skillDir '*') -Destination $targetDir -Recurse -Force

Write-Host "技能 'design-execution-document' 已成功安装到共享目录："
Write-Host $targetDir
