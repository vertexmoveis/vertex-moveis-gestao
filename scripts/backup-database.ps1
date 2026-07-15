$ErrorActionPreference = 'Stop'

$backupScript = Join-Path $PSScriptRoot 'backup-database.mjs'
$node = Get-Command node -ErrorAction Stop

if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Script de backup não encontrado em $backupScript"
}

& $node.Source $backupScript
if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível criar o backup seguro.'
}
