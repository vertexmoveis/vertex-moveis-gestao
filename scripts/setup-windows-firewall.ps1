$ErrorActionPreference = "Stop"

$allowRule = "Allow Vertex Moveis App LAN Only"
$blockRule = "Block Vertex Moveis App Public"
$port = 3000

function Remove-RuleIfExists {
  param([string]$Name)

  $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    $existing | Remove-NetFirewallRule
  }
}

Remove-RuleIfExists -Name $allowRule
Remove-RuleIfExists -Name $blockRule

New-NetFirewallRule `
  -DisplayName $allowRule `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $port `
  -Profile Private `
  -Description "Allow Vertex Moveis Next.js app only on private LAN networks." | Out-Null

New-NetFirewallRule `
  -DisplayName $blockRule `
  -Direction Inbound `
  -Action Block `
  -Protocol TCP `
  -LocalPort $port `
  -Profile Public `
  -Description "Block Vertex Moveis Next.js app on public networks." | Out-Null

Write-Host "Firewall configurado para a porta $port."
Write-Host "Permitido apenas no perfil Private; bloqueado no perfil Public."
Write-Host "Nao configure port forwarding no roteador. O app deve ficar acessivel somente na rede local."
