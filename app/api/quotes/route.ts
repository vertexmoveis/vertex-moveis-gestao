import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { quoteSaveSchema } from '@/lib/quote-schemas'
import {
  buildQuoteSnapshot,
  calculateQuoteTotals,
  serializeQuote,
} from '@/lib/quotes'
import { badRequest, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { ensureDefaultQuoteSettings, getActiveQuotePriceRules } from '@/lib/quote-price-rules'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:quotes:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const status = (searchParams.get('status') || '').trim()
  const expiredOnly = searchParams.get('expired') === '1'
  const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20, 10), 100)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const baseWhere: Prisma.QuoteWhereInput = auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }

  if (q) {
    baseWhere.OR = [
      { title: { contains: q } },
      { client: { name: { contains: q } } },
    ]
  }
  const listWhere: Prisma.QuoteWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
    ...(expiredOnly
      ? {
          status: { in: ['DRAFT', 'SENT', 'WAITING_APPROVAL', 'APPROVED'] },
          validUntil: { lt: today },
        }
      : {}),
  }

  const [quotes, total, totalCount, groupedStatuses, expiredCount] = await Promise.all([
    prisma.quote.findMany({
      where: listWhere,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
        items: { orderBy: { position: 'asc' } },
      },
    }),
    prisma.quote.count({ where: listWhere }),
    prisma.quote.count({ where: baseWhere }),
    prisma.quote.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.quote.count({
      where: {
        ...baseWhere,
        status: { in: ['DRAFT', 'SENT', 'WAITING_APPROVAL', 'APPROVED'] },
        validUntil: { lt: today },
      },
    }),
  ])

  const statusCounts = Object.fromEntries(groupedStatuses.map((item) => [item.status, item._count._all]))

  return NextResponse.json({
    items: quotes.map(serializeQuote),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
    totalCount,
    statusCounts,
    expiredCount,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:quotes:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

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

    const quote = await prisma.$transaction(async (tx) => {
      await ensureDefaultQuoteSettings(tx)
      const [priceRules, materials] = await Promise.all([
        getActiveQuotePriceRules(tx),
        tx.materialCatalogItem.findMany({ where: { active: true }, select: { name: true, unitCost: true, active: true } }),
      ])
      const totals = calculateQuoteTotals(input.items, { ...input, priceRules, materialCosts: materials })
      const created = await tx.quote.create({
        data: {
          clientId: input.clientId,
          createdById: auth.user.id,
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
          sentAt: ['SENT', 'WAITING_APPROVAL'].includes(input.status) ? new Date() : null,
          approvedAt: input.status === 'APPROVED' ? new Date() : null,
          lostAt: input.status === 'LOST' ? new Date() : null,
          items: {
            create: totals.items,
          },
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

      return created
    })

    return NextResponse.json(serializeQuote(quote))
  } catch {
    return serverError()
  }
}
