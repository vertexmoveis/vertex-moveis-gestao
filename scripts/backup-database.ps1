$ErrorActionPreference = 'Stop'

$backupScript = Join-Path $PSScriptRoot 'backup-database.mjs'
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = Get-Command node -ErrorAction Stop

if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Script de backup não encontrado em $backupScript"
}

$logDirectory = Join-Path $projectRoot 'logs\backups'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logFile = Join-Path $logDirectory ("backup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

& $node.Source $backupScript 2>&1 | Tee-Object -FilePath $logFile
$exitCode = $LASTEXITCODE

Get-ChildItem -LiteralPath $logDirectory -File -Filter 'backup-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

if ($exitCode -ne 0) {
  throw "Não foi possível criar o backup seguro. Consulte $logFile"
}
