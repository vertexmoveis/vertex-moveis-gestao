import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  runOperationalHealthCheck,
  sendOperationalAlert,
} from '@/lib/health-monitor'

export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const health = await runOperationalHealthCheck()
  const previous = await prisma.systemEvent.findFirst({
    where: { type: { in: ['HEALTH_CHECK_SUCCESS', 'HEALTH_CHECK_WARNING', 'HEALTH_CHECK_FAILURE'] } },
    orderBy: { createdAt: 'desc' },
    select: { details: true },
  })
  const previousDetails = previous?.details && typeof previous.details === 'object' && !Array.isArray(previous.details)
    ? previous.details as Record<string, unknown>
    : {}
  const changed = previousDetails.fingerprint !== health.fingerprint
  let alertSent = false
  let alertError: string | null = null

  if (health.status !== 'healthy' && changed) {
    try {
      alertSent = await sendOperationalAlert(health)
    } catch (error) {
      alertError = (error instanceof Error ? error.message : 'Falha ao enviar alerta.').slice(0, 500)
    }
  }

  const type = health.status === 'healthy'
    ? 'HEALTH_CHECK_SUCCESS'
    : health.status === 'critical'
      ? 'HEALTH_CHECK_FAILURE'
      : 'HEALTH_CHECK_WARNING'
  await prisma.systemEvent.create({
    data: {
      type,
      severity: health.status === 'critical' ? 'ERROR' : health.status === 'degraded' ? 'WARNING' : 'INFO',
      source: 'operational-health',
      message: health.status === 'healthy'
        ? 'Todas as verificações operacionais estão saudáveis.'
        : health.status === 'critical'
          ? 'Uma verificação essencial do sistema falhou.'
          : 'O sistema está disponível, mas há configurações ou verificações pendentes.',
      details: {
        status: health.status,
        fingerprint: health.fingerprint,
        alertSent,
        alertError,
        checks: health.checks,
      },
    },
  })

  return NextResponse.json({ success: true, changed, alertSent, health })
}
