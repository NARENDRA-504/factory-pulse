param(
    [Parameter(Mandatory=$true)][string]$User,
    [string]$Server = '127.0.0.1',
    [int]$Port = 3306,
    [ValidatePattern('^[A-Za-z0-9_]+$')][string]$Database = 'ziro_manufacturing',
    [string]$OutputDirectory = '',
    [string]$DumpExecutable = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $DumpExecutable -PathType Leaf)) { throw 'mysqldump is not installed at the supplied path.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\backups' }
$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$partial = Join-Path $OutputDirectory ($Database + '-' + $stamp + '.sql.partial')
$target = $partial.Substring(0, $partial.Length - '.partial'.Length)
Write-Host 'Use a backup/schema-owner account with SELECT, SHOW VIEW, TRIGGER and the required event/routine access.'
Write-Host 'The native MySQL prompt will request the password. It is not placed in command arguments or this script.'
Write-Host 'For a consistent recovery point, stop Simulator delivery and operational edits before running.'
$arguments = @('--host', $Server, '--port', "$Port", '--user', $User, '--password',
    '--single-transaction', '--quick', '--skip-lock-tables', '--no-tablespaces',
    '--set-gtid-purged=OFF', '--column-statistics=0', '--routines', '--events', '--triggers',
    '--default-character-set=utf8mb4', "--result-file=$partial", $Database)
& $DumpExecutable @arguments
if ($LASTEXITCODE -ne 0) { throw 'Backup failed. Any .partial file is incomplete; do not use it for recovery. No live data was deleted.' }
$file = Get-Item -LiteralPath $partial
if ($file.Length -eq 0) { throw 'Backup output is empty; not marked complete.' }
Move-Item -LiteralPath $partial -Destination $target
$hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
[ordered]@{created_utc=[DateTime]::UtcNow.ToString('o');database=$Database;bytes=$file.Length;sha256=$hash;restore_verified=$false} |
    ConvertTo-Json | Set-Content -LiteralPath ($target + '.manifest.json') -Encoding utf8
Write-Host "Backup saved: $target"
Write-Host 'Dump success and checksum are recorded. Restore is NOT verified until tested on an isolated MySQL instance.'
