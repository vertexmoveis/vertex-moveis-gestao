import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getProjectMacroPhase,
  getProjectPhaseBlockers,
  getProjectPhaseTasks,
  type ProjectPhaseInput,
} from '../lib/project-phases'

const input = (overrides: Partial<ProjectPhaseInput> = {}): ProjectPhaseInput => ({
  stage: 'PENDING_START',
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
    payments: [{ paidAt: '2026-07-30' }],
  }), 'PREPARATION')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
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

test('entrega aceita ambientes instalados ou finalizados', () => {
  const tasks = getProjectPhaseTasks(input({
    stage: 'INSTALLATION',
    clientPhone: '5511999999999',
    environments: [{ status: 'INSTALLED' }, { status: 'COMPLETED' }],
  }), 'DELIVERY')

  assert.deepEqual(getProjectPhaseBlockers(tasks), [])
})
