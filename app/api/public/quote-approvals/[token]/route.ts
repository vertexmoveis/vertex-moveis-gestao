import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalOptionsSnapshot,
  buildQuoteApprovalSnapshot,
  parseQuoteApprovalBundleSnapshot,
  parseQuoteApprovalOptionsSnapshot,
} from '@/lib/quote-approval'
import { getClientIp } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { isDateOnlyExpired } from '@/lib/date-only'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { syncClientRelationshipStage } from '@/lib/client-relationship'

const optionalDocument = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(5).max(30).optional(),
)

const decisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('APPROVE'),
    selectedQuoteId: z.string().trim().min(1).optional(),
    respondentName: z.string().trim().min(3).max(120),
    respondentDocument: optionalDocument,
    acceptedTerms: z.literal(true),
    note: z.string().trim().max(1000).optional(),
  }).strict(),
  z.object({
    decision: z.literal('REJECT'),
    respondentName: z.string().trim().min(3).max(120),
    note: z.string().trim().max(1000).optional(),
  }).strict(),
])

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
}

function responseIpHash(req: NextRequest) {
  const salt = process.env.NEXTAUTH_SECRET || 'vertex-approval'
  return createHash('sha256').update(`${salt}:${getClientIp(req)}`).digest('hex')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  }

  const limited = await rateLimit(publicRateLimitKey('quote-approval:respond', getClientIp(req)), 10, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) return NextResponse.json({ error: 'Tente novamente em alguns instantes.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Resposta inválida.' }, { status: 400 })

  const now = new Date()
  const status = parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'LOST'
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await tx.quoteApprovalRequest.findUnique({
      where: { token },
      include: {
        quote: { include: quoteInclude },
        comparisonQuote: { include: quoteInclude },
        options: {
          orderBy: { position: 'asc' },
          include: { quote: { include: quoteInclude } },
        },
      },
    })

    if (!request) return { status: 404, error: 'Este link não é válido.' }
    if (request.invalidatedAt) return { status: 409, error: 'Esta proposta foi atualizada. Peça um novo link à Vertex Móveis.' }
    if (isDateOnlyExpired(request.expiresAt, now)) return { status: 410, error: 'Este link de aprovação expirou.' }
    const quotes = request.options.length > 0
      ? request.options.map((option) => option.quote)
      : request.comparisonQuote ? [request.quote, request.comparisonQuote] : [request.quote]
    if (request.approvedAt || request.rejectedAt || quotes.some((quote) => Boolean(quote.convertedProjectId))) {
      return { status: 409, error: 'Este orçamento já recebeu uma resposta.' }
    }

    const currentSnapshot = quotes.length > 1
      ? parseQuoteApprovalOptionsSnapshot(request.snapshot)
        ? buildQuoteApprovalOptionsSnapshot(quotes)
        : quotes.length === 2 && parseQuoteApprovalBundleSnapshot(request.snapshot)
          ? buildQuoteApprovalBundleSnapshot([quotes[0], quotes[1]])
          : buildQuoteApprovalOptionsSnapshot(quotes)
      : buildQuoteApprovalSnapshot(request.quote)
    if (request.snapshot && request.snapshot !== currentSnapshot) {
      await tx.quoteApprovalRequest.update({ where: { id: request.id }, data: { invalidatedAt: now } })
      return { status: 409, error: 'A proposta mudou depois do envio. Peça um novo link antes de responder.' }
    }

    const selectedQuoteId = parsed.data.decision === 'APPROVE'
      ? (quotes.length > 1 ? parsed.data.selectedQuoteId : quotes[0].id)
      : null
    if (parsed.data.decision === 'APPROVE' && !selectedQuoteId) {
      return { status: 400, error: 'Escolha uma das propostas antes de aprovar.' }
    }
    if (selectedQuoteId && !quotes.some((quote) => quote.id === selectedQuoteId)) {
      return { status: 400, error: 'A opção escolhida não pertence a esta proposta.' }
    }

    const otherQuotes = selectedQuoteId ? quotes.filter((quote) => quote.id !== selectedQuoteId) : []
    const selectedQuote = selectedQuoteId
      ? quotes.find((quote) => quote.id === selectedQuoteId) || quotes[0]
      : quotes[0]
    const optionRevision = request.options.find((option) => option.quoteId === selectedQuote.id)?.revisionVersion
    const selectedRevisionVersion = optionRevision
      ?? (selectedQuote.id === request.quoteId ? request.revisionVersion : request.comparisonRevisionVersion)
    const firstOtherQuote = otherQuotes[0] || null
    const otherRevisionVersion = firstOtherQuote
      ? request.options.find((option) => option.quoteId === firstOtherQuote.id)?.revisionVersion
        ?? (firstOtherQuote.id === request.quoteId ? request.revisionVersion : request.comparisonRevisionVersion)
      : null

    const requestUpdate = await tx.quoteApprovalRequest.updateMany({
      where: { id: request.id, approvedAt: null, rejectedAt: null, invalidatedAt: null },
      data: {
        ...(parsed.data.decision === 'APPROVE'
          ? {
              approvedAt: now,
              quoteId: selectedQuote.id,
              comparisonQuoteId: firstOtherQuote?.id || null,
              selectedQuoteId: selectedQuote.id,
              revisionVersion: selectedRevisionVersion,
              comparisonRevisionVersion: otherRevisionVersion,
            }
          : { rejectedAt: now }),
        snapshot: request.snapshot || currentSnapshot,
        responseIpHash: responseIpHash(req),
        responseUserAgent: (req.headers.get('user-agent') || '').slice(0, 500) || null,
        responseNote: parsed.data.note || null,
        responseName: parsed.data.respondentName,
        responseDocument: parsed.data.decision === 'APPROVE' ? parsed.data.respondentDocument || null : null,
        acceptedTermsAt: parsed.data.decision === 'APPROVE' ? now : null,
      },
    })
    if (requestUpdate.count !== 1) return { status: 409, error: 'Este orçamento já recebeu uma resposta.' }

    if (parsed.data.decision === 'APPROVE') {
      await tx.quote.update({
        where: { id: selectedQuote.id },
        data: { status: 'APPROVED', approvedAt: now, lostAt: null, lossReason: null },
      })
      for (const otherQuote of otherQuotes) {
        await tx.quote.update({
          where: { id: otherQuote.id },
          data: {
            status: 'LOST',
            approvedAt: null,
            lostAt: now,
            lossReason: `Outra opção foi escolhida: ${selectedQuote.variationName}`,
          },
        })
      }
    } else {
      for (const quote of quotes) {
        await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: 'LOST',
            approvedAt: null,
            lostAt: now,
            lossReason: parsed.data.note || 'Cliente solicitou ajustes nas propostas',
          },
        })
      }
    }

    const quoteIds = quotes.map((quote) => quote.id)
    await tx.quoteApprovalRequest.updateMany({
      where: {
        id: { not: request.id },
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

    await syncClientRelationshipStage(tx, request.quote.clientId, { activityAt: now })
    return {
      status: 200,
      selectedQuoteId: parsed.data.decision === 'APPROVE' ? selectedQuote.id : null,
      selectedQuoteTitle: parsed.data.decision === 'APPROVE' ? selectedQuote.variationName : null,
    }
  })

  if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  return NextResponse.json({
    success: true,
    status,
    selectedQuoteId: outcome.selectedQuoteId,
    selectedQuoteTitle: outcome.selectedQuoteTitle,
    certificateUrl: status === 'APPROVED' ? `/api/public/quote-approvals/${token}/certificate` : null,
  })
}
