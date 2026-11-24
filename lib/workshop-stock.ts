import type { Role } from '@/types'

export const workshopStockRoles: readonly Role[] = ['ADMIN', 'MANAGER']

export const workshopStockUnits = ['unidade', 'chapa', 'metro', 'm2'] as const

export type WorkshopStockUnit = (typeof workshopStockUnits)[number]

export type WorkshopStockItemView = {
  id: string
  name: string
  category: string | null
  unit: WorkshopStockUnit
  stockQuantity: number
}

const unitLabels: Record<WorkshopStockUnit, string> = {
  unidade: 'unidade',
  chapa: 'chapa',
  metro: 'metro',
  m2: 'm²',
}

export function workshopStockUnitLabel(unit: WorkshopStockUnit) {
  return unitLabels[unit]
}

export function isCountedStockUnit(unit: WorkshopStockUnit | string) {
  return unit === 'unidade' || unit === 'chapa'
}
