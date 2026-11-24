import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type WorkshopStockItem } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { badRequest, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import {
  isCountedStockUnit,
  workshopStockRoles,
  workshopStockUnits,
  type WorkshopStockItemView,
  type WorkshopStockUnit,
} from '@/lib/workshop-stock'

const stockActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('CREATE_ITEM'),
    name: z.string().trim().min(2, 'Informe o nome do item.').max(120),
    category: z.string().trim().max(80).nullish(),
    unit: z.enum(workshopStockUnits),
  }).strict(),
  z.object({
    action: z.literal('RECORD_PURCHASE'),
    requestId: z.uuid(),
    itemId: z.string().trim().min(1).max(80),
    quantity: z.number()
      .min(0.001, 'Informe uma quantidade de pelo menos 0,001.')
      .max(1_000_000, 'Informe uma quantidade de até 1.000.000.')
      .refine((quantity) => new Prisma.Decimal(quantity).decimalPlaces() <= 3, 'Informe até três casas decimais.'),
  }).strict(),
])

function serializeItem(item: WorkshopStockItem): WorkshopStockItemView {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit as WorkshopStockUnit,
    stockQuantity: item.stockQuantity.toNumber(),
  }
}

export async function GET() {
  const auth = await requireRole([...workshopStockRoles])
  if (!auth.ok) return auth.response

  try {
    const items = await prisma.workshopStockItem.findMany({ orderBy: [{ name: 'asc' }, { unit: 'asc' }] })
    return NextResponse.json({ items: items.map(serializeItem) })
  } catch (error) {
    console.error('Erro ao consultar o estoque da marcenaria.', error)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...workshopStockRoles])
  if (!auth.ok) return auth.response

  try {
    const limit = await rateLimit(`api:workshop-stock:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000)
    if (!limit.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })

    const parsed = stockActionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
    const input = parsed.data

    if (input.action === 'CREATE_ITEM') {
      const item = await prisma.workshopStockItem.create({
        data: { name: input.name, category: input.category || null, unit: input.unit },
      })
      return NextResponse.json({ item: serializeItem(item) }, { status: 201 })
    }

    const quantity = new Prisma.Decimal(input.quantity)
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.workshopStockItem.findUnique({ where: { id: input.itemId } })
      if (!item) return { error: 'Item não encontrado.', status: 404 } as const
      if (isCountedStockUnit(item.unit) && !quantity.isInteger()) {
        return { error: 'Informe uma quantidade inteira para este item.', status: 400 } as const
      }

      const { count } = await tx.workshopStockReceipt.createMany({
        data: { id: input.requestId, itemId: item.id, quantity, createdById: auth.user.id },
        skipDuplicates: true,
      })
      if (count === 0) {
        const receipt = await tx.workshopStockReceipt.findUniqueOrThrow({ where: { id: input.requestId } })
        if (receipt.itemId !== item.id || !receipt.quantity.equals(quantity) || receipt.createdById !== auth.user.id) {
          return { error: 'Esta entrada já foi registrada com outros dados.', status: 409 } as const
        }
        const current = await tx.workshopStockItem.findUniqueOrThrow({ where: { id: item.id } })
        return { item: current, status: 200 } as const
      }

      const updated = await tx.workshopStockItem.update({
        where: { id: item.id },
        data: { stockQuantity: { increment: quantity } },
      })
      return { item: updated, status: 201 } as const
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ item: serializeItem(result.item) }, { status: result.status })
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return serviceUnavailable()
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'Já existe um item com este nome e unidade.' }, { status: 409 })
      if (error.code === 'P2020') return NextResponse.json({ error: 'A entrada ultrapassa o saldo máximo suportado.' }, { status: 409 })
    }
    console.error('Erro ao atualizar o estoque da marcenaria.', error)
    return serverError()
  }
}
