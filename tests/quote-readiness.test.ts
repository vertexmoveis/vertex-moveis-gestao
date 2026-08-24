import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateQuoteReadiness } from '../lib/quote-readiness'

const completeQuote = {
  title: 'Cozinha planejada',
  total: 12000,
  validUntil: '2026-08-31',
  deliveryBusinessDays: 30,
  firstInstallmentDate: '2026-08-10',
  paymentMethod: 'CARD',
  cardInstallments: 10,
  items: [{ placement: 'Parede da pia' }],
  client: {
    name: 'Cliente Teste',
    document: '123.456.789-00',
    whatsapp: '(11) 99999-9999',
    street: 'Rua A',
    number: '10',
    city: 'Cotia',
    state: 'SP',
    zipCode: '06700-000',
  },
  company: {
    tradeName: 'Vertex Móveis',
    document: '39.778.558/0001-38',
    phone: '(11) 94313-1992',
    street: 'Rua Saturno',
    number: '6',
    city: 'Cotia',
    state: 'SP',
    zipCode: '06702-170',
  },
}

test('orçamento completo fica pronto para envio', () => {
  const readiness = evaluateQuoteReadiness(completeQuote, new Date('2026-07-21T12:00:00-03:00'))
  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.issues, [])
  assert.deepEqual(readiness.warnings, [])
})

test('boleto parcelado fica pronto quando possui parcelas e primeiro vencimento', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    paymentMethod: 'BOLETO',
    cardInstallments: 6,
    firstInstallmentDate: '2026-09-10',
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.issues, [])
})

test('boleto parcelado exige o primeiro vencimento', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    paymentMethod: 'BOLETO',
    firstInstallmentDate: null,
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, false)
  assert.deepEqual(readiness.issues.map((issue) => issue.key), ['quote.firstInstallmentDate'])
})

test('CPF ou CNPJ do cliente não é obrigatório para enviar a proposta', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    client: { ...completeQuote.client, document: '' },
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, true)
  assert.ok(!readiness.issues.some((issue) => issue.key === 'client.document'))
})

test('posição do móvel é recomendada, mas não impede o envio', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    items: [{}],
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.issues, [])
  assert.deepEqual(readiness.warnings.map((warning) => warning.key), ['quote.items.placement'])
})

test('endereço do cliente é recomendado, mas não impede o envio', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    client: { ...completeQuote.client, street: '', number: '', city: '', state: '', zipCode: '' },
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.issues, [])
  assert.deepEqual(readiness.warnings.map((warning) => warning.key), ['client.address'])
})

test('orçamento incompleto informa exatamente o que falta', () => {
  const readiness = evaluateQuoteReadiness({
    ...completeQuote,
    paymentMethod: 'TO_DEFINE',
    validUntil: '2026-07-20',
    client: { ...completeQuote.client, document: '', whatsapp: '', street: '' },
  }, new Date('2026-07-21T12:00:00-03:00'))

  assert.equal(readiness.ready, false)
  assert.deepEqual(
    readiness.issues.map((issue) => issue.key),
    ['quote.validUntil', 'client.contact', 'quote.paymentMethod'],
  )
  assert.deepEqual(readiness.warnings.map((warning) => warning.key), ['client.address'])
})
