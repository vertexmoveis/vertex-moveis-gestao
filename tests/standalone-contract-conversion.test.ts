import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStandaloneCorrectedBoletoContractSnapshot,
  buildStandaloneContractProjectPayments,
  standaloneContractEnvironmentNames,
  standaloneContractProjectPaymentMethod,
} from '@/lib/standalone-contract-conversion'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'

const client = {
  id: 'client-paulo',
  name: 'Paulo Henrique Campos de Souza',
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

function buildCardSnapshot() {
  return buildStandaloneContractSnapshot({
    title: 'Móveis planejados casa',
    description: [
      'COZINHA',
      'SALA',
      'GOURMET',
      'SUÍTE CASAL',
      'BANHEIRO',
      'CLOSET',
    ].join('\n'),
    value: 59_220.35,
    paymentMethod: 'CARD',
    downPayment: 19_222,
    downPaymentDate: '2026-08-22',
    installmentCount: 11,
    firstInstallmentDate: '2026-09-20',
    deliveryBusinessDays: 30,
  }, client, company)
}

test('extrai os ambientes das linhas da descrição quando o ambiente declarado é genérico', () => {
  const environments = standaloneContractEnvironmentNames(buildCardSnapshot())

  assert.deepEqual(environments, [
    'COZINHA',
    'SALA',
    'GOURMET',
    'SUÍTE CASAL',
    'BANHEIRO',
    'CLOSET',
  ])
})

test('preserva o cronograma CARD, paga apenas a entrada e mantém as parcelas pendentes', () => {
  const snapshot = buildCardSnapshot()
  const paymentConfirmedAt = new Date('2026-08-22T12:00:00.000Z')
  const payments = buildStandaloneContractProjectPayments({
    snapshot,
    paymentConfirmedAt,
    entryPaymentMethod: 'TRANSFERENCIA',
  })

  assert.equal(payments.length, 12)
  assert.equal(payments[0].installmentNumber, 0)
  assert.equal(payments[0].type, 'DOWN_PAYMENT')
  assert.equal(payments[0].amount, 19_222)
  assert.equal(payments[0].dueDate.toISOString(), snapshot.payment.schedule[0].dueDate)
  assert.equal(payments[0].paidAt, paymentConfirmedAt)
  assert.equal(payments[0].paymentMethod, 'TRANSFERENCIA')

  const installments = payments.slice(1)
  assert.equal(installments.length, 11)
  assert.ok(installments.every((payment) => payment.type === 'INSTALLMENT'))
  assert.ok(installments.every((payment) => payment.paidAt === null))
  assert.ok(installments.every((payment) => payment.paymentMethod === null))
  assert.deepEqual(
    installments.map((payment) => payment.installmentNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  )
  assert.equal(
    payments.reduce((sum, payment) => Math.round((sum + payment.amount) * 100) / 100, 0),
    59_220.35,
  )
})

test('permite registrar o saldo do contrato CARD como BOLETO sem alterar o cronograma', () => {
  const snapshot = buildCardSnapshot()

  assert.equal(standaloneContractProjectPaymentMethod(snapshot, 'BOLETO'), 'BOLETO')

  const payments = buildStandaloneContractProjectPayments({
    snapshot,
    paymentConfirmedAt: new Date('2026-08-22T12:00:00.000Z'),
    entryPaymentMethod: 'PIX',
  })
  assert.equal(payments[0].paymentMethod, 'PIX')
  assert.ok(payments.slice(1).every((payment) => payment.paymentMethod === null))
  assert.equal(
    payments.slice(1).reduce((sum, payment) => Math.round((sum + payment.amount) * 100) / 100, 0),
    39_998.35,
  )
})

test('gera versão BOLETO preservando o escopo original e documentando a entrada via PIX', () => {
  const snapshot = buildCardSnapshot()
  const original = structuredClone(snapshot)
  const corrected = buildStandaloneCorrectedBoletoContractSnapshot({
    snapshot,
    projectId: 'project-paulo',
    projectName: 'Móveis planejados casa',
    environmentNames: ['COZINHA', 'SALA', 'GOURMET', 'SUÍTE CASAL', 'BANHEIRO', 'CLOSET'],
    approvalDate: new Date('2026-08-22T12:00:00.000Z'),
    recordedAt: new Date('2026-08-24T15:00:00.000Z'),
    entryPaymentMethod: 'PIX',
  })

  assert.deepEqual(snapshot, original)
  assert.equal(corrected.project.id, 'project-paulo')
  assert.deepEqual(corrected.project.scope, original.project.scope)
  assert.equal(corrected.payment.method, 'BOLETO')
  assert.equal(corrected.payment.methodLabel, 'Entrada via Pix + saldo em boleto')
  assert.match(corrected.payment.summary || '', /Entrada de R\$\s*19\.222,00 via Pix/)
  assert.match(corrected.payment.summary || '', /saldo de R\$\s*39\.998,35 em 11 boletos/)
  assert.deepEqual(corrected.payment.schedule, original.payment.schedule)
  assert.notEqual(corrected.payment.schedule, snapshot.payment.schedule)
  assert.match(
    corrected.terms.find((term) => term.title === 'Preço e condição de pagamento')?.text || '',
    /via Pix.*11 boletos/,
  )
  assert.ok(corrected.terms.some((term) => term.title === 'Assinatura, registros e proteção de dados'))
})

test('converte contrato PIX em um único pagamento integral recebido', () => {
  const snapshot = buildStandaloneContractSnapshot({
    title: 'Painel planejado',
    description: 'Fabricação e instalação do painel.',
    value: 3_500,
    paymentMethod: 'PIX',
    downPayment: 1_000,
    downPaymentDate: '2026-08-22',
    installmentCount: 8,
    firstInstallmentDate: '2026-08-25',
    deliveryBusinessDays: 20,
  }, client, company)
  const paymentConfirmedAt = new Date('2026-08-22T14:30:00.000Z')

  const payments = buildStandaloneContractProjectPayments({ snapshot, paymentConfirmedAt })

  assert.equal(payments.length, 1)
  assert.equal(payments[0].installmentNumber, 0)
  assert.equal(payments[0].type, 'DOWN_PAYMENT')
  assert.equal(payments[0].amount, 3_500)
  assert.equal(payments[0].dueDate.toISOString(), snapshot.payment.schedule[0].dueDate)
  assert.equal(payments[0].paidAt, paymentConfirmedAt)
  assert.equal(payments[0].paymentMethod, 'PIX')
  assert.throws(
    () => standaloneContractProjectPaymentMethod(snapshot, 'BOLETO'),
    /BALANCE_PAYMENT_METHOD_NOT_ALLOWED/,
  )
})

test('exige a forma usada para receber a entrada de um contrato CARD', () => {
  assert.throws(
    () => buildStandaloneContractProjectPayments({
      snapshot: buildCardSnapshot(),
      paymentConfirmedAt: new Date('2026-08-22T12:00:00.000Z'),
    }),
    /ENTRY_PAYMENT_METHOD_REQUIRED/,
  )
})

test('rejeita cronograma CARD cuja entrada não corresponde ao resumo do contrato', () => {
  const snapshot = buildCardSnapshot()
  snapshot.payment.schedule[0].amount = 19_000
  snapshot.payment.schedule[1].amount += 222

  assert.throws(
    () => buildStandaloneContractProjectPayments({
      snapshot,
      paymentConfirmedAt: new Date('2026-08-22T12:00:00.000Z'),
      entryPaymentMethod: 'PIX',
    }),
    /INVALID_PAYMENT_SCHEDULE/,
  )
})
