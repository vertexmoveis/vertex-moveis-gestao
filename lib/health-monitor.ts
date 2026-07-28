import { createHash } from 'node:crypto'
import { prisma } from './db'
import { getWhatsAppIntegrationStatus } from './whatsapp-cloud'

export type HealthCheckItem = {
  id: string
  label: string
  status: 'OK' | 'WARNING' | 'ERROR'
  message: string
  required: boolean
}

export type OperationalHealth = {
  status: 'healthy' | 'degraded' | 'critical'
  checkedAt: string
  fingerprint: string
  checks: HealthCheckItem[]
}

type HealthSource = {
  databaseOk: boolean
  backupOk: boolean
  backupMessage: string
  restoreOk: boolean
  restoreMessage: string
  recentErrorCount: number
  whatsappReady: boolean
  scannerConfigured: boolean
  alertWebhookConfigured: boolean
}

export function summarizeOperationalHealth(source: HealthSource): OperationalHealth {
  const checks: HealthCheckItem[] = [
    {
      id: 'database',
      label: 'Banco de dados',
      status: source.databaseOk ? 'OK' : 'ERROR',
      message: source.databaseOk ? 'Conexão respondendo.' : 'A conexão não respondeu.',
      required: true,
    },
    {
      id: 'backup',
      label: 'Backup externo',
      status: source.backupOk ? 'OK' : 'ERROR',
      message: source.backupMessage,
      required: true,
    },
    {
      id: 'restore',
      label: 'Teste de restauração',
      status: source.restoreOk ? 'OK' : 'WARNING',
      message: source.restoreMessage,
      required: false,
    },
    {
      id: 'errors',
      label: 'Erros do servidor',
      status: source.recentErrorCount === 0 ? 'OK' : 'WARNING',
      message: source.recentErrorCount === 0
        ? 'Nenhum erro nas últimas 24 horas.'
        : `${source.recentErrorCount} erro(s) nas últimas 24 horas.`,
      required: false,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp oficial',
      status: source.whatsappReady ? 'OK' : 'WARNING',
      message: source.whatsappReady ? 'Meta Cloud API pronta.' : 'Credenciais ou modelos pendentes.',
      required: false,
    },
    {
      id: 'scanner',
      label: 'Scanner de arquivos',
      status: source.scannerConfigured ? 'OK' : 'WARNING',
      message: source.scannerConfigured ? 'Scanner externo configurado.' : 'Somente assinatura interna de arquivo.',
      required: false,
    },
    {
      id: 'alerts',
      label: 'Alerta externo',
      status: source.alertWebhookConfigured ? 'OK' : 'WARNING',
      message: source.alertWebhookConfigured ? 'Webhook de operação configurado.' : 'Nenhum webhook externo configurado.',
      required: false,
    },
  ]

  const status = checks.some((check) => check.status === 'ERROR' && check.required)
    ? 'critical'
    : checks.some((check) => check.status !== 'OK')
      ? 'degraded'
      : 'healthy'
  const fingerprint = createHash('sha256')
    .update(checks.filter((check) => check.status !== 'OK').map((check) => `${check.id}:${check.status}`).join('|') || 'healthy')
    .digest('hex')
    .slice(0, 16)

  return {
    status,
    checkedAt: new Date().toISOString(),
    fingerprint,
    checks,
  }
}

function eventDetails(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function runOperationalHealthCheck(): Promise<OperationalHealth> {
  const now = new Date()
  const backupCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000)
  const restoreCutoff = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
  const errorCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    return summarizeOperationalHealth({
      databaseOk: false,
      backupOk: false,
      backupMessage: 'Não foi possível consultar o histórico de backup.',
      restoreOk: false,
      restoreMessage: 'Não foi possível consultar o teste de restauração.',
      recentErrorCount: 0,
      whatsappReady: false,
      scannerConfigured: Boolean(process.env.FILE_SCAN_WEBHOOK_URL?.trim()),
      alertWebhookConfigured: Boolean(process.env.OPERATIONS_ALERT_WEBHOOK_URL?.trim()),
    })
  }

  const [latestBackup, latestRestore, recentErrorCount] = await Promise.all([
    prisma.systemEvent.findFirst({
      where: { type: { in: ['BACKUP_SUCCESS', 'BACKUP_FAILURE'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.systemEvent.findFirst({
      where: { type: { in: ['RESTORE_TEST_SUCCESS', 'RESTORE_TEST_FAILURE'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.systemEvent.count({
      where: {
        severity: 'ERROR',
        createdAt: { gte: errorCutoff },
        type: { notIn: ['HEALTH_CHECK_FAILURE'] },
      },
    }),
  ])

  const backupDetails = eventDetails(latestBackup?.details)
  const backupRecent = Boolean(latestBackup && latestBackup.createdAt >= backupCutoff)
  const backupCopied = backupDetails.secondaryCopied === true
    || backupDetails.storage === 'vercel-blob-private'
  const backupOk = latestBackup?.type === 'BACKUP_SUCCESS' && backupRecent && backupCopied

  const restoreDetails = eventDetails(latestRestore?.details)
  const restoreRecent = Boolean(latestRestore && latestRestore.createdAt >= restoreCutoff)
  const restoreOk = latestRestore?.type === 'RESTORE_TEST_SUCCESS'
    && restoreRecent
    && restoreDetails.externalDatabase === true
  const whatsapp = getWhatsAppIntegrationStatus()

  return summarizeOperationalHealth({
    databaseOk: true,
    backupOk,
    backupMessage: backupOk
      ? 'Cópia recente, criptografada e armazenada fora do banco.'
      : latestBackup
        ? 'O último backup está antigo, falhou ou não confirmou a segunda cópia.'
        : 'Nenhum backup foi registrado.',
    restoreOk,
    restoreMessage: restoreOk
      ? 'Restauração externa conferida nos últimos 35 dias.'
      : latestRestore?.type === 'RESTORE_TEST_SUCCESS' && restoreRecent
        ? 'A restauração foi testada apenas em esquema isolado.'
        : 'Execute o teste mensal de restauração externa.',
    recentErrorCount,
    whatsappReady: whatsapp.ready,
    scannerConfigured: Boolean(process.env.FILE_SCAN_WEBHOOK_URL?.trim()),
    alertWebhookConfigured: Boolean(process.env.OPERATIONS_ALERT_WEBHOOK_URL?.trim()),
  })
}

export async function sendOperationalAlert(health: OperationalHealth) {
  const configuredUrl = process.env.OPERATIONS_ALERT_WEBHOOK_URL?.trim()
  if (!configuredUrl) return false
  const url = new URL(configuredUrl)
  if (url.protocol !== 'https:') throw new Error('OPERATIONS_ALERT_WEBHOOK_URL deve usar HTTPS.')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OPERATIONS_ALERT_WEBHOOK_SECRET
        ? { 'X-Vertex-Secret': process.env.OPERATIONS_ALERT_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify({
      system: 'Vertex Móveis',
      status: health.status,
      checkedAt: health.checkedAt,
      fingerprint: health.fingerprint,
      checks: health.checks.filter((check) => check.status !== 'OK'),
      dashboardUrl: process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/dashboard/settings`
        : null,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`O webhook de operação respondeu com status ${response.status}.`)
  return true
}
