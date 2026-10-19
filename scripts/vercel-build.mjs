import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runNpm(script) {
  return spawnSync(npm, ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
}

async function deployProductionMigrations() {
  if (process.env.VERCEL_ENV !== 'production') {
    process.stdout.write('Migrações ignoradas: este build não é de produção.\n')
    return
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    process.stdout.write(`Aplicando migrações de produção (tentativa ${attempt}/3)...\n`)
    const result = runNpm('db:deploy')
    if (!result.error && result.status === 0) return
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 5000))
  }

  throw new Error('Não foi possível aplicar as migrações de produção após 3 tentativas.')
}

await deployProductionMigrations()
if (process.env.VERCEL_ENV === 'production' && process.env.MAINTENANCE_MODE === 'apply') {
  if (!process.env.CONTRACT_CURRENCY_REPAIR_PLAN || !process.env.MAINTENANCE_PUBLIC_KEY || process.env.MAINTENANCE_RESULT_LOG !== '1') {
    throw new Error('Configuração incompleta para a correção de contratos.')
  }
  const maintenance = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/contract-currency-maintenance.ts'], {
    cwd: process.cwd(), env: process.env, stdio: 'inherit',
  })
  if (maintenance.error || maintenance.status !== 0) throw new Error('Correção de contratos interrompida. Consulte o resultado criptografado.')
  for (const key of ['CONTRACT_CURRENCY_REPAIR_PLAN', 'MAINTENANCE_MODE', 'MAINTENANCE_PUBLIC_KEY', 'MAINTENANCE_RESULT_LOG']) delete process.env[key]
}
const build = runNpm('build')
if (build.error) throw build.error
if (build.status !== 0) process.exitCode = build.status || 1
