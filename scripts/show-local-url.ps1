$port = 3000

function Test-PrivateIPv4 {
  param([string]$Address)

  if ($Address -match "^10\.") { return $true }
  if ($Address -match "^192\.168\.") { return $true }
  if ($Address -match "^172\.(1[6-9]|2[0-9]|3[0-1])\.") { return $true }
  return $false
}

$addresses = @()

try {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.IPAddress -ne "127.0.0.1" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    Select-Object IPAddress, InterfaceAlias
} catch {
  $addresses = @()
}

if (-not $addresses) {
  $ipconfigOutput = ipconfig
  $addresses = $ipconfigOutput |
    Select-String -Pattern "IPv4.*?:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)" |
    ForEach-Object {
      [pscustomobject]@{
        IPAddress = $_.Matches[0].Groups[1].Value
        InterfaceAlias = "ipconfig"
      }
    } |
    Where-Object {
      $_.IPAddress -ne "127.0.0.1" -and
      $_.IPAddress -notlike "169.254.*"
    }
}

$addresses = $addresses |
  Sort-Object @{ Expression = {
    if ($_.IPAddress -like "192.168.*") { 0 }
    elseif ($_.IPAddress -like "10.*") { 1 }
    elseif ($_.IPAddress -match "^172\.(1[6-9]|2[0-9]|3[0-1])\.") { 2 }
    else { 3 }
  }}, InterfaceAlias, IPAddress

if (-not $addresses) {
  Write-Host "Nenhum IPv4 de rede encontrado. Verifique se este PC esta conectado ao Wi-Fi/cabo."
  exit 1
}

Write-Host "URLs locais possiveis para acessar o Vertex Moveis:"
foreach ($address in $addresses) {
  $marker = if (Test-PrivateIPv4 -Address $address.IPAddress) { "" } else { " (verifique se este IP pertence a sua LAN)" }
  Write-Host ("http://{0}:{1}{2}" -f $address.IPAddress, $port, $marker)
}

Write-Host ""
Write-Host "Use um celular ou outro PC conectado na mesma rede local."
