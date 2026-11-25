param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
$monitor = Join-Path $PSScriptRoot 'local_stack.py'
if (-not (Test-Path -LiteralPath $python)) { throw 'FactoryPulse Python environment is missing. Follow README local setup first.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is unavailable. Install it before launching.' }
$state = Join-Path $projectRoot '.local\stack'
New-Item -ItemType Directory -Force -Path $state | Out-Null
$statusFile = Join-Path $state 'status.json'
$recent = (Test-Path -LiteralPath $statusFile) -and ((Get-Date) - (Get-Item -LiteralPath $statusFile).LastWriteTime).TotalSeconds -lt 20
if (-not $recent) {
    # local_stack.py owns an OS file lock; a concurrent launcher exits harmlessly.
    Start-Process -FilePath $python -ArgumentList @('-u', ('"' + $monitor + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $state 'launcher-out.log') -RedirectStandardError (Join-Path $state 'launcher-error.log') | Out-Null
}
Write-Host 'Starting/checking both apps. No machine streams or queued delivery will be started.'
Push-Location -LiteralPath $projectRoot
try {
    $code=1
    for ($attempt=0; $attempt -lt 6; $attempt++) {
        & $python (Join-Path $PSScriptRoot 'check_presentation.py')
        $code=$LASTEXITCODE
        if ($code -eq 0) { break }
        if ($attempt -lt 5) { Start-Sleep -Seconds 3 }
    }
    if ($code -ne 0) { throw 'Readiness needs attention. Review .local\local-demo-readiness.json and .local\stack logs. No data was generated.' }
    Write-Host 'FactoryPulse: http://localhost:3000/'
    Write-Host 'AI Simulator: http://127.0.0.1:5174/'
    if ($OpenBrowser) { Start-Process 'http://localhost:3000/'; Start-Process 'http://127.0.0.1:5174/' }
} finally { Pop-Location }
