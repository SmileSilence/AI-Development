# AI技能一键安装脚本
# 仓库根目录用法：pwsh -File .\AI_Skill\install-skills.ps1 [-UseSymlink] [-Force] [-KeepCodexCopies] [-RecommendedOnly]

param(
    [switch]$UseSymlink,
    [switch]$Force,
    [switch]$KeepCodexCopies,
    [switch]$RecommendedOnly
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 获取脚本所在目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $scriptDir "skill-manifest.json"

# 检查清单文件
if (-not (Test-Path $manifestPath)) {
    Write-Host "错误：找不到清单文件 $manifestPath" -ForegroundColor Red
    exit 1
}

# 读取清单
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$skills = $manifest.skills
$allSkillCount = $skills.Count
if ($RecommendedOnly) {
    $skills = @($skills | Where-Object { $_.default_install -eq $true })
}
$sourceRoot = Join-Path $scriptDir $manifest.source_dir

if (-not (Test-Path -LiteralPath $sourceRoot)) {
    throw "找不到自有技能源目录：$sourceRoot"
}

# 确定安装目录。Codex、DSH 和 MiMo 共用 .agents，Claude 使用自己的目录。
$codexHome = $env:CODEX_HOME
if (-not $codexHome) {
    $codexHome = Join-Path $env:USERPROFILE ".codex"
}
$sharedInstallDir = Join-Path $env:USERPROFILE ".agents\skills"
$claudeInstallDir = Join-Path $env:USERPROFILE ".claude\skills"
$codexInstallDir = Join-Path $codexHome "skills"
$installDirs = @($sharedInstallDir, $claudeInstallDir)

# 创建安装目录
foreach ($installDir in $installDirs) {
    if (-not (Test-Path -LiteralPath $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        Write-Host "创建安装目录：$installDir" -ForegroundColor Green
    }
}

Write-Host "开始安装技能..." -ForegroundColor Cyan
Write-Host "共享目录：$sharedInstallDir" -ForegroundColor Cyan
Write-Host "Claude 目录：$claudeInstallDir" -ForegroundColor Cyan
Write-Host "技能数量：$($skills.Count)" -ForegroundColor Cyan
if ($RecommendedOnly) {
    Write-Host "安装范围：默认推荐（共 $($skills.Count) / $allSkillCount 个）" -ForegroundColor Cyan
}
Write-Host ""

# 安装每个技能到共享目录和 Claude 目录
$installFailures = @()
foreach ($installDir in $installDirs) {
    Write-Host "同步到：$installDir" -ForegroundColor Cyan

    foreach ($skill in $skills) {
        $skillName = $skill.name
        if ($skillName -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
            throw "技能名称不符合 kebab-case 安全规则：$skillName"
        }
        $sourcePath = Join-Path $sourceRoot $skillName
        $targetPath = Join-Path $installDir $skillName
        $targetExisted = Test-Path -LiteralPath $targetPath

        if (-not (Test-Path -LiteralPath $sourcePath)) {
            Write-Host "跳过 $skillName：源目录不存在" -ForegroundColor Yellow
            continue
        }

        if ($targetExisted -and -not $Force) {
            Write-Host "跳过 $skillName：已存在（使用 -Force 强制覆盖）" -ForegroundColor Yellow
            continue
        }

        try {
            $useSkillSymlink = $UseSymlink

            if ($useSkillSymlink) {
                if (Test-Path -LiteralPath $targetPath) {
                    Remove-Item -LiteralPath $targetPath -Recurse -Force
                }
                New-Item -ItemType SymbolicLink -Path $targetPath -Target $sourcePath | Out-Null
                Write-Host "✓ $skillName（符号链接）" -ForegroundColor Green
            } else {
                if (-not $targetExisted) {
                    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
                }
                $sourceItems = Get-ChildItem -LiteralPath $sourcePath -Force
                $sourceItems | Copy-Item -Destination $targetPath -Recurse -Force
                $mode = "已复制"
                Write-Host "✓ $skillName（$mode）" -ForegroundColor Green
            }
        } catch {
            $installFailures += "$installDir :: $skillName :: $($_.Exception.Message)"
            Write-Host "✗ $skillName：安装失败 - $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Write-Host ""
}

# 清理 Codex 私有目录中的同名副本，避免与共享目录重复注册。
if (-not $KeepCodexCopies) {
    $resolvedCodexDir = [System.IO.Path]::GetFullPath($codexInstallDir).TrimEnd('\')
    foreach ($skill in $skills) {
        $targetPath = Join-Path $codexInstallDir $skill.name
        $sharedSkillFile = Join-Path (Join-Path $sharedInstallDir $skill.name) "SKILL.md"
        $resolvedTarget = [System.IO.Path]::GetFullPath($targetPath)
        $resolvedParent = [System.IO.Path]::GetDirectoryName($resolvedTarget).TrimEnd('\')

        if ($resolvedParent -ne $resolvedCodexDir) {
            throw "拒绝清理非 Codex 技能目录目标：$resolvedTarget"
        }

        if (-not (Test-Path -LiteralPath $sharedSkillFile)) {
            Write-Host "保留 Codex 副本：共享目录缺少 $($skill.name)" -ForegroundColor Yellow
            continue
        }

        if (Test-Path -LiteralPath $targetPath) {
            Remove-Item -LiteralPath $targetPath -Recurse -Force
            Write-Host "已移除 Codex 重复副本：$($skill.name)" -ForegroundColor DarkGray
        }
    }
}

if ($installFailures.Count -gt 0) {
    throw "有 $($installFailures.Count) 项技能同步失败：$($installFailures -join '; ')"
}

Write-Host "安装完成！" -ForegroundColor Green
Write-Host "已同步 $($skills.Count) 个技能到共享目录与 Claude 目录" -ForegroundColor Green

# 显示使用说明
Write-Host ""
Write-Host "使用说明：" -ForegroundColor Cyan
Write-Host "1. Codex、DSH 和 MiMo 从共享目录加载技能" -ForegroundColor White
Write-Host "2. Claude 使用独立同步目录" -ForegroundColor White
Write-Host "3. 使用 -UseSymlink 参数可创建符号链接（便于同步更新）" -ForegroundColor White
Write-Host "4. 使用 -Force 参数可强制覆盖已存在的技能" -ForegroundColor White
Write-Host "5. 仅兼容旧版 Codex 时才使用 -KeepCodexCopies" -ForegroundColor White
Write-Host "6. 使用 -RecommendedOnly 参数仅安装总清单中默认推荐的技能" -ForegroundColor White
# 检查认证配置
function Test-GitAuth {
    param([string]$RepoUrl)

    # 检查SSH
    if ($RepoUrl -match "^git@") {
        $sshTest = ssh -T git@github.com 2>&1
        if ($sshTest -match "successfully authenticated") {
            return "SSH"
        }
    }

    # 检查HTTPS凭证
    if ($RepoUrl -match "^https://") {
        try {
            $gitTest = git ls-remote $RepoUrl 2>&1
            if ($LASTEXITCODE -eq 0) {
                return "HTTPS"
            }
        } catch {}
    }

    # 检查环境变量
    if ($env:GITHUB_PAT_TOKEN) {
        return "PAT"
    }

    return $null
}

# 在安装脚本中添加认证检查
Write-Host "检查Git认证配置..." -ForegroundColor Cyan
$repoUrl = "https://github.com/SmileSilence/AI-Development.git"
$authMethod = Test-GitAuth -RepoUrl $repoUrl

if (-not $authMethod) {
    Write-Host "警告：未检测到有效的Git认证配置" -ForegroundColor Yellow
    Write-Host "请按以下方式之一配置认证：" -ForegroundColor Yellow
    Write-Host "1. 设置环境变量 GITHUB_PAT_TOKEN" -ForegroundColor White
    Write-Host "2. 配置SSH密钥" -ForegroundColor White
    Write-Host "3. 使用GitHub CLI登录" -ForegroundColor White
    Write-Host ""
    Write-Host "详细说明请查看 AI_Skill/INSTALL_README.md" -ForegroundColor White
}
