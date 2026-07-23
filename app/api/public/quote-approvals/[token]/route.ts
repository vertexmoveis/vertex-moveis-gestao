import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalSnapshot,
} from '@/lib/quote-approval'
import { getClientIp } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { isDateOnlyExpired } from '@/lib/date-only'

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
  const limited = await rateLimit(`api:public:quote-approval:${token}:${getClientIp(req)}`, 10, 60 * 1000).catch((error) => {
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
      },
    })

    if (!request) return { status: 404, error: 'Este link não é válido.' }
    if (request.invalidatedAt) return { status: 409, error: 'Esta proposta foi atualizada. Peça um novo link à Vertex Móveis.' }
    if (isDateOnlyExpired(request.expiresAt, now)) return { status: 410, error: 'Este link de aprovação expirou.' }
    if (request.approvedAt || request.rejectedAt || request.quote.convertedProjectId || request.comparisonQuote?.convertedProjectId) {
      return { status: 409, error: 'Este orçamento já recebeu uma resposta.' }
    }

    const quotes = request.comparisonQuote ? [request.quote, request.comparisonQuote] : [request.quote]
    const currentSnapshot = request.comparisonQuote
      ? buildQuoteApprovalBundleSnapshot([request.quote, request.comparisonQuote])
      : buildQuoteApprovalSnapshot(request.quote)
    if (request.snapshot && request.snapshot !== currentSnapshot) {
      await tx.quoteApprovalRequest.update({ where: { id: request.id }, data: { invalidatedAt: now } })
      return { status: 409, error: 'A proposta mudou depois do envio. Peça um novo link antes de responder.' }
    }

    const selectedQuoteId = parsed.data.decision === 'APPROVE'
      ? (request.comparisonQuote ? parsed.data.selectedQuoteId : request.quoteId)
      : null
    if (parsed.data.decision === 'APPROVE' && !selectedQuoteId) {
      return { status: 400, error: 'Escolha uma das duas propostas antes de aprovar.' }
    }
    if (selectedQuoteId && !quotes.some((quote) => quote.id === selectedQuoteId)) {
      return { status: 400, error: 'A opção escolhida não pertence a esta proposta.' }
    }

    const otherQuote = selectedQuoteId
      ? quotes.find((quote) => quote.id !== selectedQuoteId) || null
      : null
    const selectedQuote = selectedQuoteId
      ? quotes.find((quote) => quote.id === selectedQuoteId) || request.quote
      : request.quote
    const selectedRevisionVersion = selectedQuote.id === request.quoteId
      ? request.revisionVersion
      : request.comparisonRevisionVersion
    const otherRevisionVersion = otherQuote
      ? (otherQuote.id === request.quoteId ? request.revisionVersion : request.comparisonRevisionVersion)
      : null

    const requestUpdate = await tx.quoteApprovalRequest.updateMany({
      where: { id: request.id, approvedAt: null, rejectedAt: null, invalidatedAt: null },
      data: {
        ...(parsed.data.decision === 'APPROVE'
          ? {
              approvedAt: now,
              quoteId: selectedQuote.id,
              comparisonQuoteId: otherQuote?.id || null,
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
      if (otherQuote) {
        await tx.quote.update({
          where: { id: otherQuote.id },
          data: {
            status: 'LOST',
            approvedAt: null,
            lostAt: now,
            lossReason: `Outra opção foi escolhida: ${selectedQuote.title}`,
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
        ],
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
      },
      data: { invalidatedAt: now },
    })

    return {
      status: 200,
      selectedQuoteId: parsed.data.decision === 'APPROVE' ? selectedQuote.id : null,
      selectedQuoteTitle: parsed.data.decision === 'APPROVE' ? selectedQuote.title : null,
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
