export const CONTRACT_CENTER_STATUSES = [
  'NOT_SENT',
  'NEEDS_REVISION',
  'SENT',
  'VIEWED',
  'SIGNED',
  'EXPIRED',
  'LEGACY',
] as const

export type ContractCenterStatus = (typeof CONTRACT_CENTER_STATUSES)[number]

export const CONTRACT_CENTER_STATUS_LABELS: Record<ContractCenterStatus, string> = {
  NOT_SENT: 'Não enviado',
  NEEDS_REVISION: 'Precisa de revisão',
  SENT: 'Enviado',
  VIEWED: 'Visualizado',
  SIGNED: 'Assinado',
  EXPIRED: 'Expirado',
  LEGACY: 'Projeto antigo',
}

const CONTRACT_REMINDER_DAYS = [2, 5, 7] as const
const DAY_MS = 24 * 60 * 60 * 1000

type ContractStateInput = {
  requirement: string
  revisionRequiredAt?: Date | string | null
  contract?: {
    status: string
    viewedAt?: Date | string | null
    signedAt?: Date | string | null
    voidedAt?: Date | string | null
    expiresAt?: Date | string | null
  } | null
  now?: Date
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getContractCenterStatus(input: ContractStateInput): ContractCenterStatus {
  if (input.revisionRequiredAt) return 'NEEDS_REVISION'

  const contract = input.contract
  if (!contract || contract.voidedAt || contract.status === 'VOID' || contract.status === 'DRAFT') {
    return input.requirement === 'OPTIONAL_LEGACY' ? 'LEGACY' : 'NOT_SENT'
  }
  if (contract.signedAt || contract.status === 'SIGNED') return 'SIGNED'

  const expiresAt = dateValue(contract.expiresAt)
  if (expiresAt && expiresAt.getTime() < (input.now || new Date()).getTime()) return 'EXPIRED'
  if (contract.viewedAt) return 'VIEWED'
  return 'SENT'
}

export function getContractReminderSequence(input: {
  sentAt: Date
  reminderCount: number
  now: Date
  lastReminderAt?: Date | null
}) {
  if (input.reminderCount >= CONTRACT_REMINDER_DAYS.length) return null
  if (input.lastReminderAt && input.now.getTime() - input.lastReminderAt.getTime() < DAY_MS) return null

  const elapsedDays = Math.floor((input.now.getTime() - input.sentAt.getTime()) / DAY_MS)
  const dueDay = CONTRACT_REMINDER_DAYS[input.reminderCount]
  return elapsedDays >= dueDay ? input.reminderCount + 1 : null
}
