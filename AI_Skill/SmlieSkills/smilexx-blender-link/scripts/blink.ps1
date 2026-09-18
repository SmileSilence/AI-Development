# blink.ps1 - 向运行中的 Blender Agent Link（端口 9876）发送 Python 代码并取回结果。
# 协议与排障详见技能 references/blender-link.md；服务端安装：.\install-agent-link.ps1
# 用法：
#   .\blink.ps1 -Ping
#   .\blink.ps1 -Code 'import bpy; __result__ = len(bpy.data.objects)'
#   .\blink.ps1 -File .\myscript.py
#   .\blink.ps1 -File .\myscript.py -TimeoutSec 300
param(
    [switch]$Ping,
    [string]$Code,
    [string]$File,
    [int]$Port = 9876,
    [int]$TimeoutSec = 90
)

# 显式 UTF-8 读取，保证含中文注释的 .py 在 Windows PowerShell 5.1 下不乱码
if ($File) { $Code = Get-Content $File -Raw -Encoding UTF8 }
if (-not $Code -and -not $Ping) {
    Write-Error "Provide -Code, -File, or -Ping."
    exit 2
}

$req = if ($Ping) { @{ type = "ping" } }
       else { @{ type = "execute_code"; params = @{ code = $Code; timeout = $TimeoutSec } } }

$client = New-Object System.Net.Sockets.TcpClient
try {
    $client.Connect("127.0.0.1", $Port)
    $stream = $client.GetStream()
    $stream.WriteTimeout = 15000
    $stream.ReadTimeout = [Math]::Max(15000, $TimeoutSec * 1000)

    $payload = [System.Text.Encoding]::UTF8.GetBytes(($req | ConvertTo-Json -Depth 6 -Compress) + "`n")
    $stream.Write($payload, 0, $payload.Length)

    $ms = New-Object System.IO.MemoryStream
    $buf = New-Object byte[] 65536
    while ($true) {
        $n = $stream.Read($buf, 0, $buf.Length)
        if ($n -le 0) { break }
        $ms.Write($buf, 0, $n)
        $bytes = $ms.ToArray()
        if ($bytes[$bytes.Length - 1] -eq 10) { break }
    }
    $respText = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
} finally {
    $client.Close()
}

if (-not $respText) { Write-Error "Empty response from Blender."; exit 1 }
$resp = $respText | ConvertFrom-Json

if ($resp.stdout) {
    Write-Host "--- stdout ---"
    Write-Host ($resp.stdout -join "`n")
}
if ($null -ne $resp.result) {
    Write-Host "--- result ---"
    Write-Host ($resp.result | ConvertTo-Json -Depth 10)
}
if ($resp.error) {
    Write-Host "--- error ---" -ForegroundColor Red
    Write-Host ($resp.error -join "`n")
    exit 1
}

# 成功路径显式退出码，保证调用方 $LASTEXITCODE 可靠（install-agent-link.ps1 -Test 依赖它）
exit 0
