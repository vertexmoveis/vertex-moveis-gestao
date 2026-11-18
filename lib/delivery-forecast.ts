import { dateOnlyKeyInTimeZone } from '@/lib/date-only'

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const

export function isDeliveryForecastMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(value)
}

export function formatDeliveryForecastMonth(value: unknown): string | null {
  if (!isDeliveryForecastMonth(value)) return null
  const [year, month] = value.split('-')
  return `${MONTH_NAMES[Number(month) - 1]} de ${year}`
}

export function deliveryForecastMonthLabel(value: unknown): string | null {
  const month = formatDeliveryForecastMonth(value)
  return month ? `${month} — dia a definir` : null
}

export function isDeliveryForecastMonthOverdue(value: unknown, now = new Date()): boolean {
  if (!isDeliveryForecastMonth(value) || Number.isNaN(now.getTime())) return false
  return dateOnlyKeyInTimeZone(now).slice(0, 7) > value
}
