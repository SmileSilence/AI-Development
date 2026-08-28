# 检测或同步 Claude Code、dsh 会话到 Codex
param(
    [ValidateSet('Detect', 'Import')]
    [string]$Mode = 'Detect',

    [ValidateSet('All', 'Claude', 'Dsh')]
    [string]$Source = 'All'
)

$ErrorActionPreference = 'Stop'
$taskName = 'session-sync'
$taskRoot = Join-Path $env:USERPROFILE 'Downloads\anget-tmp'
$taskDir = Join-Path $taskRoot $taskName
$pythonScript = Join-Path $PSScriptRoot 'sync-agent-sessions.py'

function Remove-TaskDirectory {
    if (-not (Test-Path -LiteralPath $taskDir)) {
        return
    }

    $resolvedRoot = [System.IO.Path]::GetFullPath($taskRoot).TrimEnd('\')
    $resolvedTask = [System.IO.Path]::GetFullPath($taskDir).TrimEnd('\')
    if (-not $resolvedTask.StartsWith($resolvedRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "临时目录超出允许范围：$resolvedTask"
    }

    [System.IO.Directory]::Delete($resolvedTask, $true)
    if (Test-Path -LiteralPath $resolvedTask) {
        throw "临时目录清理失败：$resolvedTask"
    }
}

try {
    New-Item -ItemType Directory -Path $taskDir -Force | Out-Null

    $pythonCommand = Get-Command python -ErrorAction Stop
    & $pythonCommand.Source -c "import zstandard" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '正在安装会话解压依赖 zstandard……'
        & $pythonCommand.Source -m pip install zstandard
        if ($LASTEXITCODE -ne 0) {
            throw 'zstandard 安装失败'
        }
    }

    $env:PYTHONIOENCODING = 'utf-8'
    & $pythonCommand.Source $pythonScript --mode $Mode.ToLowerInvariant() --source $Source.ToLowerInvariant() --temp-dir $taskDir
    if ($LASTEXITCODE -ne 0) {
        throw "会话同步脚本执行失败，退出码：$LASTEXITCODE"
    }
}
finally {
    Remove-TaskDirectory
}
