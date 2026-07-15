type DateOnlyValue = Date | string | null | undefined

function dateParts(value: DateOnlyValue) {
  if (!value) return null

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      }
    }
  }

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

export function toDateOnlyUtc(value: DateOnlyValue) {
  const parts = dateParts(value)
  if (!parts) return null

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0))
}

export function dateOnlyKey(value: DateOnlyValue) {
  const parts = dateParts(value)
  if (!parts) return null

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function formatDateOnly(value: DateOnlyValue) {
  const parts = dateParts(value)
  if (!parts) return '-'

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`
}
