import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deliveryForecastMonthLabel,
  formatDeliveryForecastMonth,
  isDeliveryForecastMonth,
  isDeliveryForecastMonthOverdue,
} from '../lib/delivery-forecast'
import { projectPatchSchema } from '../lib/schemas'

test('previsão mensal aceita apenas ano positivo com quatro dígitos e mês válido', () => {
  for (const value of ['2027-01', '2026-12', '0001-02', '9999-12']) assert.equal(isDeliveryForecastMonth(value), true)
  for (const value of [null, undefined, '', '0000-01', '2027-00', '2027-13', '2027-1', '27-01', '2027-01-01', '2027-01T12:00:00Z', ' 2027-01 ', 202701]) assert.equal(isDeliveryForecastMonth(value), false)
})

test('previsão mensal mostra o mês e deixa explícito que o dia não foi definido', () => {
  assert.equal(formatDeliveryForecastMonth('2027-01'), 'janeiro de 2027')
  assert.equal(formatDeliveryForecastMonth('2027-03'), 'março de 2027')
  assert.equal(deliveryForecastMonthLabel('2027-01'), 'janeiro de 2027 — dia a definir')
  assert.equal(formatDeliveryForecastMonth('2027-13'), null)
  assert.equal(deliveryForecastMonthLabel(null), null)
})

test('previsão mensal só vence após terminar o mês no horário de São Paulo', () => {
  assert.equal(isDeliveryForecastMonthOverdue('2027-01', new Date('2027-01-01T03:00:00Z')), false)
  assert.equal(isDeliveryForecastMonthOverdue('2027-01', new Date('2027-02-01T02:59:59.999Z')), false)
  assert.equal(isDeliveryForecastMonthOverdue('2027-01', new Date('2027-02-01T03:00:00Z')), true)
  assert.equal(isDeliveryForecastMonthOverdue('2027-01', new Date('2026-12-01T12:00:00Z')), false)
  assert.equal(isDeliveryForecastMonthOverdue(null, new Date()), false)
  assert.equal(isDeliveryForecastMonthOverdue('2027-01', new Date('invalid')), false)
})

test('PATCH altera somente o mês informado e permite remover a previsão com null', () => {
  assert.deepEqual(projectPatchSchema.parse({ deliveryForecastMonth: '2027-01' }), { deliveryForecastMonth: '2027-01' })
  assert.deepEqual(projectPatchSchema.parse({ deliveryForecastMonth: null }), { deliveryForecastMonth: null })
  assert.deepEqual(projectPatchSchema.parse({ stage: 'DESIGN' }), { stage: 'DESIGN' })
  for (const value of ['', '2027-13', '2027-01-01', 202701]) assert.equal(projectPatchSchema.safeParse({ deliveryForecastMonth: value }).success, false)
  assert.equal(projectPatchSchema.safeParse({ deliveryForecastMonth: '2027-01', estimatedEndDate: '2027-01-01' }).success, false)
})
