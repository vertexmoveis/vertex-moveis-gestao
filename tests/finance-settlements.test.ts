import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateReceipt, paymentReceived, receiptAmounts, financeMonth, type ReceiptPayment } from '@/lib/finance-settlements'

const payment = (id: string, amount: number, received = 0): ReceiptPayment => ({
  id, amount, paidAt: null,
  receiptAllocations: received ? [{ amount: received, receipt: { reversedAt: null } }] : [],
})

test('cartão recebe o saldo de uma vez sem duplicar uma entrada já recebida por Pix', () => {
  const entry = { ...payment('entry', 10000), paidAt: new Date() }
  const installments = [payment('1', 20000), payment('2', 20000)]
  assert.deepEqual(allocateReceipt([entry, ...installments], 40000), [
    { paymentId: '1', amount: 20000 }, { paymentId: '2', amount: 20000 },
  ])
  assert.deepEqual(receiptAmounts(40000, 2000), { gross: 40000, fee: 2000, net: 38000 })
})

test('recebimento parcial de 15 mil deixa 35 mil no contrato de 50 mil', () => {
  const first = payment('cash', 50000, 15000)
  assert.equal(paymentReceived(first), 15000)
  assert.equal(50000 - paymentReceived(first), 35000)
  assert.deepEqual(allocateReceipt([first], 35000), [{ paymentId: 'cash', amount: 35000 }])
  assert.throws(() => allocateReceipt([first], 35000.01), /ultrapassa/)
})

test('centavos são distribuídos sem perder valor ao quitar várias parcelas', () => {
  const payments = [payment('1', 33.33), payment('2', 33.33), payment('3', 33.34)]
  assert.deepEqual(allocateReceipt(payments, 100), [
    { paymentId: '1', amount: 33.33 }, { paymentId: '2', amount: 33.33 }, { paymentId: '3', amount: 33.34 },
  ])
})

test('estorno remove somente o recebimento corrigido do saldo', () => {
  const partial = payment('partial', 50000, 15000)
  partial.receiptAllocations.push({ amount: 10000, receipt: { reversedAt: new Date() } })
  assert.equal(paymentReceived(partial), 15000)
})

test('taxas não podem ser negativas ou maiores que o recebimento', () => {
  assert.throws(() => receiptAmounts(100, -1))
  assert.throws(() => receiptAmounts(100, 101))
  assert.throws(() => receiptAmounts(Number.NaN, 0))
})

test('relatório respeita virada do mês no horário de São Paulo', () => {
  const month = financeMonth('2026-10')
  assert.equal(month.start.toISOString(), '2026-10-01T03:00:00.000Z')
  assert.equal(month.end.toISOString(), '2026-11-01T03:00:00.000Z')
  assert.equal(financeMonth('2026-00', new Date('2026-11-01T01:00:00Z')).key, '2026-10')
})
