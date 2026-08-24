import assert from 'node:assert/strict'
import test from 'node:test'
import { inflateSync } from 'node:zlib'
import { withCompanyProfileDefaults } from '@/lib/company-profile'
import { formatDateOnly } from '@/lib/date-only'
import type { QuoteApprovalData } from '@/lib/quote-approval'
import { renderSimpleQuotePdf } from '@/lib/quote-simple-pdf'
import {
  calculateQuoteTotals,
  getQuotePaymentDetails,
  getQuotePaymentSummary,
  QUOTE_PAYMENT_METHOD_LABELS,
  safeQuotePaymentMethod,
} from '@/lib/quotes'

const pricingItem = {
  environment: 'Cozinha',
  environmentName: 'Cozinha',
  description: 'Armário planejado',
  width: 100,
  height: 100,
  difficulty: 'NORMAL',
  calculationMode: 'AREA_M2',
  priceProfile: 'STANDARD',
  quantity: 1,
}

const boletoQuote: QuoteApprovalData = {
  id: 'quote-boleto',
  number: 51,
  title: 'Cozinha planejada',
  variationType: 'STANDARD',
  variationName: 'Padrão',
  variationOrder: 0,
  createdAt: '2026-01-20T12:00:00.000Z',
  validUntil: '2026-02-10T12:00:00.000Z',
  deliveryBusinessDays: 30,
  firstInstallmentDate: '2026-01-31T12:00:00.000Z',
  installationFee: 0,
  manualDiscount: 0,
  paymentDiscount: 0,
  paymentMethod: 'BOLETO',
  cardInstallments: 3,
  cardDownPayment: 100,
  subtotal: 1000.01,
  total: 1000.01,
  customerNotes: null,
  client: {
    name: 'Cliente Boleto',
    document: null,
    phone: '(11) 99999-9999',
    whatsapp: '(11) 99999-9999',
    email: null,
    address: null,
    street: 'Rua Teste',
    number: '10',
    neighborhood: 'Centro',
    city: 'Cotia',
    state: 'SP',
    zipCode: '06700-000',
  },
  items: [{
    id: 'item-1',
    environment: 'KITCHEN',
    environmentName: 'Cozinha',
    description: 'Armário planejado',
    material: 'MDF',
    finish: 'Branco TX',
    priceProfile: 'STANDARD',
    placement: 'Parede da pia',
    sourceItemKey: null,
    width: 100,
    height: 100,
    quantity: 1,
    total: 1000.01,
    notes: null,
    accessories: [],
  }],
}

function extractEmbeddedPdfText(pdf: Buffer) {
  const binary = pdf.toString('latin1')
  let operators = ''

  for (const match of binary.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    const compressed = Buffer.from(match[1].replace(/\r?\n$/, ''), 'latin1')
    try {
      operators += inflateSync(compressed).toString('latin1')
    } catch {
      // Font and image streams do not necessarily contain Flate-compressed page text.
    }
  }

  return Array.from(operators.matchAll(/<([0-9a-f]+)>/gi), (match) => (
    Buffer.from(match[1], 'hex').toString('latin1')
  )).join('')
}

test('reconhece Boleto como forma de pagamento do orçamento', () => {
  assert.equal(safeQuotePaymentMethod('BOLETO'), 'BOLETO')
  assert.match(String(QUOTE_PAYMENT_METHOD_LABELS.BOLETO), /boleto/i)
})

test('parcelas do boleto fecham os centavos e preservam vencimentos mensais', () => {
  const payment = getQuotePaymentDetails(boletoQuote)

  assert.equal(payment.method, 'BOLETO')
  assert.equal(payment.downPayment, 100)
  assert.equal(payment.financedAmount, 900.01)
  assert.deepEqual(payment.installments.map(({ amount }) => amount), [300, 300, 300.01])
  assert.deepEqual(
    payment.installments.map(({ dueDate }) => formatDateOnly(dueDate)),
    ['31/01/2026', '28/02/2026', '31/03/2026'],
  )
  assert.equal(
    payment.downPayment + payment.installments.reduce((sum, installment) => sum + installment.amount, 0),
    boletoQuote.total,
  )
})

test('boleto não aplica desconto Pix nem taxa de cartão', () => {
  const totals = calculateQuoteTotals([pricingItem], {
    pricePerM2: 1000,
    materialCostPerM2: 400,
    installationFee: 0,
    marginPercent: 0,
    discount: 0,
    paymentMethod: 'BOLETO',
    cardInstallments: 3,
    cardDownPayment: 100,
    cardFeePercent: 9,
  })

  assert.equal(totals.paymentMethod, 'BOLETO')
  assert.equal(totals.paymentDiscount, 0)
  assert.equal(totals.cardFeePercent, 0)
  assert.equal(totals.cardFeeAmount, 0)
  assert.equal(totals.cardInstallments, 3)
  assert.equal(totals.cardDownPayment, 100)
})

test('resumo e PDF do orçamento identificam o parcelamento por boleto', async () => {
  const summary = getQuotePaymentSummary(boletoQuote)
  assert.match(summary, /boleto/i)
  assert.doesNotMatch(summary, /cart[aã]o/i)

  const pdf = await renderSimpleQuotePdf({
    quote: boletoQuote,
    company: withCompanyProfileDefaults(),
  })

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.byteLength > 2_000)

  const pdfText = extractEmbeddedPdfText(pdf)
  assert.match(pdfText, /Boleto/i)
  assert.match(pdfText, /Parcela 1/)
  assert.match(pdfText, /Parcela 2/)
  assert.match(pdfText, /Parcela 3/)
  assert.match(pdfText, /31\/01\/2026/)
  assert.match(pdfText, /28\/02\/2026/)
  assert.match(pdfText, /31\/03\/2026/)
})
