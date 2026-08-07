function safeQuantity(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

export function maxReservableQuantity(input: {
  stockQuantity: number
  activeReservedQuantity: number
  currentProjectQuantity?: number
}) {
  const stock = safeQuantity(input.stockQuantity)
  const activeReserved = safeQuantity(input.activeReservedQuantity)
  const currentProject = Math.min(safeQuantity(input.currentProjectQuantity || 0), activeReserved)
  return Math.max(stock - activeReserved + currentProject, 0)
}

export function automaticReservationQuantity(input: {
  requiredQuantity: number
  stockQuantity: number
  activeReservedQuantity: number
}) {
  const available = maxReservableQuantity(input)
  return Math.round(Math.min(safeQuantity(input.requiredQuantity), available) * 10_000) / 10_000
}
