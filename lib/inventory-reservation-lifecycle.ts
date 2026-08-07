import type { Prisma } from '@prisma/client'

export type InventoryReservationOutcome = 'CONSUMED' | 'RELEASED'

export async function settleInventoryReservations(
  tx: Prisma.TransactionClient,
  projectId: string,
  outcome: InventoryReservationOutcome,
) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { projectId, status: 'ACTIVE' },
    include: { material: { select: { stockQuantity: true } } },
  })

  for (const reservation of reservations) {
    if (outcome === 'CONSUMED') {
      await tx.materialCatalogItem.update({
        where: { id: reservation.materialId },
        data: { stockQuantity: Math.max(reservation.material.stockQuantity - reservation.quantity, 0) },
      })
    }
    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: { status: outcome },
    })
  }

  return reservations.length
}
