import test from 'node:test'
import assert from 'node:assert/strict'
import {
  availableStock,
  calculateCommission,
  calculateProductionWeight,
  estimateSheets,
  minutesBetween,
} from '../lib/operational-toolkit'

test('calcula peso maior para projeto com mais ambientes e dificuldade', () => {
  const simple = calculateProductionWeight(1, [{ difficulty: 'NORMAL' }])
  const complex = calculateProductionWeight(4, [
    { difficulty: 'VERY_DIFFICULT' },
    { difficulty: 'DIFFICULT' },
    { difficulty: 'NORMAL' },
  ])
  assert.ok(complex > simple)
  assert.ok(complex <= 10)
})

test('estima chapas incluindo a perda configurada', () => {
  const estimate = estimateSheets([{ widthMm: 1000, heightMm: 1000, quantity: 5 }], 2750, 1850, 15)
  assert.equal(estimate.pieceAreaM2, 5)
  assert.equal(estimate.adjustedAreaM2, 5.75)
  assert.equal(estimate.estimatedSheets, 2)
})

test('calcula disponibilidade, comissão e tempo de trabalho', () => {
  assert.equal(availableStock(10, 3.5), 6.5)
  assert.equal(availableStock(2, 5), 0)
  assert.equal(calculateCommission(32500.7, 2), 650.01)
  assert.equal(minutesBetween(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T11:35:00Z')), 95)
})
