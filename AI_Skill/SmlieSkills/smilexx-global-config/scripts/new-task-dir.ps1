# new-task-dir.ps1 - create a task temp dir under the project Temp folder
# Usage: powershell -File new-task-dir.ps1 -ProjectPath <project-dir> -TaskName <task-name>
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,
    [Parameter(Mandatory = $true)]
    [string]$TaskName
)

$ErrorActionPreference = 'Stop'

# Safety: reject path separators and parent traversal in task name
if ($TaskName -match '[\\/]|\.\.') {
    throw "TaskName contains illegal chars (no path separators or ..): $TaskName"
}

# Resolve and validate project path (reject empty / drive root)
if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    throw "ProjectPath must not be empty"
}
$project = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProjectPath)
if ($project.Length -le 3) {
    throw "ProjectPath must be a real project directory (drive root rejected): $project"
}

$dir = Join-Path (Join-Path $project 'Temp') $TaskName

New-Item -ItemType Directory -Path $dir -Force | Out-Null
Write-Host "CREATED: $dir"
