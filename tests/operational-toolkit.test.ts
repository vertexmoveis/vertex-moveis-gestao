import test from 'node:test'
import assert from 'node:assert/strict'
import {
  availableStock,
  calculateProductionWeight,
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

test('calcula a disponibilidade do estoque', () => {
  assert.equal(availableStock(10, 3.5), 6.5)
  assert.equal(availableStock(2, 5), 0)
})
