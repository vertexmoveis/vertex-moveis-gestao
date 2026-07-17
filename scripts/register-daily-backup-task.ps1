$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot 'backup-database.ps1'
$taskName = 'VertexMoveisBackupDiario'

if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Script de backup não encontrado em $backupScript"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At 18:00
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 15) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew
$account = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Backup diário configurado: $taskName"
Write-Host 'Horário: todos os dias às 18:00'
Write-Host 'Retenção: 30 dias. Uma segunda cópia só será criada quando BACKUP_SECONDARY_DIR for configurado explicitamente.'
