import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatDashboardDate,
  getDashboardGreeting,
} from '../lib/dashboard-local-time'

test('usa o horário de São Paulo na saudação do Dashboard', () => {
  assert.equal(getDashboardGreeting(new Date('2026-07-28T14:59:00.000Z')), 'Bom dia')
  assert.equal(getDashboardGreeting(new Date('2026-07-28T15:00:00.000Z')), 'Boa tarde')
  assert.equal(getDashboardGreeting(new Date('2026-07-28T18:04:00.000Z')), 'Boa tarde')
  assert.equal(getDashboardGreeting(new Date('2026-07-28T21:00:00.000Z')), 'Boa noite')
})

test('mantém a data de São Paulo perto da meia-noite', () => {
  assert.equal(
    formatDashboardDate(new Date('2026-07-29T02:30:00.000Z')),
    'terça-feira, 28 de julho',
  )
})
