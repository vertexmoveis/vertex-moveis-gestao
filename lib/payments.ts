import { dateOnlyKey, toDateOnlyUtc } from '@/lib/date-only'
import { numberValue, type NumericValue } from '@/lib/money'

export const PAYMENT_TYPE_DOWN_PAYMENT = 'DOWN_PAYMENT'
export const PAYMENT_TYPE_INSTALLMENT = 'INSTALLMENT'

export type PaymentScheduleInput = {
  value: number | null
  downPayment: number | null
  downPaymentDate?: Date | null
  installmentCount: number | null
  firstInstallmentDate?: Date | null
  baseDate?: Date | null
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function addMonths(date: Date, months: number) {
  const normalized = toDateOnlyUtc(date) || new Date(date)
  const day = normalized.getUTCDate()
  const monthStart = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + months, 1, 12))
  const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12)).getUTCDate()
  monthStart.setUTCDate(Math.min(day, lastDay))
  return monthStart
}

export function calculatePaymentTerms({ value, downPayment, installmentCount }: PaymentScheduleInput) {
  const totalValue = Math.max(value || 0, 0)
  const safeDownPayment = Math.min(Math.max(downPayment || 0, 0), totalValue)
  const safeInstallmentCount = Math.max(Math.floor(installmentCount || 0), 0)
  const remaining = roundCurrency(Math.max(totalValue - safeDownPayment, 0))
  const installmentValue = safeInstallmentCount > 0 ? roundCurrency(remaining / safeInstallmentCount) : 0

  return {
    totalValue,
    downPayment: roundCurrency(safeDownPayment),
    installmentCount: safeInstallmentCount,
    remaining,
    installmentValue,
  }
}

export function buildPaymentSchedule(input: PaymentScheduleInput) {
  const terms = calculatePaymentTerms(input)
  const baseDate = toDateOnlyUtc(input.baseDate || new Date()) || new Date()
  const downPaymentDate = toDateOnlyUtc(input.downPaymentDate || baseDate) || baseDate
  const firstInstallmentDate = toDateOnlyUtc(input.firstInstallmentDate) || addMonths(baseDate, 1)
  const payments: {
    installmentNumber: number
    type: string
    amount: number
    dueDate: Date
    paidAt: Date | null
  }[] = []

  if (terms.downPayment > 0) {
    payments.push({
      installmentNumber: 0,
      type: PAYMENT_TYPE_DOWN_PAYMENT,
      amount: terms.downPayment,
      dueDate: downPaymentDate,
      paidAt: downPaymentDate,
    })
  }

  for (let index = 1; index <= terms.installmentCount; index += 1) {
    const isLast = index === terms.installmentCount
    const paidBeforeLast = roundCurrency(terms.installmentValue * (terms.installmentCount - 1))
    const amount = isLast ? roundCurrency(terms.remaining - paidBeforeLast) : terms.installmentValue

    if (amount <= 0) continue

    payments.push({
      installmentNumber: index,
      type: PAYMENT_TYPE_INSTALLMENT,
      amount,
      dueDate: addMonths(firstInstallmentDate, index - 1),
      paidAt: null,
    })
  }

  return {
    terms,
    payments,
  }
}

export type ExistingProjectPayment = {
  id: string
  installmentNumber: number
  type: string
  amount: NumericValue
  dueDate: Date
  paidAt: Date | null
}

type ScheduledPayment = ReturnType<typeof buildPaymentSchedule>['payments'][number]

export class PaymentScheduleConflictError extends Error {}

function paymentKey(payment: Pick<ExistingProjectPayment, 'type' | 'installmentNumber'>) {
  return `${payment.type}:${payment.installmentNumber}`
}

export function financialScheduleChanged(
  existing: {
    value: NumericValue
    downPayment: NumericValue
    downPaymentDate: Date | null
    installmentCount: number
    firstInstallmentDate: Date | null
    startDate: Date | null
  },
  next: PaymentScheduleInput & { startDate?: Date | null }
) {
  const sameMoney = (left: NumericValue, right: NumericValue) =>
    roundCurrency(numberValue(left)) === roundCurrency(numberValue(right))

  return (
    !sameMoney(existing.value, next.value) ||
    !sameMoney(existing.downPayment, next.downPayment) ||
    existing.installmentCount !== Math.max(Math.floor(next.installmentCount || 0), 0) ||
    dateOnlyKey(existing.downPaymentDate) !== dateOnlyKey(next.downPaymentDate) ||
    dateOnlyKey(existing.firstInstallmentDate) !== dateOnlyKey(next.firstInstallmentDate) ||
    (!next.firstInstallmentDate && dateOnlyKey(existing.startDate) !== dateOnlyKey(next.startDate))
  )
}

export function reconcilePaymentSchedule(
  schedule: ReturnType<typeof buildPaymentSchedule>,
  existingPayments: ExistingProjectPayment[]
) {
  const existingByKey = new Map(existingPayments.map((payment) => [paymentKey(payment), payment]))
  if (existingByKey.size !== existingPayments.length) {
    throw new PaymentScheduleConflictError('Existem parcelas duplicadas neste projeto. Atualize a página e tente novamente.')
  }

  const desiredDownPayment = schedule.payments.find((payment) => payment.type === PAYMENT_TYPE_DOWN_PAYMENT)
  const paidDownPayment = existingPayments.find(
    (payment) => payment.type === PAYMENT_TYPE_DOWN_PAYMENT && payment.paidAt
  )

  if (paidDownPayment) {
    if (!desiredDownPayment || roundCurrency(numberValue(paidDownPayment.amount)) !== roundCurrency(desiredDownPayment.amount)) {
      throw new PaymentScheduleConflictError(
        'A entrada já foi recebida. Reabra o pagamento antes de alterar o valor da entrada.'
      )
    }
  }

  const desiredInstallments = schedule.payments.filter((payment) => payment.type === PAYMENT_TYPE_INSTALLMENT)
  const desiredInstallmentKeys = new Set(desiredInstallments.map(paymentKey))
  const paidInstallments = existingPayments.filter(
    (payment) => payment.type === PAYMENT_TYPE_INSTALLMENT && payment.paidAt
  )

  if (paidInstallments.some((payment) => !desiredInstallmentKeys.has(paymentKey(payment)))) {
    throw new PaymentScheduleConflictError(
      'Não é possível reduzir as parcelas porque já existem pagamentos recebidos fora da nova quantidade.'
    )
  }

  const paidInstallmentTotal = roundCurrency(
    paidInstallments.reduce((sum, payment) => sum + numberValue(payment.amount), 0)
  )
  const installmentBalance = roundCurrency(
    schedule.terms.totalValue - schedule.terms.downPayment - paidInstallmentTotal
  )

  if (installmentBalance < 0) {
    throw new PaymentScheduleConflictError('O valor do projeto não pode ser menor que o total já recebido.')
  }

  const pendingInstallments = desiredInstallments.filter(
    (payment) => !paidInstallments.some((paid) => paymentKey(paid) === paymentKey(payment))
  )

  if (pendingInstallments.length === 0 && installmentBalance > 0) {
    throw new PaymentScheduleConflictError(
      'O parcelamento não possui parcelas suficientes para distribuir o saldo restante.'
    )
  }

  const pendingValue = pendingInstallments.length > 0
    ? roundCurrency(installmentBalance / pendingInstallments.length)
    : 0
  const desiredPendingInstallments = pendingInstallments.map((payment, index) => {
    const isLast = index === pendingInstallments.length - 1
    const amount = isLast
      ? roundCurrency(installmentBalance - pendingValue * (pendingInstallments.length - 1))
      : pendingValue
    return { ...payment, amount }
  })

  const desiredRows: ScheduledPayment[] = [
    ...(desiredDownPayment && !paidDownPayment ? [desiredDownPayment] : []),
    ...desiredPendingInstallments,
  ]
  const updates: (ScheduledPayment & { id: string })[] = []
  const creates: ScheduledPayment[] = []
  const keptIds = new Set<string>()

  for (const payment of desiredRows) {
    const current = existingByKey.get(paymentKey(payment))
    if (current && !current.paidAt) {
      keptIds.add(current.id)
      updates.push({ ...payment, id: current.id, paidAt: current.paidAt })
    } else if (!current) {
      creates.push(payment)
    }
  }

  const deleteIds = existingPayments
    .filter((payment) => !payment.paidAt && !keptIds.has(payment.id))
    .map((payment) => payment.id)

  return { updates, creates, deleteIds }
}
