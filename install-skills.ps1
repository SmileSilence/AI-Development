# AI技能一键安装脚本
# 用法：.\install-skills.ps1 [-UseSymlink] [-Force]

param(
    [switch]$UseSymlink,
    [switch]$Force
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

# 确定安装目录
$codexHome = $env:CODEX_HOME
if (-not $codexHome) {
    $codexHome = Join-Path $env:USERPROFILE ".codex"
}
$installDir = Join-Path $codexHome "skills"

# 创建安装目录
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Write-Host "创建安装目录：$installDir" -ForegroundColor Green
}

Write-Host "开始安装技能..." -ForegroundColor Cyan
Write-Host "安装目录：$installDir" -ForegroundColor Cyan
Write-Host "技能数量：$($skills.Count)" -ForegroundColor Cyan
Write-Host ""

# 安装每个技能
foreach ($skill in $skills) {
    $skillName = $skill.name
    $sourcePath = Join-Path $scriptDir "AI_Skill\$skillName"
    $targetPath = Join-Path $installDir $skillName
    
    # 检查源目录
    if (-not (Test-Path $sourcePath)) {
        Write-Host "跳过 $skillName：源目录不存在" -ForegroundColor Yellow
        continue
    }
    
    # 检查目标是否已存在
    if (Test-Path $targetPath) {
        if (-not $Force) {
            Write-Host "跳过 $skillName：已存在（使用 -Force 强制覆盖）" -ForegroundColor Yellow
            continue
        } else {
            # 强制删除现有目录
            Remove-Item -Path $targetPath -Recurse -Force
        }
    }
    
    # 安装技能
    try {
        if ($UseSymlink) {
            # 创建符号链接（需要管理员权限或开发者模式）
            New-Item -ItemType SymbolicLink -Path $targetPath -Target $sourcePath | Out-Null
            Write-Host "✓ $skillName（符号链接）" -ForegroundColor Green
        } else {
            # 复制目录
            Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
            Write-Host "✓ $skillName（已复制）" -ForegroundColor Green
        }
    } catch {
        Write-Host "✗ $skillName：安装失败 - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "已安装 $($skills.Count) 个技能到：$installDir" -ForegroundColor Green

# 显示使用说明
Write-Host ""
Write-Host "使用说明：" -ForegroundColor Cyan
Write-Host "1. 技能已安装到 Codex 技能目录" -ForegroundColor White
Write-Host "2. 重启 Codex 以加载新技能" -ForegroundColor White
Write-Host "3. 使用 -UseSymlink 参数可创建符号链接（便于同步更新）" -ForegroundColor White
Write-Host "4. 使用 -Force 参数可强制覆盖已存在的技能" -ForegroundColor White
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
    Write-Host "详细说明请查看 INSTALL_README.md" -ForegroundColor White
}
