import test from 'node:test'
import assert from 'node:assert/strict'
import { getProductionCapacityWeeks } from '../lib/production-capacity'

test('agrupa previsões de entrega por semana e sinaliza sobrecarga', () => {
  const weeks = getProductionCapacityWeeks([
    '2026-08-03',
    '2026-08-05',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
    '2026-08-10',
  ], 4, new Date('2026-08-03T12:00:00-03:00'), 2)

  assert.equal(weeks[0].scheduled, 5)
  assert.equal(weeks[0].state, 'OVERLOADED')
  assert.equal(weeks[1].scheduled, 1)
  assert.equal(weeks[1].state, 'AVAILABLE')
})

test('marca atenção quando a semana alcança oitenta por cento da capacidade', () => {
  const [week] = getProductionCapacityWeeks([
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
  ], 5, new Date('2026-08-03T12:00:00-03:00'), 1)

  assert.equal(week.usagePercent, 80)
  assert.equal(week.state, 'ATTENTION')
})

test('considera o peso de cada projeto na capacidade semanal', () => {
  const [week] = getProductionCapacityWeeks([
    { deadline: '2026-08-03', weight: 2.5 },
    { deadline: '2026-08-05', weight: 1.75 },
  ], 4, new Date('2026-08-03T12:00:00-03:00'), 1)

  assert.equal(week.scheduled, 4.25)
  assert.equal(week.state, 'OVERLOADED')
})

test('distribui a carga do projeto entre as semanas de fabricação', () => {
  const weeks = getProductionCapacityWeeks([
    { start: '2026-08-03', deadline: '2026-08-16', weight: 4 },
  ], 4, new Date('2026-08-03T12:00:00-03:00'), 2)

  assert.equal(weeks[0].scheduled, 2)
  assert.equal(weeks[1].scheduled, 2)
})
