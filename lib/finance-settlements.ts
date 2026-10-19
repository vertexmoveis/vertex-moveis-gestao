import { dateOnlyKeyInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { moneyValue, type NumericValue } from '@/lib/money'

export function financeMonth(value?: string | null, now = new Date()) {
  const key = value && /^(\d{4})-(0[1-9]|1[0-2])$/.test(value) ? value : dateOnlyKeyInTimeZone(now).slice(0, 7)
  const next = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1, 12)).toISOString().slice(0, 7)
  return { key, start: startOfDateInTimeZone(`${key}-01`)!, end: startOfDateInTimeZone(`${next}-01`)! }
}

export type ReceiptPayment = {
  id: string
  amount: NumericValue
  paidAt: Date | null
  receiptAllocations: Array<{ amount: NumericValue; receipt: { reversedAt: Date | null } }>
}

export function paymentReceived(payment: ReceiptPayment) {
  if (payment.paidAt) return moneyValue(payment.amount)
  return moneyValue(payment.receiptAllocations.reduce((sum, allocation) => (
    sum + (allocation.receipt.reversedAt ? 0 : moneyValue(allocation.amount))
  ), 0))
}

export function allocateReceipt(payments: ReceiptPayment[], amount: number) {
  let cents = Math.round(amount * 100)
  const allocations: Array<{ paymentId: string; amount: number }> = []
  for (const payment of payments) {
    const outstanding = Math.max(Math.round((moneyValue(payment.amount) - paymentReceived(payment)) * 100), 0)
    const allocated = Math.min(outstanding, cents)
    if (allocated > 0) allocations.push({ paymentId: payment.id, amount: allocated / 100 })
    cents -= allocated
    if (cents === 0) break
  }
  if (cents !== 0) throw new Error('O valor informado ultrapassa o saldo em aberto.')
  return allocations
}

export function receiptAmounts(amount: number, fee: number) {
  if (!Number.isFinite(amount) || !Number.isFinite(fee) || amount <= 0 || fee < 0 || fee > amount) {
    throw new Error('Informe o valor bruto e uma taxa entre zero e o valor recebido.')
  }
  return { gross: moneyValue(amount), fee: moneyValue(fee), net: moneyValue(amount - fee) }
}
