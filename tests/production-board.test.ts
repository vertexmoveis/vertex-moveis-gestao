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
import type { ProjectData } from '../types'

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
  assert.equal(getAdjacentProductionStage('DESIGN', 1), 'PROJECT_READY')
  assert.equal(getAdjacentProductionStage('PENDING_START', -1), null)
  assert.equal(isProductionStageSkip('DESIGN', 'PRODUCTION'), true)
  assert.equal(isProductionStageSkip('DESIGN', 'PROJECT_READY'), false)
})
