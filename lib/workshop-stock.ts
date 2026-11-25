import type { Role } from '@/types'

export const workshopStockRoles: readonly Role[] = ['ADMIN', 'MANAGER']

export const workshopStockUnits = ['unidade', 'par', 'chapa', 'metro', 'm2'] as const
export const workshopStockItemTypes = ['HARDWARE', 'MDF_SHEET', 'MDF_OFFCUT', 'OTHER'] as const
export const workshopStockMovementKinds = ['PURCHASE', 'WITHDRAWAL', 'RETURN', 'LOSS', 'COUNT'] as const

export const workshopStockItemTypeLabels = {
  HARDWARE: 'Ferragens',
  MDF_SHEET: 'Chapas de MDF',
  MDF_OFFCUT: 'Retalhos de MDF',
  OTHER: 'Outros materiais',
} as const

export const workshopStockMovementLabels = {
  PURCHASE: 'Entrada de compra',
  WITHDRAWAL: 'Retirada',
  RETURN: 'Devolução ao estoque',
  LOSS: 'Perda',
  COUNT: 'Ajuste de contagem',
  REVERSAL: 'Estorno',
} as const

export type WorkshopStockUnit = (typeof workshopStockUnits)[number]
export type WorkshopStockItemType = (typeof workshopStockItemTypes)[number]
export type WorkshopStockMovementKind = (typeof workshopStockMovementKinds)[number]

export type WorkshopStockItemInput = {
  name: string
  unit: WorkshopStockUnit
  itemType: WorkshopStockItemType
  category?: string | null
  code?: string | null
  brand?: string | null
  location?: string | null
  finish?: string | null
  minimumStock?: number | null
  unitsPerPackage?: number | null
  thicknessMm?: number | null
  lengthMm?: number | null
  widthMm?: number | null
}

export type WorkshopStockItemView = Required<WorkshopStockItemInput> & {
  id: string
  active: boolean
  stockQuantity: number
}

export type WorkshopStockPurchaseLine = {
  itemId: string
  quantity: number
  packaged?: boolean
  expectedUnitsPerPackage?: number
}

type WorkshopStockMovementDetails = {
  supplier?: string | null
  reason?: string | null
  reference?: string | null
}

export type WorkshopStockMovementInput = WorkshopStockMovementDetails & (
  | (WorkshopStockPurchaseLine & {
      action: 'RECORD_MOVEMENT'
      kind: WorkshopStockMovementKind
      expectedStockQuantity?: number
    })
  | { action: 'RECORD_PURCHASE_BATCH'; lines: WorkshopStockPurchaseLine[] }
)

export type WorkshopStockMovementView = {
  id: string
  kind: WorkshopStockMovementKind | 'REVERSAL'
  quantity: number
  balanceAfter: number | null
  createdAt: string
  createdBy: string | null
  reference: string | null
  reason: string | null
  supplier: string | null
  reversalOfId: string | null
  reversed: boolean
}

const unitLabels = {
  unidade: ['unidade', 'unidades'],
  par: ['par', 'pares'],
  chapa: ['chapa', 'chapas'],
  metro: ['metro', 'metros'],
  m2: ['m²', 'm²'],
} satisfies Record<WorkshopStockUnit, [string, string]>

const quantityFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function workshopStockUnitLabel(unit: WorkshopStockUnit, amount = 1) {
  return unitLabels[unit][Math.abs(amount) === 1 ? 0 : 1]
}

export function formatWorkshopStockQuantity(quantity: number, unit?: WorkshopStockUnit) {
  const formatted = quantityFormat.format(quantity)
  return unit ? `${formatted} ${workshopStockUnitLabel(unit, quantity)}` : formatted
}

export function isCountedStockUnit(unit: string) {
  return unit === 'unidade' || unit === 'par' || unit === 'chapa'
}
