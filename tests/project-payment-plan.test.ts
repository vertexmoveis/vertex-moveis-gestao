import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateProjectPaymentPlan } from '../lib/project-payment-plan'

test('Pix registra o valor total à vista e não cria parcelas', () => {
  const confirmedAt = new Date('2026-08-03T12:00:00.000Z')
  const plan = calculateProjectPaymentPlan({
    value: 9700,
    paymentMethod: 'PIX',
    paymentDiscount: 300,
    paymentConfirmedAt: confirmedAt,
  })

  assert.equal(plan.paymentMethod, 'PIX')
  assert.equal(plan.paymentDiscount, 300)
  assert.equal(plan.downPayment, 9700)
  assert.equal(plan.downPaymentDate, confirmedAt)
  assert.equal(plan.installmentCount, 0)
  assert.equal(plan.cardFeeAmount, 0)
})

test('cartão mantém a entrada separada e parcela somente o saldo', () => {
  const plan = calculateProjectPaymentPlan({
    value: 34900,
    paymentMethod: 'CARD',
    downPayment: 15000,
    installmentCount: 1,
    cardFeePercent: 5,
    firstInstallmentDate: new Date('2026-07-11T12:00:00.000Z'),
  })

  assert.equal(plan.paymentMethod, 'CARD')
  assert.equal(plan.downPayment, 15000)
  assert.equal(plan.installmentCount, 1)
  assert.equal(plan.cardFeePercent, 5)
  assert.equal(plan.cardFeeAmount, 995)
})

test('cartão totalmente pago na entrada não mantém parcelas vazias', () => {
  const plan = calculateProjectPaymentPlan({
    value: 5000,
    paymentMethod: 'CARD',
    downPayment: 5000,
    installmentCount: 10,
    cardFeePercent: 3,
  })

  assert.equal(plan.downPayment, 5000)
  assert.equal(plan.installmentCount, 0)
  assert.equal(plan.firstInstallmentDate, null)
  assert.equal(plan.cardFeeAmount, 0)
})

test('boleto mantém entrada e parcelas sem taxa de cartão', () => {
  const firstInstallmentDate = new Date('2026-09-20T12:00:00.000Z')
  const plan = calculateProjectPaymentPlan({
    value: 12000,
    paymentMethod: 'BOLETO',
    downPayment: 2000,
    installmentCount: 5,
    cardFeePercent: 9,
    firstInstallmentDate,
  })

  assert.equal(plan.paymentMethod, 'BOLETO')
  assert.equal(plan.downPayment, 2000)
  assert.equal(plan.installmentCount, 5)
  assert.equal(plan.firstInstallmentDate, firstInstallmentDate)
  assert.equal(plan.cardFeePercent, 0)
  assert.equal(plan.cardFeeAmount, 0)
})

test('pagamento a combinar não gera lançamentos financeiros', () => {
  const plan = calculateProjectPaymentPlan({
    value: 10000,
    paymentMethod: 'TO_DEFINE',
    downPayment: 2000,
    installmentCount: 4,
  })

  assert.equal(plan.downPayment, 0)
  assert.equal(plan.installmentCount, 0)
  assert.equal(plan.paymentDiscount, 0)
})
