/** Accept Brazilian currency or an ungrouped number with decimal point. */
export function parseBRLCurrency(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : Number.NaN
  if (typeof value !== 'string') return Number.NaN
  const text = value.trim().replace(/^R\$\s*/, '')
  if (!text) return Number.NaN
  let normalized: string
  if (text.includes(',')) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return Number.NaN
    normalized = text.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '')
  } else {
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return Number.NaN
    normalized = text
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : Number.NaN
}

export function formatBRLCurrencyInput(value: number): string {
  return Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    : ''
}
