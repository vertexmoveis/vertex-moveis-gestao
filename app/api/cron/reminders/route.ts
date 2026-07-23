import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 30

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

function startOfDay(date = new Date()) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

async function sendWebhook(payload: unknown) {
  const configuredUrl = process.env.REMINDER_WEBHOOK_URL?.trim()
  if (!configuredUrl) return false
  const url = new URL(configuredUrl)
  if (url.protocol !== 'https:') throw new Error('REMINDER_WEBHOOK_URL deve usar HTTPS.')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.REMINDER_WEBHOOK_SECRET
        ? { 'X-Vertex-Secret': process.env.REMINDER_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`O webhook de lembretes respondeu com status ${response.status}.`)
  return true
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = startOfDay()
  const nextWeek = addDays(today, 7)
  const threeDaysAgo = addDays(today, -3)
  const source = `daily-reminders:${dayKey(today)}`
  const existing = await prisma.systemEvent.findFirst({ where: { source }, select: { id: true } })
  if (existing) return NextResponse.json({ success: true, skipped: true, reason: 'already_processed' })

  try {
    const [production, deliveries, quotes, overduePayments, stageDeadlines, blocked] = await Promise.all([
      prisma.project.findMany({
        where: {
          archivedAt: null,
          stage: 'PENDING_START',
          productionStartReminderDate: { lte: today },
        },
        take: 50,
        select: { id: true, name: true, client: { select: { name: true } } },
      }),
      prisma.project.findMany({
        where: {
          archivedAt: null,
          stage: { not: 'COMPLETED' },
          deliveryDeadlineDate: { gte: today, lte: nextWeek },
        },
        take: 50,
        select: { id: true, name: true, deliveryDeadlineDate: true, client: { select: { name: true } } },
      }),
      prisma.quote.findMany({
        where: {
          archivedAt: null,
          status: 'WAITING_APPROVAL',
          approvalRequests: {
            some: {
              approvedAt: null,
              rejectedAt: null,
              sentAt: { lte: threeDaysAgo },
            },
          },
        },
        take: 50,
        select: { id: true, title: true, client: { select: { name: true } } },
      }),
      prisma.projectPayment.count({
        where: { paidAt: null, dueDate: { lt: today }, project: { archivedAt: null } },
      }),
      prisma.project.findMany({
        where: {
          archivedAt: null,
          stage: { not: 'COMPLETED' },
          stageDeadlineDate: { lte: today },
        },
        take: 50,
        select: { id: true, name: true, stageDeadlineDate: true, client: { select: { name: true } } },
      }),
      prisma.project.findMany({
        where: { archivedAt: null, productionBlockedAt: { not: null }, stage: { not: 'COMPLETED' } },
        take: 50,
        select: { id: true, name: true, productionBlockReason: true, client: { select: { name: true } } },
      }),
    ])

    const payload = {
      date: dayKey(today),
      counts: {
        production: production.length,
        deliveries: deliveries.length,
        quotes: quotes.length,
        overduePayments,
        stageDeadlines: stageDeadlines.length,
        blocked: blocked.length,
      },
      production,
      deliveries,
      quotes,
      stageDeadlines,
      blocked,
      dashboardUrl: `${process.env.NEXTAUTH_URL?.replace(/\/$/, '') || req.nextUrl.origin}/dashboard`,
    }
    const webhookSent = await sendWebhook(payload)

    await prisma.systemEvent.create({
      data: {
        type: 'REMINDER_DISPATCH',
        severity: 'INFO',
        source,
        message: webhookSent
          ? 'Resumo diário de pendências enviado para a automação configurada.'
          : 'Resumo diário de pendências preparado; alertas disponíveis no sistema.',
        details: { ...payload.counts, webhookSent },
      },
    })

    return NextResponse.json({ success: true, counts: payload.counts, webhookSent })
  } catch (error) {
    await prisma.systemEvent.create({
      data: {
        type: 'REMINDER_FAILURE',
        severity: 'ERROR',
        source,
        message: (error instanceof Error ? error.message : 'Falha ao processar lembretes.').slice(0, 800),
      },
    }).catch(() => undefined)
    return NextResponse.json({ error: 'Não foi possível processar os lembretes.' }, { status: 500 })
  }
}
