import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { quoteSaveSchema } from '@/lib/quote-schemas'
import {
  buildQuoteSnapshot,
  calculateQuoteTotals,
  serializeQuote,
} from '@/lib/quotes'
import { badRequest, forbidden, getClientIp, requireAuth, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { ensureDefaultQuoteSettings, getActiveQuotePriceRules } from '@/lib/quote-price-rules'
import {
  normalizeQuoteVariations,
  quoteVariationPriceProfile,
} from '@/lib/quote-variations'
import {
  getQuoteGroupList,
  QUOTE_GROUP_STATUS_PRIORITY,
  type QuoteGroupStatus,
} from '@/lib/quote-group-list'
import { dateOnlyKeyInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { clientWhereForUser } from '@/lib/client-access'
import { syncClientRelationshipStage } from '@/lib/client-relationship'

function resolveGroupStatus(quotes: Array<{ status: string }>) {
  return QUOTE_GROUP_STATUS_PRIORITY.find((status) => quotes.some((quote) => quote.status === status))
    || quotes[0]?.status
    || 'DRAFT'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:quotes:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const requestedStatus = (searchParams.get('status') || '').trim().toUpperCase()
  const status = QUOTE_GROUP_STATUS_PRIORITY.includes(requestedStatus as QuoteGroupStatus)
    ? requestedStatus as QuoteGroupStatus
    : null
  const expiredOnly = searchParams.get('expired') === '1'
  const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20, 10), 100)
  const today = startOfDateInTimeZone(dateOnlyKeyInTimeZone(new Date())) || new Date()

  const groupList = await getQuoteGroupList({
    userId: auth.user.id,
    isAdmin: auth.user.role === 'ADMIN',
    query: q,
    status,
    expiredOnly,
    page,
    pageSize,
    today,
  })
  const pageGroupIds = groupList.groupIds
  const groups = pageGroupIds.length > 0
    ? await prisma.quoteGroup.findMany({
      where: { id: { in: pageGroupIds } },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
        quotes: {
          where: { archivedAt: null },
          orderBy: [{ variationOrder: 'asc' }, { number: 'asc' }],
          include: {
            client: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
            items: { orderBy: { position: 'asc' } },
          },
        },
      },
    })
    : []
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const orderedGroups = pageGroupIds
    .map((groupId) => groupById.get(groupId))
    .filter((group): group is (typeof groups)[number] => Boolean(group))
  const items = orderedGroups.flatMap((group) => {
    const groupStatus = resolveGroupStatus(group.quotes)
    const representative = group.quotes.find((quote) => quote.status === groupStatus) || group.quotes[0]
    if (!representative) return []
    return [{
      ...serializeQuote(representative),
      groupId: group.id,
      variants: group.quotes.map((variant) => ({
        id: variant.id,
        number: variant.number,
        variationType: variant.variationType,
        variationName: variant.variationName,
        total: Number(variant.total),
        costTotal: Number(variant.costTotal),
        profit: Number(variant.total) - Number(variant.costTotal),
        status: variant.status,
      })),
    }]
  })

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total: groupList.total,
      totalPages: Math.max(Math.ceil(groupList.total / pageSize), 1),
    },
    totalCount: groupList.totalCount,
    statusCounts: groupList.statusCounts,
    expiredCount: groupList.expiredCount,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:quotes:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  const parsed = quoteSaveSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const message = issue?.message === 'Invalid input'
      ? 'Confira os campos do orçamento e tente novamente.'
      : issue?.message || 'Dados inválidos'
    return badRequest(message)
  }

  try {
    const input = parsed.data
    const client = await prisma.client.findFirst({
      where: clientWhereForUser(auth.user, { id: input.clientId }),
      select: { id: true },
    })
    if (!client) return forbidden()

    if (input.status === 'APPROVED' || input.status === 'SOLD') {
      return badRequest('A aprovação e a venda devem seguir o fluxo de aceite do cliente.')
    }

    const result = await prisma.$transaction(async (tx) => {
      await ensureDefaultQuoteSettings(tx)
      const [priceRules, materials] = await Promise.all([
        getActiveQuotePriceRules(tx),
        tx.materialCatalogItem.findMany({ where: { active: true }, select: { name: true, unitCost: true, active: true } }),
      ])
      const variations = normalizeQuoteVariations(
        input.variations || [{ type: input.variationType, name: input.variationName }],
      )
      const sourceItems = input.items.map((item) => ({
        ...item,
        sourceItemKey: item.sourceItemKey || randomUUID(),
      }))
      const group = await tx.quoteGroup.create({
        data: {
          clientId: input.clientId,
          createdById: auth.user.id,
          title: input.title,
        },
      })
      const createdQuotes = []

      for (const [variationOrder, variation] of variations.entries()) {
        const profile = quoteVariationPriceProfile(variation.type)
        const variationItems = sourceItems.map((item) => ({
          ...item,
          priceProfile: profile || item.priceProfile,
        }))
        const totals = calculateQuoteTotals(variationItems, { ...input, priceRules, materialCosts: materials })
        const created = await tx.quote.create({
          data: {
            groupId: group.id,
            clientId: input.clientId,
            createdById: auth.user.id,
            title: input.title,
            variationType: variation.type,
            variationName: variation.name,
            variationOrder,
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
            sentAt: ['SENT', 'WAITING_APPROVAL'].includes(input.status) ? new Date() : null,
            approvedAt: input.status === 'APPROVED' ? new Date() : null,
            lostAt: input.status === 'LOST' ? new Date() : null,
            items: { create: totals.items },
          },
          include: {
            client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
            items: { orderBy: { position: 'asc' } },
          },
        })

        await tx.quoteRevision.create({
          data: {
            quoteId: created.id,
            version: 1,
            snapshot: buildQuoteSnapshot(created),
          },
        })
        createdQuotes.push(created)
      }

      await syncClientRelationshipStage(tx, input.clientId, { activityAt: new Date() })
      return { primary: createdQuotes[0], variants: createdQuotes }
    })

    return NextResponse.json({
      ...serializeQuote(result.primary),
      variants: result.variants.map((quote) => ({
        id: quote.id,
        number: quote.number,
        variationType: quote.variationType,
        variationName: quote.variationName,
        status: quote.status,
        total: Number(quote.total),
      })),
    })
  } catch {
    return serverError()
  }
}
