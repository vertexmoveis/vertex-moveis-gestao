export const DEFAULT_DELIVERY_BUSINESS_DAYS = 30
export const DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS = 7

type DateLike = Date | string | null | undefined

function parseDateOnly(value: DateLike) {
  if (!value) return null

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
    }
  }

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

export function isBusinessDay(value: DateLike) {
  const date = parseDateOnly(value)
  if (!date) return false

  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function addBusinessDays(value: DateLike, days: number) {
  const date = parseDateOnly(value)
  if (!date) return null

  const safeDays = Math.max(Math.floor(days), 0)
  const next = new Date(date)
  let remaining = safeDays

  while (remaining > 0) {
    next.setDate(next.getDate() + 1)
    if (isBusinessDay(next)) remaining -= 1
  }

  return next
}

export function businessDaysBetween(from: DateLike, to: DateLike) {
  const start = parseDateOnly(from)
  const end = parseDateOnly(to)
  if (!start || !end) return null

  if (start.getTime() === end.getTime()) return 0

  const direction = start < end ? 1 : -1
  const cursor = new Date(start)
  let count = 0

  while ((direction > 0 && cursor < end) || (direction < 0 && cursor > end)) {
    cursor.setDate(cursor.getDate() + direction)
    if (isBusinessDay(cursor)) count += direction
  }

  return count
}

export function calculateProjectProductionDates({
  approvalDate,
  deliveryBusinessDays = DEFAULT_DELIVERY_BUSINESS_DAYS,
  reminderBusinessDays = DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS,
}: {
  approvalDate: DateLike
  deliveryBusinessDays?: number | null
  reminderBusinessDays?: number | null
}) {
  const deliveryDays = deliveryBusinessDays || DEFAULT_DELIVERY_BUSINESS_DAYS
  const reminderDays = reminderBusinessDays || DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS

  return {
    deliveryDeadlineDate: addBusinessDays(approvalDate, deliveryDays),
    productionStartReminderDate: addBusinessDays(approvalDate, reminderDays),
  }
}
