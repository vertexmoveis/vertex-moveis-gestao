import assert from 'node:assert/strict'
import test from 'node:test'
import { environmentStatusForStage, environmentWorkflowLabel, environmentWorkflowSummary, getEnvironmentWorkflowStage } from '../lib/environment-workflow'

test('ambientes podem estar em etapas técnicas diferentes sem fingir fabricação concluída', () => {
  const rooms = [{ status: 'PENDING', workflowStage: 'DIMENSIONING' }, { status: 'PENDING', workflowStage: 'DESIGN' }]
  assert.equal(environmentWorkflowLabel(rooms[0]), 'Detalhamento e cotas')
  assert.equal(environmentWorkflowLabel(rooms[1]), 'Projetando')
  assert.equal(environmentStatusForStage('DIMENSIONING'), 'PENDING')
  assert.equal(environmentStatusForStage('PROJECT_APPROVED'), 'PENDING')
  assert.equal(environmentStatusForStage('DESIGN_PENDING'), 'PENDING')
  assert.equal(environmentWorkflowLabel({ status: 'PENDING', workflowStage: 'DESIGN_PENDING' }), 'Aguardando projeto')
  assert.equal(environmentWorkflowSummary(rooms), '1 Detalhamento e cotas · 1 Projetando')
})
test('registros antigos mantêm seu progresso e ambiente sem etapa fica a definir', () => {
  assert.equal(getEnvironmentWorkflowStage({ status: 'PENDING' }), null)
  assert.equal(getEnvironmentWorkflowStage({ status: 'IN_PROGRESS' }), 'PRODUCTION')
  assert.equal(getEnvironmentWorkflowStage({ status: 'READY' }), 'PRODUCTION_READY')
  assert.equal(getEnvironmentWorkflowStage({ status: 'INSTALLED' }), 'COMPLETED')
  assert.equal(environmentStatusForStage('INSTALLATION'), 'READY')
  assert.equal(environmentStatusForStage('COMPLETED'), 'COMPLETED')
})
