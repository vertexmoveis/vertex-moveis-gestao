import { dateOnlyKey, dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'

type ProductionCapacityState = 'AVAILABLE' | 'ATTENTION' | 'OVERLOADED'

export type ProductionCapacityWeek = {
  start: string
  end: string
  scheduled: number
  capacity: number
  usagePercent: number
  state: ProductionCapacityState
}

export type ProductionCapacityEntry = {
  start?: Date | string | null
  deadline: Date | string | null | undefined
  weight?: number | null
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

function weeksSpanned(start: string, end: string) {
  const startDate = toDateOnlyUtc(start)
  const endDate = toDateOnlyUtc(end)
  if (!startDate || !endDate) return 1
  const startMonday = mondayForDate(startDate)
  const endMonday = mondayForDate(endDate)
  return Math.max(Math.round((endMonday.getTime() - startMonday.getTime()) / (7 * 86_400_000)) + 1, 1)
}

export function getProductionCapacityWeeks(
  deadlines: Array<Date | string | null | undefined | ProductionCapacityEntry>,
  capacity: number,
  now = new Date(),
  weekCount = 4,
): ProductionCapacityWeek[] {
  const safeCapacity = Math.max(Math.trunc(capacity) || 1, 1)
  const today = toDateOnlyUtc(dateOnlyKeyInTimeZone(now)) || now
  const firstMonday = mondayForDate(today)
  const entries = deadlines.flatMap((entry) => {
    const deadline = typeof entry === 'object' && entry !== null && !(entry instanceof Date)
      ? entry.deadline
      : entry
    const key = dateOnlyKey(deadline)
    if (!key) return []
    const weight = typeof entry === 'object' && entry !== null && !(entry instanceof Date)
      ? Math.max(Number(entry.weight) || 1, 0.25)
      : 1
    const start = typeof entry === 'object' && entry !== null && !(entry instanceof Date)
      ? dateOnlyKey(entry.start) || key
      : key
    return [{ key, start: start > key ? key : start, weight }]
  })

  return Array.from({ length: Math.max(weekCount, 1) }, (_, index) => {
    const startDate = addUtcDays(firstMonday, index * 7)
    const endDate = addUtcDays(startDate, 6)
    const start = dateOnlyKey(startDate)!
    const end = dateOnlyKey(endDate)!
    const scheduled = Math.round(entries
      .filter((entry) => entry.start <= end && entry.key >= start)
      .reduce((total, entry) => total + entry.weight / weeksSpanned(entry.start, entry.key), 0) * 100) / 100
    const usagePercent = Math.round((scheduled / safeCapacity) * 100)
    const state: ProductionCapacityState = scheduled > safeCapacity
      ? 'OVERLOADED'
      : scheduled >= Math.ceil(safeCapacity * 0.8)
        ? 'ATTENTION'
        : 'AVAILABLE'

    return { start, end, scheduled, capacity: safeCapacity, usagePercent, state }
  })
}
