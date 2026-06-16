# Configuracao para Rede Local

Este projeto deve rodar como sistema interno na rede local, acessivel por Wi-Fi ou cabo em:

```text
http://IP-DO-PC:3000
```

Nao use port forwarding no roteador, ngrok, Cloudflare Tunnel, Vercel publico ou qualquer exposicao para internet.

## 1. Gerar build de producao

Rode sempre que atualizar o codigo:

```powershell
npm run build
```

O build e separado da inicializacao. O servidor automatico nao executa build a cada boot.

## 2. Iniciar servidor manualmente

```powershell
npm run start
```

O script usa:

```text
next start -H 0.0.0.0 -p 3000
```

Isso permite acesso pela rede local usando o IP do PC.

## 3. Descobrir o IP local

```powershell
npm run local:url
```

O comando mostra URLs como:

```text
http://192.168.0.10:3000
```

## 4. Configurar firewall do Windows

Abra o PowerShell como Administrador e rode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows-firewall.ps1
```

O script cria:

- `Allow Vertex Moveis App LAN Only`: permite TCP 3000 no perfil Private.
- `Block Vertex Moveis App Public`: bloqueia TCP 3000 no perfil Public.

Mantenha a rede do Windows como Privada para permitir acesso interno. Em rede Publica, a porta sera bloqueada.

Antivirus ou firewall de terceiros podem bloquear o acesso mesmo com essas regras.

## 5. Registrar inicializacao automatica

Abra o PowerShell como Administrador e rode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/register-startup-task.ps1
```

A tarefa criada chama:

```text
scripts/start-local-server.bat
```

Ela inicia quando o usuario faz logon no Windows.

Para testar:

```powershell
schtasks /Run /TN "Vertex Moveis Server"
```

Para consultar:

```powershell
schtasks /Query /TN "Vertex Moveis Server" /V /FO LIST
```

Para remover a inicializacao automatica:

```powershell
schtasks /Delete /TN "Vertex Moveis Server" /F
```

## 6. Testar de outro computador ou celular

1. Conecte o outro dispositivo no mesmo Wi-Fi ou rede cabeada.
2. Rode `npm run local:url` no PC servidor.
3. Abra no outro dispositivo:

```text
http://IP-DO-PC:3000
```

## 7. Logs

O script de inicializacao grava:

```text
logs/server.log
logs/server-error.log
```

Nao salve senhas ou secrets nesses arquivos.
