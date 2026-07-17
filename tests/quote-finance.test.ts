import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateQuoteTotals, getQuoteCardInstallmentPlan } from '@/lib/quotes'
import { buildQuoteApprovalSnapshot, parseQuoteApprovalSnapshot } from '@/lib/quote-approval'

const item = {
  environment: 'Cozinha',
  description: 'Armário aéreo',
  furnitureType: 'Armário',
  furnitureModel: 'Armário aéreo',
  material: 'MDF',
  finish: 'Branco TX',
  width: 100,
  height: 100,
  depth: null,
  difficulty: 'NORMAL',
  calculationMode: 'AREA_M2',
  priceProfile: 'STANDARD',
  manualPrice: 0,
  accessories: [],
  quantity: 1,
  notes: null,
}

const pricing = {
  pricePerM2: 2500,
  materialCostPerM2: 650,
  installationFee: 0,
  marginPercent: 35,
  discount: 0,
  cardInstallments: 10,
  cardDownPayment: 500,
}

test('a taxa do cartão reduz o lucro sem alterar o total do cliente', () => {
  const withoutFee = calculateQuoteTotals([item], { ...pricing, paymentMethod: 'CARD', cardFeePercent: 0 })
  const withFee = calculateQuoteTotals([item], { ...pricing, paymentMethod: 'CARD', cardFeePercent: 5 })

  assert.equal(withFee.total, withoutFee.total)
  assert.equal(withFee.cardFeeAmount, Math.round((withFee.total - withFee.cardDownPayment) * 5) / 100)
  assert.equal(withFee.costTotal, withoutFee.costTotal + withFee.cardFeeAmount)
  assert.equal(withFee.profit, withoutFee.profit - withFee.cardFeeAmount)
})

test('o desconto Pix continua sendo 3% após o desconto comercial', () => {
  const totals = calculateQuoteTotals([item], { ...pricing, paymentMethod: 'PIX', discount: 100 })
  const afterCommercialDiscount = totals.subtotal - totals.manualDiscount
  assert.equal(totals.paymentDiscount, Math.round(afterCommercialDiscount * 3) / 100)
  assert.equal(totals.total, afterCommercialDiscount - totals.paymentDiscount)
})

test('as parcelas fecham exatamente o saldo financiado', () => {
  const plan = getQuoteCardInstallmentPlan(1000, 3, 100)
  const sum = plan.installmentValue * (plan.count - 1) + plan.lastInstallmentValue
  assert.equal(plan.financedAmount, 900)
  assert.equal(sum, 900)
})

test('a aprovação guarda somente os termos enviados ao cliente', () => {
  const quote = {
    id: 'quote-1',
    number: 12,
    title: 'Cozinha planejada',
    validUntil: '2026-08-01T12:00:00.000Z',
    installationFee: 200,
    manualDiscount: 100,
    paymentDiscount: 0,
    paymentMethod: 'CARD',
    cardInstallments: 10,
    cardDownPayment: 500,
    subtotal: 5200,
    total: 5100,
    customerNotes: 'Medidas sujeitas à conferência.',
    client: { name: 'Cliente Teste' },
    items: [{ ...item, id: 'item-1', total: 5000 }],
  }
  const snapshot = buildQuoteApprovalSnapshot(quote)
  const parsed = parseQuoteApprovalSnapshot(snapshot)

  assert.equal(parsed?.quote.total, 5100)
  assert.equal(parsed?.quote.client.name, 'Cliente Teste')
  assert.equal(snapshot.includes('costTotal'), false)
  assert.equal(snapshot, buildQuoteApprovalSnapshot({ ...quote, items: [{ ...quote.items[0], id: 'novo-id-interno' }] }))
  assert.notEqual(snapshot, buildQuoteApprovalSnapshot({ ...quote, total: 5200 }))
})
