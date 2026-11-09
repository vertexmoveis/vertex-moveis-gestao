import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getProjectMacroPhase,
  getProjectNextAction,
  getProjectPhaseBlockers,
  getProjectPhaseTasks,
  getProjectTransitionBlockers,
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

test('preparação mantém a conferência dos dados completos', () => {
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

test('contrato enviado permanece pendente sem impedir avanço manual', () => {
  const tasks = getProjectPhaseTasks(input({
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-04',
    paymentConfirmedAt: '2026-08-04',
    contractStatus: 'SENT',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'contract')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'contract')?.label, 'Contrato enviado')
})

test('revisão contratual permanece indicada sem impedir avanço manual', () => {
  const tasks = getProjectPhaseTasks(input({
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-04',
    paymentConfirmedAt: '2026-08-04',
    contractStatus: 'SIGNED',
    contractRevisionRequiredAt: '2026-08-05T12:00:00.000Z',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'contract')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'contract')?.label, 'Nova versão do contrato necessária')
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

test('política contratual explícita continua visível em projeto antigo', () => {
  const tasks = getProjectPhaseTasks(input({
    createdAt: '2026-06-17T12:00:00.000Z',
    contractRequirement: 'REQUIRED',
    paymentConfirmedAt: '2026-07-30',
    contractStatus: 'SENT',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-07-30',
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'contract')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'contract')?.label, 'Contrato enviado')
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

test('entrada parcial continua pendente e permite avançar a etapa manualmente', () => {
  const tasks = getProjectPhaseTasks(input({
    downPayment: 15000,
    contractStatus: 'SIGNED',
    environments: [{ status: 'PENDING' }],
    files: [{ category: 'MEASUREMENT' }, { category: 'TECHNICAL_PROJECT' }],
    approvalDate: '2026-08-03',
    payments: [{ type: 'DOWN_PAYMENT', amount: 5000, paidAt: '2026-08-03' }],
  }), 'PREPARATION')

  assert.equal(getProjectNextAction(tasks, 'PREPARATION').action, 'ADVANCE_PHASE')
  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'payment')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'payment')?.label, 'Entrada recebida parcialmente')
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

test('produção informa ambientes pendentes e impedimento sem bloquear a troca de etapa', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'PRODUCTION',
    productionBlockedAt: '2026-07-30',
    environments: [{ status: 'READY' }, { status: 'IN_PROGRESS' }],
  }), 'PRODUCTION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  assert.equal(tasks.find((task) => task.key === 'ready')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'unblocked')?.completed, false)
})

test('projeto em produção pode avançar com progresso do ambiente ainda pendente', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'PRODUCTION',
    environments: [{ status: 'IN_PROGRESS' }],
  }), 'PRODUCTION')

  const nextAction = getProjectNextAction(tasks, 'PRODUCTION')

  assert.equal(nextAction.key, 'advance')
  assert.equal(nextAction.action, 'ADVANCE_PHASE')
})

test('entrega aceita ambientes instalados ou finalizados', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'INSTALLATION',
    clientPhone: '5511999999999',
    environments: [{ status: 'INSTALLED' }, { status: 'COMPLETED' }],
  }), 'DELIVERY')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
})

test('todos os itens de acompanhamento são opcionais e não inventam conclusão', () => {
  const incomplete = input({ workflowVersion: 2, contractStatus: 'NONE', productionBlockedAt: '2026-08-04' })
  const before = structuredClone(incomplete)

  for (const phase of ['PREPARATION', 'PRODUCTION', 'DELIVERY', 'COMPLETED'] as const) {
    const tasks = getProjectPhaseTasks(incomplete, phase)
    assert.ok(tasks.length > 0)
    assert.ok(tasks.every((task) => !task.required), `${phase}: itens devem ser opcionais`)
    assert.ok(tasks.every((task) => !task.completed), `${phase}: pendências não devem virar concluídas`)
    assert.deepEqual(getProjectPhaseBlockers(tasks), [])
  }

  assert.deepEqual(incomplete, before)
})

test('projeto pronto sem entrada, contrato assinado, arquivos ou progresso pode avançar', () => {
  const project = input({
    workflowVersion: 2,
    stage: 'PROJECT_READY',
    contractStatus: 'SENT',
    contractViewedAt: '2026-08-04T12:00:00.000Z',
    contractRequirement: 'REQUIRED',
    downPayment: 1000,
    payments: [{ type: 'DOWN_PAYMENT', amount: 1000, paidAt: null }],
    environments: [{ status: 'PENDING' }],
  })
  const before = structuredClone(project)

  for (const target of ['PRODUCTION', 'DELIVERY', 'COMPLETED'] as const) {
    assert.deepEqual(getProjectTransitionBlockers(project, target), [])
  }

  const tasks = getProjectPhaseTasks(project, 'PREPARATION')
  assert.equal(tasks.find((task) => task.key === 'payment')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'contract')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'measurement')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'technical-project')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'approval')?.completed, false)
  assert.equal(getProjectNextAction(tasks, 'PREPARATION').action, 'ADVANCE_PHASE')
  assert.deepEqual(project, before)
})

test('instalação pode ser finalizada sem WhatsApp nem ambientes instalados', () => {
  const project = input({ stage: 'INSTALLATION', environments: [{ status: 'PENDING' }] })
  const tasks = getProjectPhaseTasks(project, 'DELIVERY')

  assert.deepEqual(getProjectTransitionBlockers(project, 'COMPLETED'), [])
  assert.equal(tasks.find((task) => task.key === 'contact')?.completed, false)
  assert.equal(tasks.find((task) => task.key === 'installed')?.completed, false)
  assert.equal(getProjectNextAction(tasks, 'DELIVERY').action, 'ADVANCE_PHASE')
})
