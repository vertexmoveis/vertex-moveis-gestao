import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PurchasesBoard, type PurchaseMaterial } from '@/components/purchases/purchases-board'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

const PURCHASE_LIMIT = 160

export default async function PurchasesPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; name?: string } | undefined
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const materials = await prisma.projectMaterial.findMany({
    where: {
      status: { in: ['PENDING', 'ORDERED'] },
      project: { stage: { not: 'COMPLETED' } },
    },
    include: {
      project: { select: { id: true, name: true, room: true, client: { select: { name: true } } } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: PURCHASE_LIMIT + 1,
  })

  const limited = materials.length > PURCHASE_LIMIT
  const initialMaterials: PurchaseMaterial[] = materials.slice(0, PURCHASE_LIMIT).flatMap((material) => (
    material.unit === 'm2' || material.unit === 'metro' || material.unit === 'unidade'
      ? [{
          id: material.id,
          projectId: material.projectId,
          materialId: material.materialId,
          materialName: material.materialName,
          finish: material.finish,
          unit: material.unit,
          estimatedQuantity: material.estimatedQuantity,
          purchasedQuantity: material.purchasedQuantity,
          estimatedCost: material.estimatedCost,
          actualCost: material.actualCost,
          supplier: material.supplier,
          status: material.status === 'ORDERED' ? 'ORDERED' : 'PENDING',
          notes: material.notes,
          project: material.project,
        }]
      : []
  ))

  return (
    <div className="flex h-full flex-col">
      <Header title="Compras" subtitle="Materiais que faltam comprar, pedidos em aberto e custo real" userName={user?.name || ''} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <PurchasesBoard initialMaterials={initialMaterials} limited={limited} />
      </div>
    </div>
  )
}
