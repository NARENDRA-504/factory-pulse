param([string]$SimulatorPath = '', [switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Create FactoryPulse .venv and install api_server/requirements.txt first. See docs/TEAMMATE-SETUP.md.' }
$setupArguments = @((Join-Path $PSScriptRoot 'connect_local_apps.py'), '--apply')
if ($SimulatorPath) { $setupArguments += @('--simulator-path', $SimulatorPath) }
& $python @setupArguments
if ($LASTEXITCODE -ne 0) { throw 'Local connection setup failed. Existing services were not stopped.' }
Write-Host 'If either backend was already running, stop it and restart it so it loads the saved settings.'
& (Join-Path $PSScriptRoot 'Start-LocalDemo.ps1') -OpenBrowser:$OpenBrowser
