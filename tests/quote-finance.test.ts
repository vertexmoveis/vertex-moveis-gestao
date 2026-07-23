import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateQuoteTotals, getQuoteCardInstallmentPlan, getQuotePaymentDetails } from '@/lib/quotes'
import { formatDateOnly } from '@/lib/date-only'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalSnapshot,
  parseQuoteApprovalBundleSnapshot,
  parseQuoteApprovalSnapshot,
} from '@/lib/quote-approval'

const item = {
  environment: 'Cozinha',
  environmentName: 'Cozinha principal',
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

test('o nome do ambiente não altera o cálculo e permanece no item salvo', () => {
  const named = calculateQuoteTotals([item], { ...pricing, paymentMethod: 'TO_DEFINE' })
  const unnamed = calculateQuoteTotals([{ ...item, environmentName: null }], { ...pricing, paymentMethod: 'TO_DEFINE' })

  assert.equal(named.total, unnamed.total)
  assert.equal(named.items[0].environmentName, 'Cozinha principal')
  assert.equal(unnamed.items[0].environmentName, 'Cozinha')
})

test('a dificuldade aplica acréscimos de 30% e 60% ao móvel', () => {
  const normal = calculateQuoteTotals([item], { ...pricing, paymentMethod: 'TO_DEFINE' })
  const difficult = calculateQuoteTotals([{ ...item, difficulty: 'DIFICIL' }], { ...pricing, paymentMethod: 'TO_DEFINE' })
  const veryDifficult = calculateQuoteTotals([{ ...item, difficulty: 'MUITO_DIFICIL' }], { ...pricing, paymentMethod: 'TO_DEFINE' })

  assert.equal(difficult.items[0].total, normal.items[0].total * 1.3)
  assert.equal(veryDifficult.items[0].total, normal.items[0].total * 1.6)
})

test('as parcelas mensais preservam o dia e ajustam o fim do mês', () => {
  const payment = getQuotePaymentDetails({
    total: 900,
    paymentMethod: 'CARD',
    cardInstallments: 3,
    cardDownPayment: 0,
    firstInstallmentDate: '2026-01-31',
  })

  assert.deepEqual(
    payment.installments.map((installment) => formatDateOnly(installment.dueDate)),
    ['31/01/2026', '28/02/2026', '31/03/2026']
  )
  assert.equal(payment.installments.reduce((sum, installment) => sum + installment.amount, 0), 900)
})

test('a aprovação guarda somente os termos enviados ao cliente', () => {
  const quote = {
    id: 'quote-1',
    number: 12,
    title: 'Cozinha planejada',
    createdAt: '2026-07-21T12:00:00.000Z',
    validUntil: '2026-08-01T12:00:00.000Z',
    deliveryBusinessDays: 30,
    firstInstallmentDate: '2026-07-21T12:00:00.000Z',
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
  assert.equal(parsed?.quote.deliveryBusinessDays, 30)
  assert.equal(parsed?.quote.firstInstallmentDate, '2026-07-21T12:00:00.000Z')
  assert.equal(parsed?.quote.items[0].environmentName, 'Cozinha principal')
  assert.equal(snapshot.includes('costTotal'), false)
  assert.equal(snapshot, buildQuoteApprovalSnapshot({ ...quote, items: [{ ...quote.items[0], id: 'novo-id-interno' }] }))
  assert.notEqual(snapshot, buildQuoteApprovalSnapshot({ ...quote, total: 5200 }))
})

test('a comparação guarda duas propostas separadas e em ordem estável', () => {
  const baseQuote = {
    id: 'quote-madeirado',
    number: 9,
    title: 'Cozinha Planejada - Madeirado',
    createdAt: '2026-07-23T12:00:00.000Z',
    validUntil: '2026-08-01T12:00:00.000Z',
    deliveryBusinessDays: 30,
    firstInstallmentDate: '2026-07-30T12:00:00.000Z',
    installationFee: 0,
    manualDiscount: 0,
    paymentDiscount: 0,
    paymentMethod: 'CARD',
    cardInstallments: 10,
    cardDownPayment: 0,
    subtotal: 14784,
    total: 14784,
    customerNotes: null,
    client: { name: 'Flavia Macedo' },
    items: [{ ...item, id: 'madeirado-1', total: 14784 }],
  }
  const alternative = {
    ...baseQuote,
    id: 'quote-provencal',
    number: 11,
    title: 'Cozinha Planejada - Provençal',
    subtotal: 25536,
    total: 25536,
    items: [{ ...item, id: 'provencal-1', total: 25536 }],
  }

  const snapshot = buildQuoteApprovalBundleSnapshot([alternative, baseQuote])
  const parsed = parseQuoteApprovalBundleSnapshot(snapshot)

  assert.deepEqual(parsed?.quotes.map((quote) => quote.id), ['quote-madeirado', 'quote-provencal'])
  assert.deepEqual(parsed?.quotes.map((quote) => quote.total), [14784, 25536])
  assert.equal(snapshot, buildQuoteApprovalBundleSnapshot([baseQuote, alternative]))
  assert.equal(parseQuoteApprovalSnapshot(snapshot), null)
})
