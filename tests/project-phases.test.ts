import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getProjectMacroPhase,
  getProjectNextAction,
  getProjectPhaseBlockers,
  getProjectPhaseTasks,
  type ProjectPhaseInput,
} from '../lib/project-phases'
import { getProjectFinancialReadiness } from '../lib/project-workflow'

const input = (overrides: Partial<ProjectPhaseInput> = {}): ProjectPhaseInput => ({
  stage: 'PENDING_START',
  createdAt: '2026-08-04T12:00:00.000Z',
  approvalDate: null,
  paymentConfirmedAt: null,
  productionBlockedAt: null,
  environments: [],
  files: [],
  payments: [],
  clientPhone: null,
  postSaleContactedAt: null,
  ...overrides,
})

test('agrupa os status técnicos nas quatro fases do projeto', () => {
  assert.equal(getProjectMacroPhase('PENDING_START'), 'PREPARATION')
  assert.equal(getProjectMacroPhase('PROJECT_READY'), 'PREPARATION')
  assert.equal(getProjectMacroPhase('PRODUCTION'), 'PRODUCTION')
  assert.equal(getProjectMacroPhase('TRANSPORTATION'), 'DELIVERY')
  assert.equal(getProjectMacroPhase('INSTALLATION'), 'DELIVERY')
  assert.equal(getProjectMacroPhase('COMPLETED'), 'COMPLETED')
})

test('preparação só libera quando os dados essenciais estão completos', () => {
  const tasks = getProjectPhaseTasks(input({
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-07-30',
    paymentConfirmedAt: '2026-07-30',
    contractStatus: 'SIGNED',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
})

test('projeto antigo pode avançar com contrato ainda aguardando assinatura', () => {
  const tasks = getProjectPhaseTasks(input({
    createdAt: '2026-06-17T12:00:00.000Z',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-07-30',
    paymentConfirmedAt: '2026-07-30',
    contractStatus: 'SENT',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'contract')?.label, 'Projeto antigo: contrato em aberto')
})

test('projeto novo exige contrato assinado antes da produção', () => {
  const tasks = getProjectPhaseTasks(input({
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-04',
    paymentConfirmedAt: '2026-08-04',
    contractStatus: 'SENT',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), ['Contrato enviado'])
})

test('alteração comercial em projeto novo exige nova versão assinada', () => {
  const tasks = getProjectPhaseTasks(input({
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-04',
    paymentConfirmedAt: '2026-08-04',
    contractStatus: 'SIGNED',
    contractRevisionRequiredAt: '2026-08-05T12:00:00.000Z',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), ['Nova versão do contrato necessária'])
})

test('entrada recebida libera produção sem exigir parcelas futuras', () => {
  const tasks = getProjectPhaseTasks(input({
    createdAt: '2026-06-17T12:00:00.000Z',
    downPayment: 15000,
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-07-30',
    payments: [
      { type: 'DOWN_PAYMENT', amount: 15000, paidAt: '2026-07-30' },
      { type: 'INSTALLMENT', amount: 19900, paidAt: null },
    ],
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
})

test('política explícita torna o contrato obrigatório mesmo em projeto antigo', () => {
  const tasks = getProjectPhaseTasks(input({
    createdAt: '2026-06-17T12:00:00.000Z',
    contractRequirement: 'REQUIRED',
    paymentConfirmedAt: '2026-07-30',
    contractStatus: 'SENT',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-07-30',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), ['Contrato enviado'])
})

test('dispensa administrativa libera o contrato e preserva a justificativa', () => {
  const tasks = getProjectPhaseTasks(input({
    contractRequirement: 'WAIVED',
    contractWaivedReason: 'Projeto antigo já autorizado antes do novo processo.',
    paymentConfirmedAt: '2026-08-03',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-03',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'contract')?.label, 'Contrato dispensado')
})

test('entrada parcial não libera a produção e informa a prioridade correta', () => {
  const tasks = getProjectPhaseTasks(input({
    downPayment: 15000,
    contractStatus: 'SIGNED',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-03',
    payments: [{ type: 'DOWN_PAYMENT', amount: 5000, paidAt: '2026-08-03' }],
  }), 'PREPARATION')

  assert.equal(getProjectNextAction(tasks, 'PREPARATION').action, 'OPEN_FINANCE')
  assert.deepEqual(getProjectPhaseBlockers(tasks), ['Entrada recebida parcialmente'])
})

test('parcela que vence hoje não é tratada como atrasada', () => {
  const readiness = getProjectFinancialReadiness({
    paymentConfirmedAt: '2026-08-03',
    payments: [{ type: 'INSTALLMENT', amount: 1000, paidAt: null, dueDate: '2026-08-03' }],
    now: new Date('2026-08-03T18:00:00-03:00'),
  })

  assert.equal(readiness.ready, true)
  assert.equal(readiness.hasOverdueInstallments, false)
})

test('produção exige todos os ambientes prontos e respeita bloqueios', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'PRODUCTION',
    productionBlockedAt: '2026-07-30',
    environments: [{ status: 'READY' }, { status: 'IN_PROGRESS' }],
  }), 'PRODUCTION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [
    'Produção sem impedimentos',
    'Todos os ambientes prontos para instalar',
  ])
})

test('projeto em produção pede a pendência atual sem repetir a medição', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'PRODUCTION',
    environments: [{ status: 'IN_PROGRESS' }],
  }), 'PRODUCTION')

  const nextAction = getProjectNextAction(tasks, 'PRODUCTION')

  assert.equal(nextAction.key, 'ready')
  assert.equal(nextAction.label, 'Todos os ambientes prontos para instalar')
})

test('entrega aceita ambientes instalados ou finalizados', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'INSTALLATION',
    clientPhone: '5511999999999',
    environments: [{ status: 'INSTALLED' }, { status: 'COMPLETED' }],
  }), 'DELIVERY')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
})
