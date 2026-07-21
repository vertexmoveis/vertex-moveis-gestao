import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { quoteSaveSchema, quoteStatusSchema } from '@/lib/quote-schemas'
import {
  buildQuoteSnapshot,
  calculateQuoteTotals,
  serializeQuote,
} from '@/lib/quotes'
import { badRequest, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { ensureDefaultQuoteSettings, getActiveQuotePriceRules } from '@/lib/quote-price-rules'
import { buildQuoteApprovalSnapshot } from '@/lib/quote-approval'
import { evaluateQuoteReadiness } from '@/lib/quote-readiness'
import { COMPANY_PROFILE_ID, withCompanyProfileDefaults } from '@/lib/company-profile'

async function canAccessQuote(id: string, user: { id: string; role: string }) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { createdById: true },
  })
  if (!quote) return { ok: false as const, status: 404 as const }
  if (user.role !== 'ADMIN' && quote.createdById !== user.id) return { ok: false as const, status: 403 as const }
  return { ok: true as const }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:get:${auth.user.id}:${id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await canAccessQuote(id, auth.user)
  if (!access.ok) return access.status === 404 ? NextResponse.json({ error: 'Not found' }, { status: 404 }) : forbidden()

  const [quote, companyProfile] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
        items: { orderBy: { position: 'asc' } },
        revisions: { orderBy: { version: 'desc' }, take: 10 },
        approvalRequests: {
          where: { approvedAt: { not: null } },
          orderBy: { approvedAt: 'desc' },
          take: 1,
          select: {
            token: true,
            approvedAt: true,
            responseName: true,
            responseDocument: true,
            acceptedTermsAt: true,
            invalidatedAt: true,
            revisionVersion: true,
          },
        },
        convertedProject: { select: { id: true, name: true } },
      },
    }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
  ])

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { approvalRequests, ...quoteWithoutApprovalRequests } = quote

  return NextResponse.json({
    ...serializeQuote(quoteWithoutApprovalRequests),
    readiness: evaluateQuoteReadiness({
      ...quote,
      company: withCompanyProfileDefaults(companyProfile),
    }),
    approvalRecord: approvalRequests[0]
      ? {
          ...approvalRequests[0],
          approvedAt: approvalRequests[0].approvedAt?.toISOString() || null,
          acceptedTermsAt: approvalRequests[0].acceptedTermsAt?.toISOString() || null,
          invalidatedAt: approvalRequests[0].invalidatedAt?.toISOString() || null,
        }
      : null,
    revisions: quote.revisions.map((revision) => ({
      ...revision,
      createdAt: revision.createdAt.toISOString(),
    })),
    convertedProject: quote.convertedProject,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:put:${auth.user.id}:${id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await canAccessQuote(id, auth.user)
  if (!access.ok) return access.status === 404 ? NextResponse.json({ error: 'Not found' }, { status: 404 }) : forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  const parsed = quoteSaveSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const input = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      await ensureDefaultQuoteSettings(tx)
      const [priceRules, materials] = await Promise.all([
        getActiveQuotePriceRules(tx),
        tx.materialCatalogItem.findMany({ where: { active: true }, select: { name: true, unitCost: true, active: true } }),
      ])
      const totals = calculateQuoteTotals(input.items, { ...input, priceRules, materialCosts: materials })
      const existing = await tx.quote.findUnique({
        where: { id },
        include: {
          client: { select: { name: true, document: true, phone: true, whatsapp: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
          items: { orderBy: { position: 'asc' } },
          approvalRequests: {
            where: { invalidatedAt: null },
            select: { id: true, approvedAt: true, rejectedAt: true },
          },
        },
      })
      if (!existing) throw new Error('Not found')
      if (existing.convertedProjectId || existing.status === 'SOLD') throw new Error('Quote locked')
      if (input.status === 'SOLD') throw new Error('Invalid manual status')
      if (
        input.status === 'APPROVED' &&
        (existing.status !== 'APPROVED' || !existing.approvalRequests.some((request) => Boolean(request.approvedAt)))
      ) {
        throw new Error('Invalid manual status')
      }

      const previousApprovalSnapshot = buildQuoteApprovalSnapshot(existing)

      await tx.quoteItem.deleteMany({ where: { quoteId: id } })

      let updated = await tx.quote.update({
        where: { id },
        data: {
          clientId: input.clientId,
          title: input.title,
          status: input.status,
          validUntil: input.validUntil,
          deliveryBusinessDays: input.deliveryBusinessDays,
          firstInstallmentDate: input.firstInstallmentDate,
          pricePerM2: input.pricePerM2,
          materialCostPerM2: input.materialCostPerM2,
          installationFee: input.installationFee,
          marginPercent: input.marginPercent,
          discount: totals.discount,
          manualDiscount: totals.manualDiscount,
          paymentDiscount: totals.paymentDiscount,
          paymentMethod: totals.paymentMethod,
          cardInstallments: totals.cardInstallments,
          cardDownPayment: totals.cardDownPayment,
          cardFeePercent: totals.cardFeePercent,
          cardFeeAmount: totals.cardFeeAmount,
          subtotal: totals.subtotal,
          costTotal: totals.costTotal,
          total: totals.total,
          notes: input.notes,
          customerNotes: input.customerNotes,
          lossReason: input.status === 'LOST' ? input.lossReason : null,
          sentAt: existing.sentAt || (['SENT', 'WAITING_APPROVAL'].includes(input.status) ? new Date() : null),
          approvedAt: input.status === 'APPROVED' ? (existing.approvedAt || new Date()) : null,
          lostAt: input.status === 'LOST' ? (existing.lostAt || new Date()) : null,
          items: { create: totals.items },
        },
        include: {
          client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
          items: { orderBy: { position: 'asc' } },
        },
      })

      const approvalTermsChanged = previousApprovalSnapshot !== buildQuoteApprovalSnapshot(updated)
      const hasApprovalState = existing.status === 'APPROVED' || existing.approvalRequests.length > 0
      const approvalReset = approvalTermsChanged && hasApprovalState

      if (approvalReset) {
        await tx.quoteApprovalRequest.updateMany({
          where: { quoteId: id, invalidatedAt: null },
          data: { invalidatedAt: new Date() },
        })
        updated = await tx.quote.update({
          where: { id },
          data: { status: 'DRAFT', approvedAt: null, sentAt: null, lostAt: null, lossReason: null },
          include: {
            client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
            items: { orderBy: { position: 'asc' } },
          },
        })
      }

      const latest = await tx.quoteRevision.findFirst({
        where: { quoteId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      await tx.quoteRevision.create({
        data: {
          quoteId: id,
          version: (latest?.version || 0) + 1,
          snapshot: buildQuoteSnapshot(updated),
        },
      })

      return { quote: updated, approvalReset }
    })

    return NextResponse.json({ ...serializeQuote(result.quote), approvalReset: result.approvalReset })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'Quote locked') {
      return badRequest('Este orçamento já foi vendido e não pode mais ser alterado.')
    }
    if (error instanceof Error && error.message === 'Invalid manual status') {
      return badRequest('A aprovação e a venda devem seguir o fluxo de aceite do cliente.')
    }
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:patch:${auth.user.id}:${id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await canAccessQuote(id, auth.user)
  if (!access.ok) return access.status === 404 ? NextResponse.json({ error: 'Not found' }, { status: 404 }) : forbidden()

  const currentQuote = await prisma.quote.findUnique({ where: { id }, select: { status: true, convertedProjectId: true } })
  if (currentQuote?.convertedProjectId || currentQuote?.status === 'SOLD') {
    return badRequest('Este orçamento já foi vendido e não pode mais ser alterado.')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  const parsed = quoteStatusSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')
  if (parsed.data.status === 'APPROVED' || parsed.data.status === 'SOLD') {
    return badRequest('A aprovação e a venda devem seguir o aceite do cliente e a confirmação do pagamento.')
  }

  const now = new Date()
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: parsed.data.status,
      lossReason: parsed.data.status === 'LOST' ? parsed.data.lossReason || null : null,
      sentAt: ['SENT', 'WAITING_APPROVAL'].includes(parsed.data.status) ? now : undefined,
      approvedAt: parsed.data.status === 'APPROVED' ? now : undefined,
      lostAt: parsed.data.status === 'LOST' ? now : null,
    },
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
      items: { orderBy: { position: 'asc' } },
    },
  })

  return NextResponse.json(serializeQuote(quote))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:delete:${auth.user.id}:${id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await canAccessQuote(id, auth.user)
  if (!access.ok) return access.status === 404 ? NextResponse.json({ error: 'Not found' }, { status: 404 }) : forbidden()

  const currentQuote = await prisma.quote.findUnique({ where: { id }, select: { status: true, convertedProjectId: true } })
  if (currentQuote?.convertedProjectId || currentQuote?.status === 'SOLD') {
    return badRequest('O orçamento vendido faz parte do histórico do projeto e não pode ser excluído.')
  }

  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
