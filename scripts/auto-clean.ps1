# auto-clean.ps1 — 工作区每日自动清理脚本（临时/缓存/产物白名单清理）
#
# 用途：由计划任务 AI-Dev-AutoClean 每天 0 点调用；若错过计划时间（关机/睡眠），
#       计划任务 StartWhenAvailable 会在开机后立即补跑一次。
#
# 安全设计：
#   - 只处理下方白名单中的绝对路径，且断言路径位于 $Workspace 之内；
#   - 绝不触碰源码、文档、AI_App/、各 node_modules/、hermes 跟踪文件；
#   - 被占用的文件（如 DSH 运行时锁定的硬链接）删除失败仅记录，不中断、不重试其他方式。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File auto-clean.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File auto-clean.ps1 -OlderThanDays 1
#
# 参数：
#   -Workspace      工作区根目录（默认脚本所在目录的上级）
#   -OlderThanDays  只清理超过 N 天未修改的项（0 = 全部清理，默认）

param(
    [string]$Workspace,
    [int]$OlderThanDays = 0
)

$ErrorActionPreference = 'Continue'
$LogFile = Join-Path $env:TEMP 'AI-Dev-auto-clean.log'

# 确定工作区根目录
if ([string]::IsNullOrWhiteSpace($Workspace)) {
    $Workspace = Split-Path -Parent $PSScriptRoot
}
$Workspace = [System.IO.Path]::GetFullPath($Workspace).TrimEnd('\')
if (-not (Test-Path $Workspace)) {
    throw "工作区不存在: $Workspace"
}

function Write-Log {
    param([string]$Message)
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
}

# 断言目标位于工作区内；合法则返回路径，否则返回 $null
function Assert-InWorkspace {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($full -eq $Workspace) { return $null }
    if (-not $full.StartsWith($Workspace + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Log "安全拒绝（工作区外）: $full"
        return $null
    }
    return $full
}

# 删除单个路径（目录或文件）
function Remove-One {
    param([string]$Path)
    $full = Assert-InWorkspace $Path
    if (-not $full) { return }
    if (-not (Test-Path $full)) { Write-Log "跳过(不存在): $full"; return }
    # 年龄过滤
    if ($OlderThanDays -gt 0) {
        $item = Get-Item $full -ErrorAction SilentlyContinue
        if ($item -and ((Get-Date) - $item.LastWriteTime).TotalDays -lt $OlderThanDays) {
            Write-Log "跳过(未过期): $full"
            return
        }
    }
    try {
        Remove-Item -Path $full -Recurse -Force -ErrorAction Stop
        if (Test-Path $full) { Write-Log "失败(残留): $full" }
        else { Write-Log "已删除: $full" }
    } catch {
        Write-Log "失败(占用/拒绝): $full - $($_.Exception.Message)"
    }
}

# 删除工作区内所有 __pycache__ 目录与 *.pyc（排除 node_modules/.git/AI_App）
function Remove-PythonCache {
    Get-ChildItem -Path $Workspace -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq '__pycache__' -and $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\AI_App\\' } |
        ForEach-Object { Remove-One $_.FullName }
    Get-ChildItem -Path $Workspace -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -eq '.pyc' -and $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\AI_App\\' } |
        ForEach-Object { Remove-One $_.FullName }
}

Write-Log '==== 自动清理开始 ===='
Write-Log "工作区: $Workspace | 过期阈值: $OlderThanDays 天"

# 1. 任务临时目录
Get-ChildItem -Path (Join-Path $Workspace 'Temp') -Force -ErrorAction SilentlyContinue | ForEach-Object { Remove-One $_.FullName }
Get-ChildItem -Path (Join-Path $Workspace 'AI_Skill\Temp') -Force -ErrorAction SilentlyContinue | ForEach-Object { Remove-One $_.FullName }

# 2. 开发缓存/产物
Remove-One (Join-Path $Workspace 'AI_Plugins\.pnpm-store')
Remove-One (Join-Path $Workspace 'AI_Plugins\_stage')
Remove-One (Join-Path $Workspace 'AI_Plugins\_backups')

# 3. DSH 本地环境目录
Remove-One (Join-Path $Workspace 'AI_Plugins\DSH\.m0-iso-home')
Remove-One (Join-Path $Workspace 'AI_Plugins\DSH\.tagger-iso-home')
Remove-One (Join-Path $Workspace 'AI_Plugins\DSH\demo-ws')

# 4. 验证证据（SmilePlugin 下所有 .m*-evidence）
Get-ChildItem -Path (Join-Path $Workspace 'AI_Plugins\DSH\SmilePlugin') -Recurse -Force -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\.m\d+-evidence$' } |
    ForEach-Object { Remove-One $_.FullName }

# 5. hermes-dsh-bridge 运行时产物
Remove-One (Join-Path $Workspace 'hermes-dsh-bridge\logs')
Remove-One (Join-Path $Workspace 'hermes-dsh-bridge\outbox')
Remove-One (Join-Path $Workspace 'hermes-dsh-bridge\shared\dsh-watchdog.log')
Remove-One (Join-Path $Workspace 'hermes-dsh-bridge\shared\dsh-watchdog.pid')
Remove-One (Join-Path $Workspace 'hermes-dsh-bridge\shared\hermes-export.jsonl')
Get-ChildItem -Path (Join-Path $Workspace 'hermes-dsh-bridge\shared') -Filter 'task-*.md' -File -ErrorAction SilentlyContinue | ForEach-Object { Remove-One $_.FullName }

# 6. Python 缓存
Remove-PythonCache

Write-Log '==== 自动清理结束 ===='
