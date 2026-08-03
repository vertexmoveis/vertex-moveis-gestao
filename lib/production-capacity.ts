import { dateOnlyKey, dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'

export type ProductionCapacityState = 'AVAILABLE' | 'ATTENTION' | 'OVERLOADED'

export type ProductionCapacityWeek = {
  start: string
  end: string
  scheduled: number
  capacity: number
  usagePercent: number
  state: ProductionCapacityState
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function mondayForDate(value: Date) {
  const day = value.getUTCDay()
  return addUtcDays(value, day === 0 ? -6 : 1 - day)
}

export function getProductionCapacityWeeks(
  deadlines: Array<Date | string | null | undefined>,
  capacity: number,
  now = new Date(),
  weekCount = 4,
): ProductionCapacityWeek[] {
  const safeCapacity = Math.max(Math.trunc(capacity) || 1, 1)
  const today = toDateOnlyUtc(dateOnlyKeyInTimeZone(now)) || now
  const firstMonday = mondayForDate(today)
  const deadlineKeys = deadlines.map(dateOnlyKey).filter((value): value is string => Boolean(value))

  return Array.from({ length: Math.max(weekCount, 1) }, (_, index) => {
    const startDate = addUtcDays(firstMonday, index * 7)
    const endDate = addUtcDays(startDate, 6)
    const start = dateOnlyKey(startDate)!
    const end = dateOnlyKey(endDate)!
    const scheduled = deadlineKeys.filter((key) => key >= start && key <= end).length
    const usagePercent = Math.round((scheduled / safeCapacity) * 100)
    const state: ProductionCapacityState = scheduled > safeCapacity
      ? 'OVERLOADED'
      : scheduled >= Math.ceil(safeCapacity * 0.8)
        ? 'ATTENTION'
        : 'AVAILABLE'

    return { start, end, scheduled, capacity: safeCapacity, usagePercent, state }
  })
}
