# new-task-dir.ps1 - create an anget task temp dir
# Usage: powershell -File new-task-dir.ps1 -TaskName <task-name>
param(
    [Parameter(Mandatory = $true)]
    [string]$TaskName
)

$ErrorActionPreference = 'Stop'

# Safety: reject path separators and parent traversal
if ($TaskName -match '[\\/]|\.\.') {
    throw "TaskName contains illegal chars (no path separators or ..): $TaskName"
}

$root = Join-Path $env:USERPROFILE 'Downloads\anget-tmp'
$dir  = Join-Path $root $TaskName

New-Item -ItemType Directory -Path $dir -Force | Out-Null
Write-Host "CREATED: $dir"
