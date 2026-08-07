import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { moneyValue } from '@/lib/money'
import { badRequest, requireRole } from '@/lib/security'

const createSchema = z.object({
  supplier: z.string().trim().min(2).max(120),
  expectedAt: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({
    materialId: z.string().min(1),
    projectId: z.string().min(1).nullable().optional(),
    projectMaterialId: z.string().min(1).nullable().optional(),
    quantity: z.coerce.number().positive().max(1_000_000),
    unitCost: z.coerce.number().min(0).max(10_000_000),
  }).strict()).min(1).max(200),
}).strict()

const include = {
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, name: true, unit: true } },
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
}

function serialize(order: Awaited<ReturnType<typeof prisma.purchaseOrder.findFirst>> & { items?: Array<{ unitCost: unknown }> }) {
  if (!order) return order
  return {
    ...order,
    items: order.items?.map((item) => ({ ...item, unitCost: moneyValue(item.unitCost as never) })) || [],
  }
}

export async function GET() {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const orders = await prisma.purchaseOrder.findMany({ include, orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(orders.map((order) => serialize(order as never)))
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Pedido inválido.')
  const materialIds = [...new Set(parsed.data.items.map((item) => item.materialId))]
  const materials = await prisma.materialCatalogItem.count({ where: { id: { in: materialIds }, active: true } })
  if (materials !== materialIds.length) return badRequest('Um dos materiais não está disponível no catálogo.')
  const projectMaterialIds = [...new Set(parsed.data.items.map((item) => item.projectMaterialId).filter((value): value is string => Boolean(value)))]
  if (projectMaterialIds.length > 0) {
    const projectMaterials = await prisma.projectMaterial.findMany({
      where: { id: { in: projectMaterialIds } },
      select: { id: true, projectId: true, materialId: true },
    })
    const validProjectMaterials = new Map(projectMaterials.map((item) => [item.id, item]))
    const invalidLink = parsed.data.items.some((item) => {
      if (!item.projectMaterialId) return false
      const linked = validProjectMaterials.get(item.projectMaterialId)
      return !linked || linked.projectId !== item.projectId || linked.materialId !== item.materialId
    })
    if (invalidLink) return badRequest('Um dos materiais não pertence ao projeto informado.')
  }
  const expectedAt = parsed.data.expectedAt ? new Date(`${parsed.data.expectedAt}T12:00:00.000Z`) : null
  if (expectedAt && Number.isNaN(expectedAt.getTime())) return badRequest('Data prevista inválida.')

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        supplier: parsed.data.supplier,
        expectedAt,
        notes: parsed.data.notes || null,
        createdById: auth.user.id,
        items: { create: parsed.data.items.map((item) => ({
          ...item,
          projectId: item.projectId || null,
          projectMaterialId: item.projectMaterialId || null,
        })) },
      },
      include,
    })
    if (projectMaterialIds.length > 0) {
      await tx.projectMaterial.updateMany({
        where: { id: { in: projectMaterialIds }, status: 'PENDING' },
        data: { status: 'ORDERED' },
      })
    }
    return created
  })
  return NextResponse.json(serialize(order as never), { status: 201 })
}
