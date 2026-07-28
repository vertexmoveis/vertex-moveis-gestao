import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isLowStock, stockShortage } from '@/lib/inventory'
import { moneyValue, type NumericValue } from '@/lib/money'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import {
  badRequest,
  getClientIp,
  requireRole,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { ensureDefaultQuoteSettings } from '@/lib/quote-price-rules'

const inventorySchema = z.object({
  materialId: z.string().trim().min(1),
  stockQuantity: z.coerce.number().min(0, 'O saldo não pode ser negativo.').max(1_000_000),
  minimumStock: z.coerce.number().min(0, 'O estoque mínimo não pode ser negativo.').max(1_000_000),
  location: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().max(120).nullable().optional(),
  ),
}).strict()

const supplierPriceSchema = z.object({
  materialId: z.string().trim().min(1),
  supplier: z.string().trim().min(2, 'Informe o fornecedor.').max(120),
  unitCost: z.coerce.number().positive('Informe um custo maior que zero.').max(10_000_000),
  quotedAt: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().optional(),
  ),
  notes: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().max(500).nullable().optional(),
  ),
  applyAsDefault: z.boolean().default(true),
}).strict()

async function limit(req: NextRequest, userId: string) {
  return rateLimit(
    `api:inventory:${userId}:${getClientIp(req)}`,
    60,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

function serializeMaterial(material: {
  id: string
  name: string
  category: string | null
  defaultFinish: string | null
  unit: string
  unitCost: NumericValue
  supplier: string | null
  stockQuantity: number
  minimumStock: number
  location: string | null
  active: boolean
  updatedAt: Date
  supplierPrices: Array<{
    id: string
    supplier: string
    unitCost: NumericValue
    quotedAt: Date
    notes: string | null
  }>
}) {
  return {
    ...material,
    unitCost: moneyValue(material.unitCost),
    lowStock: isLowStock(material.stockQuantity, material.minimumStock),
    shortage: stockShortage(material.stockQuantity, material.minimumStock),
    updatedAt: material.updatedAt.toISOString(),
    supplierPrices: material.supplierPrices.map((price) => ({
      ...price,
      unitCost: moneyValue(price.unitCost),
      quotedAt: price.quotedAt.toISOString(),
    })),
  }
}

const inventoryInclude = {
  supplierPrices: {
    orderBy: { quotedAt: 'desc' as const },
    take: 8,
    select: {
      id: true,
      supplier: true,
      unitCost: true,
      quotedAt: true,
      notes: true,
    },
  },
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  await ensureDefaultQuoteSettings(prisma)

  const lowOnly = req.nextUrl.searchParams.get('low') === '1'
  const materials = await prisma.materialCatalogItem.findMany({
    where: {
      active: true,
      ...(lowOnly ? {
        minimumStock: { gt: 0 },
      } : {}),
    },
    include: inventoryInclude,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: 300,
  })

  const serialized = materials.map(serializeMaterial)
  return NextResponse.json(lowOnly ? serialized.filter((material) => material.lowStock) : serialized)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const limited = await limit(req, auth.user.id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = inventorySchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')

  try {
    const material = await prisma.materialCatalogItem.update({
      where: { id: parsed.data.materialId },
      data: {
        stockQuantity: parsed.data.stockQuantity,
        minimumStock: parsed.data.minimumStock,
        location: parsed.data.location || null,
      },
      include: inventoryInclude,
    })
    return NextResponse.json(serializeMaterial(material))
  } catch {
    return NextResponse.json({ error: 'Material não encontrado.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const limited = await limit(req, auth.user.id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = supplierPriceSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')

  const quotedAt = parsed.data.quotedAt ? new Date(`${parsed.data.quotedAt}T12:00:00.000Z`) : new Date()
  if (Number.isNaN(quotedAt.getTime())) return badRequest('Informe uma data válida.')

  try {
    const material = await prisma.$transaction(async (tx) => {
      await tx.materialSupplierPrice.create({
        data: {
          materialId: parsed.data.materialId,
          supplier: parsed.data.supplier,
          unitCost: parsed.data.unitCost,
          quotedAt,
          notes: parsed.data.notes || null,
        },
      })
      if (parsed.data.applyAsDefault) {
        await tx.materialCatalogItem.update({
          where: { id: parsed.data.materialId },
          data: {
            unitCost: parsed.data.unitCost,
            supplier: parsed.data.supplier,
          },
        })
      }
      return tx.materialCatalogItem.findUniqueOrThrow({
        where: { id: parsed.data.materialId },
        include: inventoryInclude,
      })
    })
    return NextResponse.json(serializeMaterial(material), { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar preço do fornecedor.', error)
    return serverError()
  }
}
