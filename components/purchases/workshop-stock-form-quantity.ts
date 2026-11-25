export const workshopStockQuantityLimit = 1_000_000
export const workshopStockCountLimit = 99_999_999_999.999

export function parseWorkshopStockQuantity(value: string, maximum = workshopStockQuantityLimit): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^(?:\d+|\d*\.\d{1,3})$/.test(normalized)) return null
  const quantity = Number(normalized)
  return quantity <= maximum ? quantity : null
}

export function workshopStockInputNumber(value: number | null | undefined) {
  return value == null ? '' : String(value).replace('.', ',')
}
