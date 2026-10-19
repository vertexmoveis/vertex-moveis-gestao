import assert from 'node:assert/strict'
import test from 'node:test'
import { formatBRLCurrencyInput, parseBRLCurrency } from '@/lib/currency-input'
import { buildFinanceCommercialReport } from '@/lib/finance-commercial-report'
import { createStandaloneSchema, editStandaloneSchema } from '@/lib/standalone-contract-edit'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'

const form = {
  clientId: 'currency-client', title: 'Cozinha planejada',
  description: 'Armários planejados fictícios para verificação dos valores.',
  value: '50.000', paymentMethod: 'CARD' as const, downPayment: '10.000',
  downPaymentDate: '2026-10-19', installmentCount: 4,
  firstInstallmentDate: '2026-11-19', deliveryBusinessDays: 30,
}
const client = {
  id: form.clientId, name: 'Cliente fictício', document: null, phone: null, whatsapp: null,
  email: null, address: null, street: null, number: null, neighborhood: null,
  city: null, state: null, zipCode: null,
}

test('ponto de milhar brasileiro não é convertido em valor decimal', () => {
  for (const [input, expected] of [
    ['50.000', 50_000], ['38.000', 38_000], ['38.000,00', 38_000],
    ['1.234,56', 1234.56], ['1.234.567,89', 1234567.89],
    ['50.000,50', 50000.5], ['0,10', 0.1], ['50', 50], ['38000', 38_000],
    ['1234.56', 1234.56], ['50.00', 50], [' 38.000,00 ', 38_000],
  ] as const) {
    assert.equal(parseBRLCurrency(input), expected, input)
  }
  assert.equal(parseBRLCurrency(50_000), 50_000)
  assert.equal(parseBRLCurrency(0), 0)
  assert.equal(parseBRLCurrency(1234.56), 1234.56)
})

test('entrada vazia, texto, agrupamento incorreto e casas decimais extras não viram dinheiro válido', () => {
  for (const input of [
    '', '   ', 'abc', '38foo', 'NaN', 'Infinity', '1e3', '1/2',
    '1.23.456', '1,234,56', '50.000,000', '1234.5678', '1,234', '1.000,001',
    Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  ]) {
    assert.ok(Number.isNaN(parseBRLCurrency(input)), `Rejeitar ${JSON.stringify(input)}`)
  }
})

test('formatação e releitura preservam reais e centavos sem alterar a escala', () => {
  assert.equal(formatBRLCurrencyInput(50_000), '50.000,00')
  assert.equal(formatBRLCurrencyInput(38_000), '38.000,00')
  assert.equal(formatBRLCurrencyInput(1234.56), '1.234,56')
  for (const value of [0, 0.01, 0.1, 1, 38, 50, 99.99, 1234.56, 38_000, 50_000, 50000.5, 10_000_000]) {
    assert.equal(parseBRLCurrency(formatBRLCurrencyInput(value)), value, String(value))
  }
})

test('criação e edição usam o mesmo valor numérico para total e entrada brasileiros', () => {
  const created = createStandaloneSchema.parse(form)
  const edited = editStandaloneSchema.parse({ ...form, updatedAt: '2026-10-19T15:00:00.000Z' })
  for (const result of [created, edited]) {
    assert.equal(result.value, 50_000)
    assert.equal(result.downPayment, 10_000)
    assert.equal(typeof result.value, 'number')
    assert.equal(typeof result.downPayment, 'number')
  }
  assert.equal(createStandaloneSchema.parse({ ...form, value: '38.000,00', downPayment: '8.000,00' }).value, 38_000)
  assert.equal(createStandaloneSchema.parse({ ...form, value: 50_000, downPayment: 10_000 }).value, 50_000)
  assert.equal(createStandaloneSchema.parse({ ...form, value: '1234.56', downPayment: '234.56' }).downPayment, 234.56)
})

test('validação monetária rejeita dados inválidos nos dois campos em criação e edição', () => {
  for (const schema of [createStandaloneSchema, editStandaloneSchema]) {
    const input = { ...form, ...(schema === editStandaloneSchema ? { updatedAt: '2026-10-19T15:00:00.000Z' } : {}) }
    for (const field of ['value', 'downPayment'] as const) {
      for (const invalid of ['', 'abc', '1.23.456', '1,234', '50.000,001', -1, 10.001]) {
        assert.equal(schema.safeParse({ ...input, [field]: invalid }).success, false, `${field}: ${invalid}`)
      }
    }
    assert.equal(schema.safeParse({ ...input, downPayment: '50.000' }).success, false)
    assert.equal(schema.safeParse({ ...input, downPayment: '60.000' }).success, false)
  }
})

test('valor interpretado de 50 mil chega inteiro ao documento, às parcelas e ao Financeiro', () => {
  const parsed = createStandaloneSchema.parse(form)
  const snapshot = buildStandaloneContractSnapshot(parsed, client, { tradeName: 'Empresa fictícia' })
  assert.equal(snapshot.project.value, 50_000)
  assert.equal(snapshot.payment.downPayment, 10_000)
  assert.equal(snapshot.payment.schedule.length, 5)
  assert.equal(snapshot.payment.schedule[0].amount, 10_000)
  assert.deepEqual(snapshot.payment.schedule.slice(1).map(payment => payment.amount), [10_000, 10_000, 10_000, 10_000])
  assert.equal(snapshot.payment.schedule.reduce((total, payment) => total + payment.amount, 0), 50_000)
  const report = buildFinanceCommercialReport({
    month: '2026-10', now: new Date('2026-10-19T16:00:00Z'), projects: [], quotes: [],
    contracts: [{
      id: 'currency-contract', projectId: null, standaloneTitle: form.title, status: 'SENT',
      snapshot: JSON.stringify(snapshot), client: { name: client.name },
      createdAt: '2026-10-19T15:00:00Z', updatedAt: '2026-10-19T15:00:00Z', sentAt: '2026-10-19T15:00:00Z',
    }],
  })
  assert.equal(report.negotiating.count, 1)
  assert.equal(report.negotiating.amount, 50_000)
  assert.equal(report.negotiating.items[0].amount, 50_000)
  assert.equal(report.potentialTotal, 50_000)
})
