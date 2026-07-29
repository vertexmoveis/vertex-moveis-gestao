import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { buildQuoteSnapshot, calculateQuoteTotals, parseQuoteAccessories, serializeQuote } from '@/lib/quotes'
import { ensureDefaultQuoteSettings, getActiveQuotePriceRules } from '@/lib/quote-price-rules'
import {
  QUOTE_VARIATION_TYPES,
  quoteVariationDefaultName,
  quoteVariationPriceProfile,
} from '@/lib/quote-variations'
import { badRequest, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { syncClientRelationshipStage } from '@/lib/client-relationship'

const variationSchema = z.object({
  type: z.enum(QUOTE_VARIATION_TYPES),
  name: z.string().trim().min(1).max(80).optional(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:variant:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = variationSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Variação inválida.')

  try {
    const created = await prisma.$transaction(async (tx) => {
      await ensureDefaultQuoteSettings(tx)
      const source = await tx.quote.findFirst({
        where: { id, archivedAt: null },
        include: {
          items: { orderBy: { position: 'asc' } },
          group: {
            include: {
              quotes: {
                where: { archivedAt: null },
                select: {
                  id: true,
                  variationName: true,
                  variationOrder: true,
                  status: true,
                  convertedProjectId: true,
                },
              },
            },
          },
        },
      })
      if (!source) throw new Error('NOT_FOUND')
      if (auth.user.role !== 'ADMIN' && source.createdById !== auth.user.id) throw new Error('FORBIDDEN')
      if (source.group.quotes.length >= 3) throw new Error('LIMIT')
      if (source.group.quotes.some((quote) => quote.convertedProjectId || ['APPROVED', 'SOLD'].includes(quote.status))) {
        throw new Error('LOCKED')
      }

      const variationName = parsed.data.name || quoteVariationDefaultName(parsed.data.type)
      if (source.group.quotes.some((quote) => quote.variationName.toLocaleLowerCase('pt-BR') === variationName.toLocaleLowerCase('pt-BR'))) {
        throw new Error('DUPLICATE')
      }

      const [priceRules, materials] = await Promise.all([
        getActiveQuotePriceRules(tx),
        tx.materialCatalogItem.findMany({ where: { active: true }, select: { name: true, unitCost: true, active: true } }),
      ])
      const profile = quoteVariationPriceProfile(parsed.data.type)
      const items = source.items.map((item) => ({
        environment: item.environment,
        environmentName: item.environmentName,
        description: item.description,
        furnitureType: item.furnitureType,
        furnitureModel: item.furnitureModel,
        placement: item.placement,
        sourceItemKey: item.sourceItemKey,
        material: item.material,
        finish: item.finish,
        width: item.width,
        height: item.height,
        depth: item.depth,
        difficulty: item.difficulty,
        calculationMode: item.calculationMode,
        priceProfile: profile || item.priceProfile,
        manualPrice: item.manualPrice == null ? null : Number(item.manualPrice),
        accessories: parseQuoteAccessories(item.accessories),
        quantity: item.quantity,
        notes: item.notes,
      }))
      const totals = calculateQuoteTotals(items, {
        pricePerM2: Number(source.pricePerM2),
        materialCostPerM2: Number(source.materialCostPerM2),
        installationFee: Number(source.installationFee),
        marginPercent: source.marginPercent,
        discount: Number(source.manualDiscount),
        paymentMethod: source.paymentMethod,
        cardInstallments: source.cardInstallments,
        cardDownPayment: Number(source.cardDownPayment),
        cardFeePercent: source.cardFeePercent,
        priceRules,
        materialCosts: materials,
      })
      const variationOrder = Math.max(...source.group.quotes.map((quote) => quote.variationOrder), -1) + 1

      const quote = await tx.quote.create({
        data: {
          groupId: source.groupId,
          clientId: source.clientId,
          createdById: source.createdById,
          title: source.title,
          variationType: parsed.data.type,
          variationName,
          variationOrder,
          status: 'DRAFT',
          validUntil: source.validUntil,
          deliveryBusinessDays: source.deliveryBusinessDays,
          firstInstallmentDate: source.firstInstallmentDate,
          pricePerM2: source.pricePerM2,
          materialCostPerM2: source.materialCostPerM2,
          installationFee: source.installationFee,
          marginPercent: source.marginPercent,
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
          notes: source.notes,
          customerNotes: source.customerNotes,
          items: { create: totals.items },
        },
        include: {
          client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
          items: { orderBy: { position: 'asc' } },
        },
      })
      await tx.quoteRevision.create({
        data: {
          quoteId: quote.id,
          version: 1,
          snapshot: buildQuoteSnapshot(quote),
        },
      })
      await tx.quoteGroup.update({ where: { id: source.groupId }, data: { updatedAt: new Date() } })
      await syncClientRelationshipStage(tx, source.clientId, { activityAt: new Date() })
      return quote
    })

    return NextResponse.json(serializeQuote(created))
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbidden()
    if (error instanceof Error && error.message === 'LIMIT') return badRequest('Este orçamento já possui três variações.')
    if (error instanceof Error && error.message === 'LOCKED') {
      return badRequest('Não é possível criar uma variação depois da aprovação ou venda.')
    }
    if (error instanceof Error && error.message === 'DUPLICATE') {
      return badRequest('Já existe uma variação com esse nome.')
    }
    return serverError()
  }
}
