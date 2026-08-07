export const WARRANTY_PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const
export const WARRANTY_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'SCHEDULED',
  'RESOLVED',
  'CANCELED',
] as const

export type WarrantyPriority = (typeof WARRANTY_PRIORITIES)[number]
export type WarrantyStatus = (typeof WARRANTY_STATUSES)[number]

export const WARRANTY_PRIORITY_LABELS: Record<WarrantyPriority, string> = {
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_PARTS: 'Aguardando material',
  SCHEDULED: 'Visita agendada',
  RESOLVED: 'Resolvido',
  CANCELED: 'Cancelado',
}

export function isWarrantyPriority(value: string): value is WarrantyPriority {
  return WARRANTY_PRIORITIES.includes(value as WarrantyPriority)
}

export function isWarrantyStatus(value: string): value is WarrantyStatus {
  return WARRANTY_STATUSES.includes(value as WarrantyStatus)
}

export function warrantyStatusIsClosed(value: string) {
  return value === 'RESOLVED' || value === 'CANCELED'
}

export function warrantyDueAt(priority: WarrantyPriority, from: Date = new Date()) {
  const businessDays = priority === 'URGENT' ? 1 : priority === 'HIGH' ? 2 : 5
  const due = new Date(from)
  let remaining = businessDays
  while (remaining > 0) {
    due.setUTCDate(due.getUTCDate() + 1)
    const weekday = due.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return due
}
