# cleanup-task-dir.ps1 - remove an anget task temp dir (recursive, force) and verify
# Usage: powershell -File cleanup-task-dir.ps1 -TaskName <task-name>
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

if (Test-Path $dir) {
    Remove-Item -Recurse -Force $dir
    if (Test-Path $dir) {
        throw "Cleanup failed: $dir still exists"
    }
    Write-Host "DELETED: $dir"
} else {
    Write-Host "NOT-FOUND (nothing to delete): $dir"
}
