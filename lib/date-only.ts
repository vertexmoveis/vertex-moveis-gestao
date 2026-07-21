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

export function addMonthsToDateOnly(value: DateOnlyValue, months: number) {
  const parts = dateParts(value)
  if (!parts) return null

  const monthIndex = parts.month - 1 + Math.trunc(months)
  const targetYear = parts.year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(parts.day, lastDay), 12, 0, 0, 0))
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

export function dateOnlyKeyInTimeZone(value: Date, timeZone = 'America/Sao_Paulo') {
  const formattedParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => formattedParts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isDateOnlyExpired(value: DateOnlyValue, now = new Date(), timeZone = 'America/Sao_Paulo') {
  const key = dateOnlyKey(value)
  return Boolean(key && key < dateOnlyKeyInTimeZone(now, timeZone))
}
