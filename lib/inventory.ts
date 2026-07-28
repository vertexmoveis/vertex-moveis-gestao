export function isLowStock(stockQuantity: number, minimumStock: number) {
  return minimumStock > 0 && stockQuantity <= minimumStock
}

export function stockShortage(stockQuantity: number, minimumStock: number) {
  return Math.max(minimumStock - stockQuantity, 0)
}

export function inventoryUnitLabel(unit: string) {
  if (unit === 'm2') return 'm²'
  if (unit === 'metro') return 'm'
  if (unit === 'unidade') return 'un.'
  return unit
}
