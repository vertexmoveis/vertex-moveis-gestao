import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'

const client = {
  id: 'client-1',
  name: 'Cliente Teste',
  document: null,
  phone: '(11) 99999-9999',
  whatsapp: null,
  email: null,
  address: null,
  street: 'Rua Teste',
  number: '10',
  neighborhood: 'Centro',
  city: 'Cotia',
  state: 'SP',
  zipCode: '06700-000',
}

const company = {
  tradeName: 'Vertex Móveis',
  legalName: 'Vertex Móveis',
}

test('gera contrato avulso parcelado sem depender de orçamento ou projeto', () => {
  const snapshot = buildStandaloneContractSnapshot({
    title: 'Armários planejados',
    description: 'Fabricação e instalação dos armários descritos em visita técnica.',
    value: 10000,
    paymentMethod: 'CARD',
    downPayment: 2000,
    downPaymentDate: '2026-08-22',
    installmentCount: 4,
    firstInstallmentDate: '2026-09-10',
    deliveryBusinessDays: 30,
  }, client, company)

  assert.equal(snapshot.project.name, 'Armários planejados')
  assert.equal(snapshot.project.variationName, 'Contrato avulso')
  assert.equal(snapshot.client.name, 'Cliente Teste')
  assert.equal(snapshot.project.value, 10000)
  assert.equal(snapshot.payment.downPayment, 2000)
  assert.equal(snapshot.payment.schedule.length, 5)
  assert.equal(snapshot.payment.schedule[0].amount, 2000)
  assert.equal(snapshot.payment.schedule[1].amount, 2000)
  assert.match(snapshot.project.scope?.[0]?.items?.[0]?.notes || '', /Fabricação e instalação/)
})

test('contrato avulso no Pix gera um único vencimento', () => {
  const snapshot = buildStandaloneContractSnapshot({
    title: 'Painel planejado',
    description: 'Fabricação e instalação de painel sob medida.',
    value: 3500,
    paymentMethod: 'PIX',
    downPayment: 1000,
    downPaymentDate: '2026-08-22',
    installmentCount: 8,
    firstInstallmentDate: '2026-08-25',
    deliveryBusinessDays: 20,
  }, client, company)

  assert.equal(snapshot.payment.downPayment, 0)
  assert.equal(snapshot.payment.installmentCount, 1)
  assert.equal(snapshot.payment.schedule.length, 1)
  assert.equal(snapshot.payment.schedule[0].amount, 3500)
})
