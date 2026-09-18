# install-agent-link.ps1 - 在本机 Blender 中安装/卸载 Agent Link 服务器（新电脑一键配置）。
# 把 scripts\agent-link-server.py 装入每个 Blender 版本目录的 scripts\startup\，
# Blender 启动时自动在 127.0.0.1:9876 开启 JSON-over-TCP 服务。
# 用法：
#   .\install-agent-link.ps1                # 安装（无参数时的默认动作，幂等）
#   .\install-agent-link.ps1 -Status        # 查看各版本安装状态与端口监听
#   .\install-agent-link.ps1 -Test          # ping 正在运行的 Blender
#   .\install-agent-link.ps1 -Launch        # 启动 Blender（GUI 模式）
#   .\install-agent-link.ps1 -Uninstall     # 从所有版本目录移除服务端
#   .\install-agent-link.ps1 -Version 5.2   # 只针对指定版本目录操作
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Test,
    [switch]$Launch,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$serverSource = Join-Path $PSScriptRoot 'agent-link-server.py'
$blinkScript  = Join-Path $PSScriptRoot 'blink.ps1'

# 无任何动作开关时默认安装
if (-not ($Install -or $Uninstall -or $Status -or $Test -or $Launch)) { $Install = $true }

function Get-BlenderConfigDirs {
    # 枚举 %APPDATA%\Blender Foundation\Blender\<版本> 目录（版本名形如 5.2）
    param([string]$OnlyVersion)
    $root = Join-Path $env:APPDATA 'Blender Foundation\Blender'
    if (-not (Test-Path -LiteralPath $root)) { return @() }
    $dirs = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+\.\d+$' }
    if ($OnlyVersion) { $dirs = $dirs | Where-Object { $_.Name -eq $OnlyVersion } }
    return @($dirs | Sort-Object { [version]$_.Name } -Descending)
}

function Find-BlenderExe {
    # 探测 blender.exe：PATH → 注册表卸载项 → Steam（含多 library）→ 常见目录
    $cmd = Get-Command blender.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $uninstallRoots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    foreach ($root in $uninstallRoots) {
        $keys = Get-ChildItem $root -ErrorAction SilentlyContinue
        foreach ($k in $keys) {
            $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
            if ($p.DisplayName -match 'Blender' -and $p.InstallLocation) {
                $exe = Join-Path $p.InstallLocation 'blender.exe'
                if (Test-Path -LiteralPath $exe) { return $exe }
            }
        }
    }

    $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
    if ($steam) {
        $libs = @($steam)
        $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
        if (Test-Path -LiteralPath $vdf) {
            $libs += (Select-String -Path $vdf -Pattern '"path"\s+"([^"]+)"' -AllMatches).Matches |
                     ForEach-Object { $_.Groups[1].Value -replace '\\\\', '\' }
        }
        foreach ($lib in $libs) {
            $exe = Join-Path $lib 'steamapps\common\Blender\blender.exe'
            if (Test-Path -LiteralPath $exe) { return $exe }
        }
    }

    foreach ($base in @('C:\Program Files\Blender Foundation',
                        "$env:LOCALAPPDATA\Programs\Blender Foundation")) {
        if (Test-Path -LiteralPath $base) {
            $hit = Get-ChildItem $base -Filter blender.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue |
                   Select-Object -First 1
            if ($hit) { return $hit.FullName }
        }
    }
    return $null
}

function Test-Port9876 {
    $c = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $c.BeginConnect('127.0.0.1', 9876, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(1500)) { return $false }
        $c.EndConnect($iar)
        return $true
    } catch {
        return $false
    } finally {
        $c.Close()
    }
}

$sourceHash = (Get-FileHash -LiteralPath $serverSource).Hash

# ---- 安装 / 卸载 / 状态：遍历版本目录 ----
$dirs = Get-BlenderConfigDirs -OnlyVersion $Version

if ($Install) {
    if (-not $dirs) {
        Write-Host "未检测到 Blender 配置目录（$env:APPDATA\Blender Foundation\Blender）。" -ForegroundColor Yellow
        Write-Host "请先启动一次 Blender 让其生成用户配置，再运行本脚本。"
        exit 1
    }
    foreach ($d in $dirs) {
        $startup = Join-Path $d.FullName 'scripts\startup'
        New-Item -ItemType Directory -Path $startup -Force | Out-Null
        $target = Join-Path $startup 'agent-link-server.py'
        if ((Test-Path -LiteralPath $target) -and
            ((Get-FileHash -LiteralPath $target).Hash -eq $sourceHash)) {
            Write-Host "✓ Blender $($d.Name)：已是最新，跳过"
            continue
        }
        Copy-Item -LiteralPath $serverSource -Destination $target -Force
        Write-Host "✓ Blender $($d.Name)：已安装 $target"
    }
    Write-Host "完成。重启 Blender 后链接自动生效（注意：不要用 --factory-startup 启动）。"
}

if ($Uninstall) {
    if (-not $dirs) { Write-Host "未检测到 Blender 配置目录，无需卸载。"; exit 0 }
    foreach ($d in $dirs) {
        $target = Join-Path $d.FullName 'scripts\startup\agent-link-server.py'
        if (Test-Path -LiteralPath $target) {
            Remove-Item -LiteralPath $target -Force
            Write-Host "✓ Blender $($d.Name)：已移除 $target"
        } else {
            Write-Host "- Blender $($d.Name)：未安装"
        }
    }
    Write-Host "完成。已运行的 Blender 需重启后才停止服务。"
}

if ($Status) {
    Write-Host "配置根目录：$env:APPDATA\Blender Foundation\Blender"
    if (-not $dirs) {
        Write-Host "未检测到任何 Blender 版本目录。"
    } else {
        foreach ($d in $dirs) {
            $target = Join-Path $d.FullName 'scripts\startup\agent-link-server.py'
            if (Test-Path -LiteralPath $target) {
                $same = (Get-FileHash -LiteralPath $target).Hash -eq $sourceHash
                Write-Host ("Blender {0}：已安装（{1}）" -f $d.Name, $(if ($same) { '与技能版本一致' } else { '版本不同，建议重跑安装' }))
            } else {
                Write-Host "Blender $($d.Name)：未安装"
            }
        }
    }
    if (Test-Port9876) { Write-Host "端口 9876：监听中（Agent Link 运行中）" -ForegroundColor Green }
    else { Write-Host "端口 9876：未监听（Blender 未启动或服务未装）" }
}

if ($Launch) {
    if (Test-Port9876) {
        Write-Host "端口 9876 已监听，Blender 似乎正在运行，无需重复启动。"
    } else {
        $exe = Find-BlenderExe
        if (-not $exe) {
            Write-Error "未找到 blender.exe（已尝试 PATH / 注册表 / Steam / 常见目录）。可手动启动后再 -Test。"
            exit 1
        }
        Write-Host "启动 Blender：$exe"
        Start-Process -FilePath $exe
        Write-Host "已发出启动命令，Blender 就绪后用 -Test 验证链接。"
    }
}

if ($Test) {
    & $blinkScript -Ping
    exit $LASTEXITCODE
}
