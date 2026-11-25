import { createHash, randomUUID } from 'node:crypto'
import { Prisma, type WorkshopStockItem } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  isCountedStockUnit,
  type WorkshopStockItemView,
  type WorkshopStockMovementView,
} from '@/lib/workshop-stock'

export const workshopStockMaximum = 99_999_999_999.999

export class WorkshopStockError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type MovementLine = {
  itemId: string
  kind: Exclude<WorkshopStockMovementView['kind'], 'REVERSAL'>
  quantity: number
  packaged?: boolean
  expectedStockQuantity?: number
  expectedUnitsPerPackage?: number
}

type StockOperation = {
  requestId: string
  mode: 'legacy' | 'single' | 'batch'
  lines: MovementLine[]
  reference?: string | null
  reason?: string | null
  supplier?: string | null
} | {
  requestId: string
  mode: 'reverse'
  movementId: string
  reason: string
}

export function serializeWorkshopStockItem(item: WorkshopStockItem): WorkshopStockItemView {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit as WorkshopStockItemView['unit'],
    stockQuantity: item.stockQuantity.toNumber(),
    itemType: item.itemType as WorkshopStockItemView['itemType'],
    code: item.code,
    brand: item.brand,
    location: item.location,
    finish: item.finish,
    minimumStock: item.minimumStock?.toNumber() ?? null,
    unitsPerPackage: item.unitsPerPackage?.toNumber() ?? null,
    thicknessMm: item.thicknessMm?.toNumber() ?? null,
    lengthMm: item.lengthMm,
    widthMm: item.widthMm,
    active: item.active,
  }
}

function getOperationFingerprint(operation: StockOperation, userId: string) {
  const data = operation.mode === 'reverse'
    ? [operation.mode, operation.movementId, operation.reason]
    : [
        operation.mode,
        operation.lines.toSorted((left, right) => left.itemId.localeCompare(right.itemId))
          .map((line) => [
            line.itemId, line.kind, line.quantity, Boolean(line.packaged),
            line.expectedStockQuantity ?? null, line.expectedUnitsPerPackage ?? null,
          ]),
        operation.reference || null,
        operation.reason || null,
        operation.supplier || null,
      ]
  return createHash('sha256').update(JSON.stringify([userId, data])).digest('hex')
}

function calculateDelta(line: MovementLine, item: WorkshopStockItem) {
  let quantity = new Prisma.Decimal(line.quantity)
  if (line.kind === 'COUNT' && line.expectedStockQuantity !== undefined && !item.stockQuantity.equals(line.expectedStockQuantity)) {
    throw new WorkshopStockError(`O saldo de ${item.name} mudou. Confira a contagem e confirme de novo.`, 409)
  }
  if (line.packaged) {
    if (line.expectedUnitsPerPackage !== undefined && !item.unitsPerPackage?.equals(line.expectedUnitsPerPackage)) {
      throw new WorkshopStockError(`A quantidade por caixa de ${item.name} mudou. Confira a conversão e confirme de novo.`, 409)
    }
    if (line.kind !== 'PURCHASE' || item.unitsPerPackage === null) {
      throw new WorkshopStockError(`Configure a embalagem de ${item.name} para registrar a compra em caixas.`, 400)
    }
    if (!quantity.isInteger()) throw new WorkshopStockError(`Informe um número inteiro de caixas para ${item.name}.`, 400)
    quantity = quantity.mul(item.unitsPerPackage)
  }
  if (quantity.greaterThan(workshopStockMaximum) || quantity.decimalPlaces() > 3) {
    throw new WorkshopStockError(`A quantidade de ${item.name} ultrapassa a precisão ou o limite do estoque.`, 400)
  }
  if (isCountedStockUnit(item.unit) && !quantity.isInteger()) {
    throw new WorkshopStockError(`Informe uma quantidade inteira para ${item.name}.`, 400)
  }
  switch (line.kind) {
    case 'COUNT':
      return quantity.minus(item.stockQuantity)
    case 'LOSS':
    case 'WITHDRAWAL':
      return quantity.negated()
    default:
      return quantity
  }
}

export async function applyWorkshopStockOperation(operation: StockOperation, userId: string) {
  const fingerprint = getOperationFingerprint(operation, userId)
  return await prisma.$transaction(async (tx) => {
    const legacyReceipt = await tx.workshopStockReceipt.findUnique({ where: { id: operation.requestId } })
    if (legacyReceipt && !legacyReceipt.operationId) {
      const line = operation.mode === 'legacy' ? operation.lines[0] : undefined
      if (!line || legacyReceipt.kind !== 'PURCHASE' || legacyReceipt.itemId !== line.itemId ||
        !legacyReceipt.quantity.equals(line.quantity) || legacyReceipt.createdById !== userId) {
        throw new WorkshopStockError('Esta entrada já foi registrada com outros dados.', 409)
      }
      const item = await tx.workshopStockItem.findUniqueOrThrow({ where: { id: line.itemId } })
      return { items: [item], recorded: false }
    }

    const claim = await tx.workshopStockOperation.createMany({
      data: { id: operation.requestId, fingerprint },
      skipDuplicates: true,
    })
    if (claim.count === 0) {
      const previous = await tx.workshopStockOperation.findUniqueOrThrow({ where: { id: operation.requestId } })
      if (previous.fingerprint !== fingerprint) {
        throw new WorkshopStockError('Este lançamento já foi registrado com outros dados.', 409)
      }
      const items = await tx.workshopStockItem.findMany({
        where: { receipts: { some: { operationId: operation.requestId } } },
      })
      return { items, recorded: false }
    }

    const original = operation.mode === 'reverse'
      ? await tx.workshopStockReceipt.findUnique({ where: { id: operation.movementId } })
      : null
    if (operation.mode === 'reverse' && !original) {
      throw new WorkshopStockError('Movimento não encontrado.', 404)
    }

    const itemIds = operation.mode === 'reverse' ? [original!.itemId] : operation.lines.map((line) => line.itemId)
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "WorkshopStockItem"
      WHERE "id" IN (${Prisma.join(itemIds)})
      ORDER BY "id"
      FOR UPDATE
    `
    if (locked.length !== itemIds.length) {
      throw new WorkshopStockError('Material não encontrado.', 404)
    }
    const items = await tx.workshopStockItem.findMany({ where: { id: { in: itemIds } } })
    const latestByItem = await tx.$queryRaw<{ itemId: string; createdAt: Date }[]>`
      SELECT "itemId", MAX("createdAt") AS "createdAt"
      FROM "WorkshopStockReceipt"
      WHERE "itemId" IN (${Prisma.join(itemIds)})
      GROUP BY "itemId"
    `
    const latestDate = new Map(latestByItem.map((history) => [history.itemId, history.createdAt.getTime()]))
    const itemById = new Map(items.map((item) => [item.id, item]))
    const lines = operation.mode === 'reverse' ? [] : operation.lines
    const lineByItem = new Map(lines.map((line) => [line.itemId, line]))
    const movements: Prisma.WorkshopStockReceiptCreateManyInput[] = []
    const updated: WorkshopStockItem[] = []

    if (original && (
      original.kind === 'REVERSAL'
      || await tx.workshopStockReceipt.findUnique({ where: { reversalOfId: original.id }, select: { id: true } })
    )) {
      throw new WorkshopStockError('Este movimento já foi estornado ou é um estorno.', 409)
    }

    for (const id of itemIds) {
      const item = itemById.get(id)!
      if (!item.active) throw new WorkshopStockError(`Reative ${item.name} para movimentar seu saldo.`, 409)

      const line = lineByItem.get(id)
      const delta = original ? original.quantity.negated() : calculateDelta(line!, item)
      const balance = item.stockQuantity.add(delta)
      if (balance.isNegative()) {
        throw new WorkshopStockError(`Saldo insuficiente para ${item.name}.`, 409)
      }
      if (balance.greaterThan(workshopStockMaximum)) {
        throw new WorkshopStockError(`O saldo de ${item.name} ultrapassaria o limite suportado.`, 409)
      }

      updated.push(await tx.workshopStockItem.update({ where: { id }, data: { stockQuantity: balance } }))
      movements.push({
        id: operation.mode === 'legacy' ? operation.requestId : randomUUID(),
        itemId: id,
        operationId: operation.requestId,
        kind: original ? 'REVERSAL' : line!.kind,
        quantity: delta,
        balanceAfter: balance,
        reason: operation.reason || null,
        reference: (operation.mode === 'reverse' ? original!.reference : operation.reference) || null,
        supplier: (operation.mode === 'reverse' ? original!.supplier : operation.supplier) || null,
        reversalOfId: original?.id ?? null,
        createdById: userId,
        createdAt: new Date(Math.max(Date.now(), (latestDate.get(id) ?? 0) + 1)),
      })
    }

    await tx.workshopStockReceipt.createMany({ data: movements })
    return { items: updated, recorded: true }
  }, { timeout: 20_000 })
}

const historyPageSize = 50

export async function readWorkshopStockMovements(itemId: string, cursor?: string) {
  const [item, before] = await Promise.all([
    prisma.workshopStockItem.findUnique({ where: { id: itemId }, select: { id: true } }),
    cursor ? prisma.workshopStockReceipt.findFirst({ where: { id: cursor, itemId }, select: { id: true } }) : null,
  ])
  if (!item) throw new WorkshopStockError('Material não encontrado.', 404)
  if (cursor && !before) throw new WorkshopStockError('Movimento inválido para este material.', 400)

  const page = await prisma.workshopStockReceipt.findMany({
    where: { itemId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(before ? { cursor: before, skip: 1 } : {}),
    take: historyPageSize + 1,
    include: { createdBy: { select: { name: true } } },
  })
  const visible = page.slice(0, historyPageSize)
  const reversals = visible.length > 0 ? await prisma.workshopStockReceipt.findMany({
    where: { reversalOfId: { in: visible.map((movement) => movement.id) } },
    select: { reversalOfId: true },
  }) : []
  const reversed = new Set(reversals.map((movement) => movement.reversalOfId))
  const movements: WorkshopStockMovementView[] = visible.map((movement) => ({
    id: movement.id,
    kind: movement.kind as WorkshopStockMovementView['kind'],
    quantity: movement.quantity.toNumber(),
    balanceAfter: movement.balanceAfter?.toNumber() ?? null,
    createdAt: movement.createdAt.toISOString(),
    createdBy: movement.createdBy?.name ?? null,
    reference: movement.reference,
    reason: movement.reason,
    supplier: movement.supplier,
    reversalOfId: movement.reversalOfId,
    reversed: reversed.has(movement.id),
  }))
  return { movements, nextCursor: page.length > historyPageSize ? visible.at(-1)!.id : null }
}
