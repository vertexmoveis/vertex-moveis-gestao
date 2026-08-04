import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, requireRole } from '@/lib/security'

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED']),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Situação do pedido inválida.')
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status === 'RECEIVED' && parsed.data.status !== 'RECEIVED') {
    return NextResponse.json({ error: 'Um pedido recebido não pode ser reaberto automaticamente.' }, { status: 409 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.status === 'RECEIVED' && order.status !== 'RECEIVED') {
      for (const item of order.items) {
        await tx.materialCatalogItem.update({ where: { id: item.materialId }, data: { stockQuantity: { increment: item.quantity } } })
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: item.quantity } })
        if (item.projectId) {
          await tx.projectMaterial.updateMany({
            where: { projectId: item.projectId, materialId: item.materialId, status: { in: ['PENDING', 'ORDERED'] } },
            data: { status: 'RECEIVED', purchasedQuantity: item.quantity, actualCost: Number(item.unitCost) * item.quantity },
          })
        }
      }
    }
    return tx.purchaseOrder.update({ where: { id }, data: { status: parsed.data.status } })
  })
  return NextResponse.json(updated)
}
