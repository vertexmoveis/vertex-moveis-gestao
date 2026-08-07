import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import type { PurchaseMaterial } from '@/components/purchases/purchases-board'
import { PurchasesWorkspace } from '@/components/purchases/purchases-workspace'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { moneyValue } from '@/lib/money'

const PURCHASE_LIMIT = 160

export default async function PurchasesPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; name?: string } | undefined
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const materials = await prisma.projectMaterial.findMany({
    where: {
      status: { in: ['PENDING', 'ORDERED'] },
      project: { archivedAt: null, stage: { not: 'COMPLETED' } },
    },
    include: {
      project: { select: { id: true, name: true, room: true, client: { select: { name: true } } } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: PURCHASE_LIMIT + 1,
  })
  const projectIds = [...new Set(materials.map((material) => material.projectId))]
  const materialIds = [...new Set(materials.flatMap((material) => material.materialId ? [material.materialId] : []))]
  const reservations = projectIds.length > 0 && materialIds.length > 0
    ? await prisma.inventoryReservation.findMany({
        where: {
          status: 'ACTIVE',
          projectId: { in: projectIds },
          materialId: { in: materialIds },
        },
        select: { projectId: true, materialId: true, quantity: true },
      })
    : []

  const limited = materials.length > PURCHASE_LIMIT
  const reservationBalance = new Map(reservations.map((reservation) => [
    `${reservation.projectId}:${reservation.materialId}`,
    reservation.quantity,
  ]))
  const initialMaterials: PurchaseMaterial[] = materials.slice(0, PURCHASE_LIMIT).flatMap((material) => {
    if (material.unit !== 'm2' && material.unit !== 'metro' && material.unit !== 'unidade') return []
    const reservationKey = material.materialId ? `${material.projectId}:${material.materialId}` : ''
    const reservedAvailable = reservationKey ? reservationBalance.get(reservationKey) || 0 : 0
    const requiredAfterPurchase = Math.max(material.estimatedQuantity - material.purchasedQuantity, 0)
    const reservedQuantity = Math.min(requiredAfterPurchase, reservedAvailable)
    if (reservationKey) reservationBalance.set(reservationKey, Math.max(reservedAvailable - reservedQuantity, 0))
    if (requiredAfterPurchase - reservedQuantity <= 0.0001) return []

    return [{
          id: material.id,
          projectId: material.projectId,
          materialId: material.materialId,
          materialName: material.materialName,
          finish: material.finish,
          unit: material.unit,
          estimatedQuantity: material.estimatedQuantity,
          purchasedQuantity: material.purchasedQuantity,
          reservedQuantity,
          estimatedCost: moneyValue(material.estimatedCost),
          actualCost: moneyValue(material.actualCost),
          supplier: material.supplier,
          status: material.status === 'ORDERED' ? 'ORDERED' : 'PENDING',
          notes: material.notes,
          project: material.project,
        }]
  })

  return (
    <div className="flex h-full flex-col">
      <Header title="Compras" subtitle="Materiais que faltam comprar, pedidos em aberto e custo real" userName={user?.name || ''} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <PurchasesWorkspace initialMaterials={initialMaterials} limited={limited} />
      </div>
    </div>
  )
}
