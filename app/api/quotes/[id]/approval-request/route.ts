import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildQuoteApprovalMessage, buildQuoteFollowUpMessage } from '@/lib/quotes'
import { buildQuoteApprovalSnapshot } from '@/lib/quote-approval'
import { badRequest, forbidden, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { isDateOnlyExpired } from '@/lib/date-only'

function whatsAppUrl(phone: string | null | undefined, message: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const number = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:approval:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  let reminder = false
  try {
    const body = await req.json().catch(() => ({}))
    reminder = body?.reminder === true
  } catch {
    return badRequest('Dados inválidos')
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, phone: true, whatsapp: true } },
      items: { orderBy: { position: 'asc' } },
      revisions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
      approvalRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) return forbidden()
  if (quote.convertedProjectId || quote.status === 'SOLD') return badRequest('Este orçamento já foi transformado em projeto.')
  if (quote.status === 'LOST') return badRequest('Não é possível enviar um orçamento marcado como perdido.')
  if (quote.status === 'APPROVED') return badRequest('Este orçamento já foi aprovado. Transforme-o em projeto para continuar.')

  const now = new Date()
  if (isDateOnlyExpired(quote.validUntil, now)) {
    return badRequest('A validade deste orçamento expirou. Atualize a proposta antes de enviar para aprovação.')
  }
  const approvalSnapshot = buildQuoteApprovalSnapshot(quote)
  const revisionVersion = quote.revisions[0]?.version || null
  const request = await prisma.$transaction(async (tx) => {
    const latest = quote.approvalRequests[0]
    const canReuse = latest
      && !latest.approvedAt
      && !latest.rejectedAt
      && !latest.invalidatedAt
      && latest.snapshot === approvalSnapshot
      && !isDateOnlyExpired(latest.expiresAt, now)

    if (!canReuse) {
      await tx.quoteApprovalRequest.updateMany({
        where: { quoteId: quote.id, approvedAt: null, rejectedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      })
    }

    const approvalRequest = canReuse
      ? await tx.quoteApprovalRequest.update({
          where: { id: latest.id },
          data: reminder ? { reminderCount: { increment: 1 }, lastReminderAt: now } : { sentAt: now },
        })
      : await tx.quoteApprovalRequest.create({
          data: {
            quoteId: quote.id,
            token: randomBytes(24).toString('base64url'),
            sentAt: now,
            expiresAt: quote.validUntil || null,
            reminderCount: reminder ? 1 : 0,
            lastReminderAt: reminder ? now : null,
            snapshot: approvalSnapshot,
            revisionVersion,
          },
        })

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'WAITING_APPROVAL', sentAt: quote.sentAt || now },
    })
    return approvalRequest
  })

  const approvalUrl = new URL(`/proposta/${request.token}`, req.url).toString()
  const message = reminder
    ? buildQuoteFollowUpMessage(quote, approvalUrl)
    : buildQuoteApprovalMessage(quote, approvalUrl)

  return NextResponse.json({
    approvalUrl,
    message,
    whatsAppUrl: whatsAppUrl(quote.client.whatsapp || quote.client.phone, message),
    quoteStatus: 'WAITING_APPROVAL',
    request: {
      id: request.id,
      reminderCount: request.reminderCount,
      sentAt: request.sentAt.toISOString(),
      lastReminderAt: request.lastReminderAt?.toISOString() || null,
      expiresAt: request.expiresAt?.toISOString() || null,
    },
  })
}
