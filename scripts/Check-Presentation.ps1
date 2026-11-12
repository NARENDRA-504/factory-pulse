$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    & "$projectRoot\.venv\Scripts\python.exe" "$PSScriptRoot\check_presentation.py"
    if ($LASTEXITCODE -ne 0) { Write-Warning 'One or more checks need attention. Existing services were not modified.' }
} finally { Pop-Location }
