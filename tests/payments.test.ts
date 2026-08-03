import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPaymentSchedule,
  PAYMENT_TYPE_DOWN_PAYMENT,
  PAYMENT_TYPE_INSTALLMENT,
  PaymentScheduleConflictError,
  reconcilePaymentSchedule,
} from '@/lib/payments'

const paidAt = new Date('2026-07-13T12:00:00.000Z')

const existingPayments = [
  {
    id: 'entrada',
    installmentNumber: 0,
    type: PAYMENT_TYPE_DOWN_PAYMENT,
    amount: 15000,
    dueDate: new Date('2026-06-12T12:00:00.000Z'),
    paidAt,
  },
  {
    id: 'parcela-1',
    installmentNumber: 1,
    type: PAYMENT_TYPE_INSTALLMENT,
    amount: 1750.07,
    dueDate: new Date('2026-07-12T12:00:00.000Z'),
    paidAt,
  },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `parcela-${index + 2}`,
    installmentNumber: index + 2,
    type: PAYMENT_TYPE_INSTALLMENT,
    amount: 1750.07,
    dueDate: new Date(Date.UTC(2026, 7 + index, 12, 12)),
    paidAt: null,
  })),
]

test('explica o mínimo quando todas as parcelas desejadas já foram recebidas', () => {
  const schedule = buildPaymentSchedule({
    value: 34900,
    downPayment: 15000,
    installmentCount: 1,
    firstInstallmentDate: new Date('2026-07-12T12:00:00.000Z'),
  })

  assert.throws(
    () => reconcilePaymentSchedule(schedule, existingPayments),
    (error) => error instanceof PaymentScheduleConflictError
      && error.message === 'A parcela 1 já foi recebida. Para distribuir o saldo restante, informe no mínimo 2 parcelas no total.',
  )
})

test('preserva a parcela recebida e concentra o saldo em uma parcela pendente', () => {
  const schedule = buildPaymentSchedule({
    value: 34900,
    downPayment: 15000,
    installmentCount: 2,
    firstInstallmentDate: new Date('2026-07-12T12:00:00.000Z'),
  })
  const result = reconcilePaymentSchedule(schedule, existingPayments)

  assert.equal(result.creates.length, 0)
  assert.equal(result.updates.length, 1)
  assert.equal(result.updates[0]?.id, 'parcela-2')
  assert.equal(result.updates[0]?.amount, 18149.93)
  assert.equal(result.deleteIds.length, 8)
  assert.equal(result.deleteIds.includes('parcela-1'), false)
})
