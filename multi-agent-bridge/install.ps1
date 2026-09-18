[CmdletBinding()]
param(
    [string]$DshProfile = "web"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $projectRoot "dist\server.js"
$claudeDesktopConfigurator = Join-Path $projectRoot "tools\configure-claude-desktop.mjs"
$skillSource = Join-Path (Split-Path -Parent $projectRoot) "AI_Skill\SmlieSkills\smilexx-multi-agent-bridge"
$globalSkillSource = Join-Path (Split-Path -Parent $projectRoot) "AI_Skill\SmlieSkills\smilexx-global-config"

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)
    if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "缺少必需命令：$Name"
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "命令执行失败（退出码 $exitCode）：$Command $($Arguments -join ' ')"
    }
    return $exitCode
}

function Sync-Skill {
    param([Parameter(Mandatory)][string]$Source)
    if (-not (Test-Path -LiteralPath (Join-Path $Source "SKILL.md"))) {
        throw "技能源目录无效：$Source"
    }
    foreach ($agentRoot in @(
        (Join-Path $env:USERPROFILE ".agents\skills"),
        (Join-Path $env:USERPROFILE ".claude\skills")
    )) {
        $destination = Join-Path $agentRoot (Split-Path -Leaf $Source)
        New-Item -ItemType Directory -Path $agentRoot -Force | Out-Null
        if (Test-Path -LiteralPath $destination) {
            Remove-Item -LiteralPath $destination -Recurse -Force
        }
        Copy-Item -LiteralPath $Source -Destination $destination -Recurse -Force
    }
}

Assert-Command "node"
Assert-Command "pnpm"
Assert-Command "codex"
Assert-Command "claude"
Assert-Command "dsh-panel"

Push-Location $projectRoot
try {
    Invoke-Native "pnpm" @("install", "--frozen-lockfile") | Out-Null
    Invoke-Native "pnpm" @("build") | Out-Null
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $serverPath)) {
    throw "构建产物不存在：$serverPath"
}

Sync-Skill $skillSource
Sync-Skill $globalSkillSource

Invoke-Native "codex" @("mcp", "remove", "multi-agent-bridge") -AllowFailure | Out-Null
Invoke-Native "codex" @("mcp", "add", "--env", "MAB_ORIGIN_AGENT=codex", "multi-agent-bridge", "--", "node", $serverPath) | Out-Null

Invoke-Native "claude" @("mcp", "remove", "--scope", "user", "multi-agent-bridge") -AllowFailure | Out-Null
Invoke-Native "claude" @("mcp", "add", "--scope", "user", "multi-agent-bridge", "-e", "MAB_ORIGIN_AGENT=claude", "--", "node", $serverPath) | Out-Null

$nodePath = (Get-Command node).Source
Invoke-Native $nodePath @($claudeDesktopConfigurator, "install", "--node", $nodePath, "--server", $serverPath) | Out-Null

Invoke-Native "dsh-panel" @("mcp", "remove", "multi-agent-bridge", "--yes", "--profile", $DshProfile) -AllowFailure | Out-Null
Invoke-Native "dsh-panel" @(
    "mcp", "add", "--name", "multi-agent-bridge", "--stdio",
    "--command", "node", "--args", $serverPath,
    "--env", "MAB_ORIGIN_AGENT=dsh", "--cwd", $projectRoot,
    "--profile", $DshProfile
) | Out-Null

Invoke-Native "codex" @("mcp", "get", "multi-agent-bridge") | Out-Null
Invoke-Native "claude" @("mcp", "get", "multi-agent-bridge") | Out-Null
& dsh-panel mcp test multi-agent-bridge --profile $DshProfile
if ($LASTEXITCODE -ne 0) {
    Write-Warning "DSH MCP 配置已写入，但当前网关连接测试失败；请启动或重启 DSH 后重新测试。"
}

Write-Host "multi-agent-bridge 已构建并注册到 Codex、Claude Code、Claude Desktop 与 DSH。"
Write-Host "Claude Desktop 配置已按 Microsoft Store/传统安装类型自动定位并合并。"
Write-Host "共享技能已同步到 .agents 和 .claude。"
Write-Host "DSH profile：$DshProfile"
