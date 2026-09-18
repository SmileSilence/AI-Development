[CmdletBinding()]
param(
    [string]$DshProfile = "web",
    [switch]$KeepData,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$dataRoot = Join-Path $env:LOCALAPPDATA "SmileXX\multi-agent-bridge"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$claudeDesktopConfigurator = Join-Path $projectRoot "tools\configure-claude-desktop.mjs"

function Invoke-Optional {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )
    if ($null -ne (Get-Command $Command -ErrorAction SilentlyContinue)) {
        & $Command @Arguments
    }
}

Invoke-Optional "codex" @("mcp", "remove", "multi-agent-bridge")
Invoke-Optional "claude" @("mcp", "remove", "--scope", "user", "multi-agent-bridge")
if (($null -ne (Get-Command node -ErrorAction SilentlyContinue)) -and (Test-Path -LiteralPath $claudeDesktopConfigurator)) {
    & node $claudeDesktopConfigurator uninstall
}
Invoke-Optional "dsh-panel" @("mcp", "remove", "multi-agent-bridge", "--yes", "--profile", $DshProfile)

foreach ($skillPath in @(
    (Join-Path $env:USERPROFILE ".agents\skills\smilexx-multi-agent-bridge"),
    (Join-Path $env:USERPROFILE ".claude\skills\smilexx-multi-agent-bridge")
)) {
    if (Test-Path -LiteralPath $skillPath) {
        Remove-Item -LiteralPath $skillPath -Recurse -Force
    }
}

if (-not $KeepData -and (Test-Path -LiteralPath $dataRoot)) {
    $worktreesRoot = Join-Path $dataRoot "worktrees"
    $hasWorktrees = (Test-Path -LiteralPath $worktreesRoot) -and
        ($null -ne (Get-ChildItem -LiteralPath $worktreesRoot -Directory -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1))
    if ($hasWorktrees -and -not $Force) {
        Write-Warning "检测到受管 worktree，运行数据未删除。请先用 release_task 释放，或确认后使用 -Force。"
    }
    else {
        Remove-Item -LiteralPath $dataRoot -Recurse -Force
        Write-Host "已删除运行数据：$dataRoot"
    }
}

Write-Host "multi-agent-bridge 已从 Codex、Claude Code、Claude Desktop 与 DSH 注销。"
Write-Host "Git 分支不会由卸载器删除。"
