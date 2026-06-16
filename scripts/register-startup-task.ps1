$ErrorActionPreference = "Stop"

$projectDir = "C:\Users\Marcenaria Vammery\Downloads\vertex-moveis-gestao-main"
$batPath = Join-Path $projectDir "scripts\start-local-server.bat"
$startupDir = [Environment]::GetFolderPath("Startup")
$startupCmd = Join-Path $startupDir "Vertex Moveis Server.cmd"
$startupVbs = Join-Path $startupDir "Vertex Moveis Server.vbs"

if (-not (Test-Path -LiteralPath $batPath)) {
  throw "Arquivo de inicializacao nao encontrado: $batPath"
}

if (-not (Test-Path -LiteralPath $startupDir)) {
  throw "Pasta Inicializar do Windows nao encontrada: $startupDir"
}

if (Test-Path -LiteralPath $startupCmd) {
  Remove-Item -LiteralPath $startupCmd -Force
}

$escapedBatPath = $batPath.Replace('"', '""')
@"
Set shell = CreateObject("WScript.Shell")
shell.Run """$escapedBatPath""", 0, False
"@ | Set-Content -LiteralPath $startupVbs -Encoding ASCII

Write-Host "Inicializacao registrada na pasta Inicializar do Windows."
Write-Host "Arquivo criado/atualizado: $startupVbs"
Write-Host "Diretorio do projeto: $projectDir"
Write-Host "O servidor sera iniciado em segundo plano quando este usuario fizer logon no Windows."
