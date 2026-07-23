import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildQuoteApprovalMessage,
  buildQuoteComparisonApprovalMessage,
  buildQuoteFollowUpMessage,
} from '@/lib/quotes'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalSnapshot,
} from '@/lib/quote-approval'
import { badRequest, forbidden, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { isDateOnlyExpired } from '@/lib/date-only'
import { evaluateQuoteReadiness } from '@/lib/quote-readiness'
import { COMPANY_PROFILE_ID, withCompanyProfileDefaults } from '@/lib/company-profile'

const requestSchema = z.object({
  reminder: z.boolean().optional(),
  comparisonQuoteId: z.string().trim().min(1).optional(),
}).strict()

const quoteInclude = {
  client: {
    select: {
      name: true,
      document: true,
      phone: true,
      whatsapp: true,
      address: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      zipCode: true,
    },
  },
  items: { orderBy: { position: 'asc' as const } },
  revisions: { orderBy: { version: 'desc' as const }, take: 1, select: { version: true } },
}

function whatsAppUrl(phone: string | null | undefined, message: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const number = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

function pairKey(quoteId: string, comparisonQuoteId?: string | null) {
  return [quoteId, comparisonQuoteId].filter((value): value is string => Boolean(value)).sort().join(':')
}

function earliestExpiry(values: Array<Date | null>) {
  const dates = values.filter((value): value is Date => Boolean(value))
  if (dates.length === 0) return null
  return dates.reduce((earliest, current) => current.getTime() < earliest.getTime() ? current : earliest)
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

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body ?? {})
  if (!parsed.success) return badRequest('Dados inválidos.')

  const reminder = parsed.data.reminder === true
  const [quote, companyProfile] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, archivedAt: null },
      include: quoteInclude,
    }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
  ])

  if (!quote) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })
  if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) return forbidden()
  if (quote.convertedProjectId || quote.status === 'SOLD') return badRequest('Este orçamento já foi transformado em projeto.')
  if (quote.status === 'LOST') return badRequest('Não é possível enviar um orçamento marcado como perdido.')
  if (quote.status === 'APPROVED') return badRequest('Este orçamento já foi aprovado. Transforme-o em projeto para continuar.')

  let comparisonQuoteId = parsed.data.comparisonQuoteId
  if (!comparisonQuoteId && reminder) {
    const activeRequest = await prisma.quoteApprovalRequest.findFirst({
      where: {
        OR: [{ quoteId: quote.id }, { comparisonQuoteId: quote.id }],
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { quoteId: true, comparisonQuoteId: true },
    })
    comparisonQuoteId = activeRequest
      ? (activeRequest.quoteId === quote.id ? activeRequest.comparisonQuoteId || undefined : activeRequest.quoteId)
      : undefined
  }

  if (comparisonQuoteId === quote.id) return badRequest('Escolha outro orçamento para comparar.')

  const comparisonQuote = comparisonQuoteId
    ? await prisma.quote.findFirst({
        where: { id: comparisonQuoteId, archivedAt: null },
        include: quoteInclude,
      })
    : null

  if (comparisonQuoteId && !comparisonQuote) return badRequest('O segundo orçamento não foi encontrado.')
  if (comparisonQuote && auth.user.role !== 'ADMIN' && comparisonQuote.createdById !== auth.user.id) return forbidden()
  if (comparisonQuote && comparisonQuote.clientId !== quote.clientId) {
    return badRequest('As duas propostas precisam pertencer ao mesmo cliente.')
  }
  if (comparisonQuote?.convertedProjectId || comparisonQuote?.status === 'SOLD') {
    return badRequest('A segunda proposta já foi transformada em projeto.')
  }
  if (comparisonQuote && ['LOST', 'APPROVED'].includes(comparisonQuote.status)) {
    return badRequest('A segunda proposta não está disponível para aprovação.')
  }

  const now = new Date()
  const quotes = comparisonQuote ? [quote, comparisonQuote] : [quote]
  for (const currentQuote of quotes) {
    if (isDateOnlyExpired(currentQuote.validUntil, now)) {
      return badRequest(`A validade de "${currentQuote.title}" expirou. Atualize a proposta antes de enviar.`)
    }
    const readiness = evaluateQuoteReadiness({
      ...currentQuote,
      company: withCompanyProfileDefaults(companyProfile),
    }, now)
    if (!readiness.ready) {
      return NextResponse.json({
        error: `Complete os dados obrigatórios de "${currentQuote.title}" antes de enviar.`,
        missingFields: readiness.issues.map((issue) => issue.label),
      }, { status: 422 })
    }
  }

  const approvalSnapshot = comparisonQuote
    ? buildQuoteApprovalBundleSnapshot([quote, comparisonQuote])
    : buildQuoteApprovalSnapshot(quote)
  const revisionVersion = quote.revisions[0]?.version || null
  const comparisonRevisionVersion = comparisonQuote?.revisions[0]?.version || null
  const quoteIds = quotes.map((currentQuote) => currentQuote.id)
  const expiresAt = earliestExpiry(quotes.map((currentQuote) => currentQuote.validUntil))

  const request = await prisma.$transaction(async (tx) => {
    const latest = await tx.quoteApprovalRequest.findFirst({
      where: {
        OR: [
          { quoteId: { in: quoteIds } },
          { comparisonQuoteId: { in: quoteIds } },
        ],
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
    const canReuse = latest
      && pairKey(latest.quoteId, latest.comparisonQuoteId) === pairKey(quote.id, comparisonQuote?.id)
      && latest.snapshot === approvalSnapshot
      && !isDateOnlyExpired(latest.expiresAt, now)

    if (!canReuse) {
      await tx.quoteApprovalRequest.updateMany({
        where: {
          OR: [
            { quoteId: { in: quoteIds } },
            { comparisonQuoteId: { in: quoteIds } },
          ],
          approvedAt: null,
          rejectedAt: null,
          invalidatedAt: null,
        },
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
            comparisonQuoteId: comparisonQuote?.id || null,
            token: randomBytes(24).toString('base64url'),
            sentAt: now,
            expiresAt,
            reminderCount: reminder ? 1 : 0,
            lastReminderAt: reminder ? now : null,
            snapshot: approvalSnapshot,
            revisionVersion,
            comparisonRevisionVersion,
          },
        })

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'WAITING_APPROVAL', sentAt: quote.sentAt || now },
    })
    if (comparisonQuote) {
      await tx.quote.update({
        where: { id: comparisonQuote.id },
        data: { status: 'WAITING_APPROVAL', sentAt: comparisonQuote.sentAt || now },
      })
    }
    return approvalRequest
  })

  const approvalUrl = new URL(`/proposta/${request.token}`, req.url).toString()
  const orderedQuotes = [...quotes].sort((left, right) => left.number - right.number)
  const message = comparisonQuote
    ? buildQuoteComparisonApprovalMessage(
        [orderedQuotes[0], orderedQuotes[1]],
        approvalUrl,
        reminder,
      )
    : reminder
      ? buildQuoteFollowUpMessage(quote, approvalUrl)
      : buildQuoteApprovalMessage(quote, approvalUrl)

  return NextResponse.json({
    approvalUrl,
    message,
    whatsAppUrl: whatsAppUrl(quote.client.whatsapp || quote.client.phone, message),
    quoteStatus: 'WAITING_APPROVAL',
    comparisonQuote: comparisonQuote ? {
      id: comparisonQuote.id,
      title: comparisonQuote.title,
      total: Number(comparisonQuote.total),
    } : null,
    request: {
      id: request.id,
      reminderCount: request.reminderCount,
      sentAt: request.sentAt.toISOString(),
      lastReminderAt: request.lastReminderAt?.toISOString() || null,
      expiresAt: request.expiresAt?.toISOString() || null,
    },
  })
}
