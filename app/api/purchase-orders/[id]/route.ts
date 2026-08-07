import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, requireRole } from '@/lib/security'
import { moneyValue } from '@/lib/money'

const ORDER_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const

const updateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  receipts: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.coerce.number().positive().max(1_000_000),
  }).strict()).max(200).optional(),
}).strict().refine((value) => value.status || (value.receipts && value.receipts.length > 0), {
  message: 'Informe a situação ou os materiais recebidos.',
})

async function syncProjectMaterial(tx: Prisma.TransactionClient, projectMaterialId: string) {
  const projectMaterial = await tx.projectMaterial.findUnique({
    where: { id: projectMaterialId },
    select: { id: true, estimatedQuantity: true },
  })
  if (!projectMaterial) return

  const orderedItems = await tx.purchaseOrderItem.findMany({
    where: { projectMaterialId, order: { status: { not: 'CANCELLED' } } },
    select: {
      quantity: true,
      receivedQuantity: true,
      unitCost: true,
      order: { select: { status: true, supplier: true, updatedAt: true } },
    },
    orderBy: { order: { updatedAt: 'desc' } },
  })
  const purchasedQuantity = orderedItems.reduce((sum, item) => sum + item.receivedQuantity, 0)
  const actualCost = orderedItems.reduce(
    (sum, item) => sum + item.receivedQuantity * moneyValue(item.unitCost),
    0,
  )
  const hasOutstandingOrder = orderedItems.some(
    (item) => ['DRAFT', 'SENT', 'PARTIAL'].includes(item.order.status)
      && item.receivedQuantity + 0.0001 < item.quantity,
  )
  const complete = projectMaterial.estimatedQuantity > 0
    && purchasedQuantity + 0.0001 >= projectMaterial.estimatedQuantity

  await tx.projectMaterial.update({
    where: { id: projectMaterialId },
    data: {
      purchasedQuantity,
      actualCost: purchasedQuantity > 0 ? actualCost : null,
      supplier: orderedItems.find((item) => item.receivedQuantity > 0)?.order.supplier || null,
      status: complete ? 'RECEIVED' : hasOutstandingOrder ? 'ORDERED' : 'PENDING',
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Situação do pedido inválida.')

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
    if (!order) return { error: 'Pedido não encontrado.', status: 404 as const }
    if (order.status === 'RECEIVED' && parsed.data.status && parsed.data.status !== 'RECEIVED') {
      return { error: 'Um pedido recebido não pode ser reaberto automaticamente.', status: 409 as const }
    }
    if (order.status === 'CANCELLED') {
      return { error: 'Um pedido cancelado não pode receber materiais.', status: 409 as const }
    }

    const receiptByItem = new Map<string, number>()
    for (const receipt of parsed.data.receipts || []) {
      receiptByItem.set(receipt.itemId, (receiptByItem.get(receipt.itemId) || 0) + receipt.quantity)
    }
    if (parsed.data.status === 'RECEIVED') {
      for (const item of order.items) {
        const remaining = Math.max(item.quantity - item.receivedQuantity, 0)
        if (remaining > 0) receiptByItem.set(item.id, remaining)
      }
    }

    const affectedProjectMaterials = new Set<string>()
    for (const [itemId, quantity] of receiptByItem) {
      const item = order.items.find((candidate) => candidate.id === itemId)
      if (!item) return { error: 'Um dos itens não pertence a este pedido.', status: 400 as const }
      const remaining = Math.max(item.quantity - item.receivedQuantity, 0)
      if (quantity > remaining + 0.0001) {
        return { error: `A quantidade recebida de um item ultrapassa o saldo de ${remaining.toLocaleString('pt-BR')}.`, status: 409 as const }
      }
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQuantity: { increment: quantity } },
      })
      await tx.materialCatalogItem.update({
        where: { id: item.materialId },
        data: { stockQuantity: { increment: quantity } },
      })
      if (item.projectMaterialId) affectedProjectMaterials.add(item.projectMaterialId)
    }

    const currentItems = await tx.purchaseOrderItem.findMany({ where: { orderId: id } })
    const receivedAny = currentItems.some((item) => item.receivedQuantity > 0)
    const receivedAll = currentItems.every((item) => item.receivedQuantity + 0.0001 >= item.quantity)
    const nextStatus = parsed.data.status === 'CANCELLED'
      ? 'CANCELLED'
      : receivedAll
        ? 'RECEIVED'
        : receivedAny
          ? 'PARTIAL'
          : parsed.data.status || order.status

    const updated = await tx.purchaseOrder.update({ where: { id }, data: { status: nextStatus } })
    for (const item of currentItems) {
      if (item.projectMaterialId) affectedProjectMaterials.add(item.projectMaterialId)
    }
    for (const projectMaterialId of affectedProjectMaterials) {
      await syncProjectMaterial(tx, projectMaterialId)
    }

    return { order: updated }
  })

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.order)
}
