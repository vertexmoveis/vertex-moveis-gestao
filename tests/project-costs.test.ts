import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateProjectCostSummary } from '@/lib/project-costs'

test('o custo ajustado troca apenas materiais que receberam custo real', () => {
  const summary = calculateProjectCostSummary(1000, [
    { estimatedCost: 200, actualCost: 250 },
    { estimatedCost: 100, actualCost: null },
  ])

  assert.equal(summary.estimatedCost, 1000)
  assert.equal(summary.materialAdjustment, 50)
  assert.equal(summary.adjustedCost, 1050)
  assert.equal(summary.actualMaterials, 250)
  assert.equal(summary.trackedMaterials, 1)
  assert.equal(summary.totalMaterials, 2)
  assert.equal(summary.hasActualCosts, true)
})

test('sem custo real o valor previsto permanece intacto', () => {
  const summary = calculateProjectCostSummary(1500, [{ estimatedCost: 300, actualCost: null }])
  assert.equal(summary.adjustedCost, 1500)
  assert.equal(summary.hasActualCosts, false)
})

test('soma mão de obra, frete e outras despesas ao custo ajustado', () => {
  const summary = calculateProjectCostSummary(
    5000,
    [{ estimatedCost: 1000, actualCost: 1200 }],
    [{ amount: 800 }, { amount: 250 }],
  )

  assert.equal(summary.actualExpenses, 1050)
  assert.equal(summary.totalExpenses, 2)
  assert.equal(summary.adjustedCost, 6250)
  assert.equal(summary.hasActualCosts, true)
})
