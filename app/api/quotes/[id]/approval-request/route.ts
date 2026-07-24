import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildQuoteApprovalMessage,
  buildQuoteFollowUpMessage,
  buildQuoteOptionsApprovalMessage,
} from '@/lib/quotes'
import {
  buildQuoteApprovalOptionsSnapshot,
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
  comparisonQuoteIds: z.array(z.string().trim().min(1)).max(2).optional(),
}).strict().superRefine((value, ctx) => {
  const ids = value.comparisonQuoteIds || (value.comparisonQuoteId ? [value.comparisonQuoteId] : [])
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['comparisonQuoteIds'], message: 'Escolha opções diferentes.' })
  }
})

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

function quoteSetKey(quoteIds: Array<string | null | undefined>) {
  return quoteIds.filter((value): value is string => Boolean(value)).sort().join(':')
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
  if (quote.status === 'APPROVED') return badRequest('Este orçamento já foi aprovado. Transforme-o em projeto para continuar.')

  let comparisonQuoteIds = parsed.data.comparisonQuoteIds
    || (parsed.data.comparisonQuoteId ? [parsed.data.comparisonQuoteId] : [])
  if (comparisonQuoteIds.length === 0 && reminder) {
    const activeRequest = await prisma.quoteApprovalRequest.findFirst({
      where: {
        OR: [
          { quoteId: quote.id },
          { comparisonQuoteId: quote.id },
          { options: { some: { quoteId: quote.id } } },
        ],
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        quoteId: true,
        comparisonQuoteId: true,
        options: { orderBy: { position: 'asc' }, select: { quoteId: true } },
      },
    })
    const linkedIds = activeRequest?.options.length
      ? activeRequest.options.map((option) => option.quoteId)
      : [activeRequest?.quoteId, activeRequest?.comparisonQuoteId]
    comparisonQuoteIds = linkedIds
      .filter((quoteId): quoteId is string => Boolean(quoteId) && quoteId !== quote.id)
      .slice(0, 2)
  }

  if (comparisonQuoteIds.includes(quote.id)) return badRequest('Escolha outras opções para comparar.')
  if (new Set(comparisonQuoteIds).size !== comparisonQuoteIds.length || comparisonQuoteIds.length > 2) {
    return badRequest('Escolha no máximo duas opções diferentes.')
  }

  const comparisonQuotes = comparisonQuoteIds.length > 0
    ? await prisma.quote.findMany({
        where: { id: { in: comparisonQuoteIds }, archivedAt: null },
        include: quoteInclude,
      })
    : []
  if (comparisonQuotes.length !== comparisonQuoteIds.length) return badRequest('Uma das opções não foi encontrada.')

  const orderedComparisonQuotes = comparisonQuoteIds.map((quoteId) => comparisonQuotes.find((candidate) => candidate.id === quoteId)!)
  for (const comparisonQuote of orderedComparisonQuotes) {
    if (auth.user.role !== 'ADMIN' && comparisonQuote.createdById !== auth.user.id) return forbidden()
    if (comparisonQuote.clientId !== quote.clientId) {
      return badRequest('Todas as propostas precisam pertencer ao mesmo cliente.')
    }
    if (comparisonQuote.convertedProjectId || comparisonQuote.status === 'SOLD') {
      return badRequest(`A opção "${comparisonQuote.variationName}" já foi transformada em projeto.`)
    }
    if (comparisonQuote.status === 'APPROVED') {
      return badRequest(`A opção "${comparisonQuote.variationName}" não está disponível para aprovação.`)
    }
  }

  const now = new Date()
  const quotes = [quote, ...orderedComparisonQuotes]
  const orderedQuotes = [...quotes].sort(
    (left, right) => left.variationOrder - right.variationOrder || left.number - right.number,
  )
  for (const currentQuote of orderedQuotes) {
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

  const approvalSnapshot = orderedQuotes.length > 1
    ? buildQuoteApprovalOptionsSnapshot(orderedQuotes)
    : buildQuoteApprovalSnapshot(quote)
  const revisionVersion = quote.revisions[0]?.version || null
  const comparisonRevisionVersion = quotes[1]?.revisions[0]?.version || null
  const quoteIds = orderedQuotes.map((currentQuote) => currentQuote.id)
  const expiresAt = earliestExpiry(orderedQuotes.map((currentQuote) => currentQuote.validUntil))

  const request = await prisma.$transaction(async (tx) => {
    const latest = await tx.quoteApprovalRequest.findFirst({
      where: {
        OR: [
          { quoteId: { in: quoteIds } },
          { comparisonQuoteId: { in: quoteIds } },
          { options: { some: { quoteId: { in: quoteIds } } } },
        ],
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
    })
    const latestQuoteIds = latest?.options.length
      ? latest.options.map((option) => option.quoteId)
      : [latest?.quoteId, latest?.comparisonQuoteId]
    const canReuse = latest
      && quoteSetKey(latestQuoteIds) === quoteSetKey(quoteIds)
      && latest.snapshot === approvalSnapshot
      && !isDateOnlyExpired(latest.expiresAt, now)

    if (!canReuse) {
      await tx.quoteApprovalRequest.updateMany({
        where: {
          OR: [
            { quoteId: { in: quoteIds } },
            { comparisonQuoteId: { in: quoteIds } },
            { options: { some: { quoteId: { in: quoteIds } } } },
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
            comparisonQuoteId: quotes[1]?.id || null,
            token: randomBytes(24).toString('base64url'),
            sentAt: now,
            expiresAt,
            reminderCount: reminder ? 1 : 0,
            lastReminderAt: reminder ? now : null,
            snapshot: approvalSnapshot,
            revisionVersion,
            comparisonRevisionVersion,
            options: {
              create: orderedQuotes.map((currentQuote, position) => ({
                quoteId: currentQuote.id,
                revisionVersion: currentQuote.revisions[0]?.version || null,
                position,
              })),
            },
          },
        })

    for (const currentQuote of orderedQuotes) {
      await tx.quote.update({
        where: { id: currentQuote.id },
        data: {
          status: 'WAITING_APPROVAL',
          sentAt: currentQuote.sentAt || now,
          lostAt: null,
          lossReason: null,
        },
      })
    }
    return approvalRequest
  })

  const approvalUrl = new URL(`/proposta/${request.token}`, req.url).toString()
  const message = orderedQuotes.length > 1
    ? buildQuoteOptionsApprovalMessage(orderedQuotes, approvalUrl, reminder)
    : reminder
      ? buildQuoteFollowUpMessage(quote, approvalUrl)
      : buildQuoteApprovalMessage(quote, approvalUrl)

  return NextResponse.json({
    approvalUrl,
    message,
    whatsAppUrl: whatsAppUrl(quote.client.whatsapp || quote.client.phone, message),
    quoteStatus: 'WAITING_APPROVAL',
    options: orderedQuotes.map((currentQuote) => ({
      id: currentQuote.id,
      title: currentQuote.title,
      variationName: currentQuote.variationName,
      total: Number(currentQuote.total),
    })),
    request: {
      id: request.id,
      reminderCount: request.reminderCount,
      sentAt: request.sentAt.toISOString(),
      lastReminderAt: request.lastReminderAt?.toISOString() || null,
      expiresAt: request.expiresAt?.toISOString() || null,
    },
  })
}
