export const INSTALLATION_SCHEDULE_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'ON_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const

export type InstallationScheduleStatus = typeof INSTALLATION_SCHEDULE_STATUSES[number]

export const INSTALLATION_SCHEDULE_STATUS_LABELS: Record<InstallationScheduleStatus, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  ON_ROUTE: 'Em rota',
  IN_PROGRESS: 'Em instalação',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

export const INSTALLATION_SCHEDULE_STATUS_CLASSES: Record<InstallationScheduleStatus, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  ON_ROUTE: 'bg-amber-50 text-amber-800',
  IN_PROGRESS: 'bg-orange-50 text-orange-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
}

export const ACTIVE_INSTALLATION_SCHEDULE_STATUSES: InstallationScheduleStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'ON_ROUTE',
  'IN_PROGRESS',
]

export function blocksInstallationResource(status: InstallationScheduleStatus) {
  return status !== 'COMPLETED' && status !== 'CANCELLED'
}
