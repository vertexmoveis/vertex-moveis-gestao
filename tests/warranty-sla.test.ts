import test from 'node:test'
import assert from 'node:assert/strict'
import { warrantyDueAt } from '../lib/warranty'

test('garantia urgente vence no próximo dia útil', () => {
  const friday = new Date('2026-08-07T12:00:00.000Z')
  assert.equal(warrantyDueAt('URGENT', friday).toISOString(), '2026-08-10T12:00:00.000Z')
})

test('garantia alta conta dois dias úteis', () => {
  const friday = new Date('2026-08-07T12:00:00.000Z')
  assert.equal(warrantyDueAt('HIGH', friday).toISOString(), '2026-08-11T12:00:00.000Z')
})

test('garantia normal conta cinco dias úteis', () => {
  const monday = new Date('2026-08-03T12:00:00.000Z')
  assert.equal(warrantyDueAt('NORMAL', monday).toISOString(), '2026-08-10T12:00:00.000Z')
})
