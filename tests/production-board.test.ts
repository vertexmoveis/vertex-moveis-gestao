import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareProductionProjects,
  getAdjacentProductionStage,
  getProductionDeadline,
  getProductionDeadlineDetails,
  getProductionProjectState,
  isProductionStageSkip,
  matchesProductionAttention,
  productionDeadlineLabel,
} from '../lib/production-board'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_DESCRIPTIONS,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_LABELS,
  PRODUCTION_STAGE_STATUS,
  type ProjectData,
} from '../types'
import { projectPatchSchema } from '../lib/schemas'

test('previsão mensal não reutiliza o dia antigo nem inventa contagem de dias', () => {
  const monthly = project({ deliveryForecastMonth: '2027-01', deliveryDeadlineDate: '2026-12-16', estimatedEndDate: '2026-12-16' })
  const state = getProductionProjectState(monthly, new Date('2027-01-31T15:00:00Z'))
  assert.equal(state.deadline, null)
  assert.equal(state.daysRemaining, null)
  assert.equal(state.noDeadline, false)
  assert.equal(state.overdue, false)
  assert.equal(productionDeadlineLabel(state), 'Dia a definir')
  assert.equal(getProductionProjectState(monthly, new Date('2027-02-01T03:00:00Z')).overdue, true)
  const staged = getProductionProjectState({ ...monthly, stageDeadlineDate: '2027-01-20' }, new Date('2027-01-19T15:00:00Z'))
  assert.equal(staged.deadlineKind, 'STAGE')
  assert.equal(staged.daysRemaining, 1)
})

function project(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 'project-1',
    name: 'Cozinha',
    room: 'Cozinha',
    status: 'IN_PRODUCTION',
    stage: 'PRODUCTION',
    approvalDate: null,
    deliveryBusinessDays: 30,
    deliveryDeadlineDate: null,
    productionReminderBusinessDays: 7,
    productionStartReminderDate: null,
    startDate: null,
    estimatedEndDate: null,
    actualEndDate: null,
    value: null,
    productionCost: null,
    downPayment: null,
    downPaymentDate: null,
    installmentCount: 0,
    installmentValue: null,
    firstInstallmentDate: null,
    internalNotes: null,
    productionBlockedAt: null,
    productionBlockReason: null,
    stageDeadlineDate: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    client: { id: 'client-1', name: 'Cliente', phone: null, whatsapp: null },
    manager: { id: 'manager-1', name: 'Responsável' },
    ...overrides,
  }
}

const now = new Date(2026, 6, 28, 9)

test('prioriza o prazo da etapa antes da entrega geral', () => {
  const item = project({
    stageDeadlineDate: '2026-07-30T12:00:00.000Z',
    deliveryDeadlineDate: '2026-08-15T12:00:00.000Z',
  })
  assert.equal(getProductionDeadline(item), '2026-07-30T12:00:00.000Z')
  assert.equal(getProductionDeadlineDetails(item).kind, 'STAGE')
})

test('prazo de etapa posterior não esconde uma entrega atrasada', () => {
  const item = project({
    stageDeadlineDate: '2026-08-17T12:00:00.000Z',
    estimatedEndDate: '2026-07-29T12:00:00.000Z',
  })
  const state = getProductionProjectState(item, new Date(2026, 7, 3, 9))

  assert.equal(state.deadline, '2026-07-29T12:00:00.000Z')
  assert.equal(state.deadlineKind, 'DELIVERY')
  assert.equal(state.overdue, true)
})

test('classifica projetos atrasados, próximos e sem prazo', () => {
  const overdue = getProductionProjectState(project({ stageDeadlineDate: '2026-07-27' }), now)
  const dueSoon = getProductionProjectState(project({ stageDeadlineDate: '2026-08-02' }), now)
  const noDeadline = getProductionProjectState(project(), now)

  assert.equal(overdue.overdue, true)
  assert.equal(productionDeadlineLabel(overdue), 'Atrasado há 1 dia')
  assert.equal(dueSoon.dueSoon, true)
  assert.equal(noDeadline.noDeadline, true)
  assert.equal(matchesProductionAttention(project(), 'NO_DEADLINE', now), true)
})

test('não considera projeto concluído como atrasado ou sem prazo', () => {
  const state = getProductionProjectState(
    project({ stage: 'COMPLETED', status: 'COMPLETED', stageDeadlineDate: '2026-07-01' }),
    now,
  )

  assert.equal(state.completed, true)
  assert.equal(state.overdue, false)
  assert.equal(state.noDeadline, false)
})

test('ordena bloqueados antes de atrasados e dos demais', () => {
  const blocked = project({ id: 'blocked', productionBlockedAt: '2026-07-20T12:00:00.000Z' })
  const overdue = project({ id: 'overdue', stageDeadlineDate: '2026-07-27' })
  const normal = project({ id: 'normal', stageDeadlineDate: '2026-08-20' })
  const sorted = [normal, overdue, blocked].sort((a, b) => compareProductionProjects(a, b, now))

  assert.deepEqual(sorted.map((item) => item.id), ['blocked', 'overdue', 'normal'])
})

test('calcula avanço e detecta salto de etapa', () => {
  assert.equal(getAdjacentProductionStage('MEASUREMENT', 1), 'DESIGN_PENDING')
  assert.equal(getAdjacentProductionStage('DESIGN_PENDING', 1), 'DESIGN')
  assert.equal(isProductionStageSkip('MEASUREMENT', 'DESIGN'), true)
  assert.equal(getAdjacentProductionStage('DESIGN', 1), 'PROJECT_READY')
  assert.equal(getAdjacentProductionStage('PENDING_START', -1), null)
  assert.equal(isProductionStageSkip('DESIGN', 'PRODUCTION'), true)
  assert.equal(isProductionStageSkip('DESIGN', 'PROJECT_READY'), false)
})

test('fluxo acompanha desenho, cotas, aprovação, fabricação, transporte e instalação sem mesclar etapas', () => {
  const stages = [
    'PENDING_START', 'MEASUREMENT', 'DESIGN_PENDING', 'DESIGN', 'PROJECT_READY', 'DIMENSIONING',
    'PROJECT_APPROVED', 'SENDING_TO_PRODUCTION', 'PRODUCTION', 'PRODUCTION_READY',
    'TRANSPORTATION', 'INSTALLATION', 'COMPLETED',
  ] as const
  assert.deepEqual(PRODUCTION_STAGE_FLOW, [...stages])
  assert.equal(PRODUCTION_STAGE_LABELS.DESIGN_PENDING, 'Aguardando projeto')
  assert.equal(PRODUCTION_STAGE_STATUS.DESIGN_PENDING, 'DESIGN_ENGINEERING')
  for (const [index, stage] of stages.entries()) {
    assert.equal(normalizeProductionStage(stage), stage)
    assert.equal(getAdjacentProductionStage(stage, 1), stages[index + 1] || null)
    assert.equal(getAdjacentProductionStage(stage, -1), stages[index - 1] || null)
    assert.ok(PRODUCTION_STAGE_LABELS[stage])
    assert.ok(PRODUCTION_STAGE_DESCRIPTIONS[stage])
    assert.equal(projectPatchSchema.safeParse({ stage }).success, true)
  }
  assert.equal(getAdjacentProductionStage('PROJECT_READY', 1), 'DIMENSIONING')
  assert.equal(getAdjacentProductionStage('PRODUCTION_READY', 1), 'TRANSPORTATION')
  assert.equal(getAdjacentProductionStage('TRANSPORTATION', 1), 'INSTALLATION')
  assert.equal(isProductionStageSkip('PRODUCTION', 'INSTALLATION'), true)
  assert.equal(isProductionStageSkip('TRANSPORTATION', 'INSTALLATION'), false)
})

test('produção pronta continua ativa até a entrega e instalação serem finalizadas', () => {
  for (const stage of ['PROJECT_APPROVED', 'PRODUCTION_READY', 'TRANSPORTATION', 'INSTALLATION'] as const) {
    const state = getProductionProjectState(project({ stage, stageDeadlineDate: '2026-07-27' }), now)
    assert.equal(state.completed, false)
    assert.equal(state.overdue, true)
    assert.notEqual(PRODUCTION_STAGE_STATUS[stage], 'COMPLETED')
  }
  assert.equal(PRODUCTION_STAGE_STATUS.PROJECT_APPROVED, 'PROJECT_READY')
  assert.equal(PRODUCTION_STAGE_STATUS.PRODUCTION_READY, 'IN_PRODUCTION')
  assert.equal(projectPatchSchema.safeParse({ stage: 'COTACAO' }).success, false)
})
