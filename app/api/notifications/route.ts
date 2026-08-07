import { NextRequest, NextResponse } from 'next/server'
import { getAppAlerts } from '@/lib/alerts'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

function alertFingerprint(alert: { id: string; title: string; body: string }) {
  return `${alert.id}:${alert.title}:${alert.body}`
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:notifications:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const alerts = await getAppAlerts(auth.user)
  const states = await prisma.userAlertState.findMany({ where: { userId: auth.user.id } })
  const statesByAlert = new Map(states.map((state) => [state.alertId, state]))
  const now = new Date()

  return NextResponse.json(
    alerts.flatMap((alert) => {
      const fingerprint = alertFingerprint(alert)
      const state = statesByAlert.get(alert.id)
      const sameOccurrence = state?.fingerprint === fingerprint

      if (sameOccurrence && state?.resolvedAt) return []
      if (sameOccurrence && state?.snoozedUntil && state.snoozedUntil > now) return []

      return [{ ...alert, fingerprint, read: Boolean(sameOccurrence && state?.readAt) }]
    })
  )
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const alertId = typeof body?.alertId === 'string' ? body.alertId.trim() : ''
  const fingerprint = typeof body?.fingerprint === 'string' ? body.fingerprint.trim() : ''
  const action = body?.action
  if (!alertId || !fingerprint || !['READ', 'SNOOZE', 'RESOLVE'].includes(action)) {
    return NextResponse.json({ error: 'Dados do alerta inválidos.' }, { status: 400 })
  }

  const now = new Date()
  const snoozedUntil = action === 'SNOOZE' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null
  await prisma.userAlertState.upsert({
    where: { userId_alertId: { userId: auth.user.id, alertId } },
    create: {
      userId: auth.user.id,
      alertId,
      fingerprint,
      readAt: now,
      snoozedUntil,
      resolvedAt: action === 'RESOLVE' ? now : null,
    },
    update: {
      fingerprint,
      readAt: now,
      snoozedUntil,
      resolvedAt: action === 'RESOLVE' ? now : null,
    },
  })

  return NextResponse.json({ success: true, snoozedUntil })
}
