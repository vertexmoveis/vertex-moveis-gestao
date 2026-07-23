export type NumericValue = number | string | { toString(): string } | null | undefined

export function numberValue(value: NumericValue) {
  const parsed = typeof value === 'number' ? value : Number(value?.toString() || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function moneyValue(value: NumericValue) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100
}

export function optionalMoneyValue(value: NumericValue) {
  return value === null || value === undefined ? null : moneyValue(value)
}
