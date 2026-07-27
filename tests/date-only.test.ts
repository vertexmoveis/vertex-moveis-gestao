import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dateOnlyKey,
  endOfDateInTimeZone,
  formatDateOnly,
  isDateOnlyExpired,
  startOfDateInTimeZone,
  toDateOnlyUtc,
} from '@/lib/date-only'

test('datas de vencimento não recuam por causa do fuso horário', () => {
  const date = toDateOnlyUtc('2026-06-30')
  assert.equal(dateOnlyKey(date), '2026-06-30')
  assert.equal(formatDateOnly(date), '30/06/2026')
})

test('a proposta continua válida durante todo o dia informado em São Paulo', () => {
  assert.equal(isDateOnlyExpired('2026-07-17', new Date('2026-07-18T01:30:00.000Z')), false)
  assert.equal(isDateOnlyExpired('2026-07-17', new Date('2026-07-18T03:01:00.000Z')), true)
})

test('limites do dia usam explicitamente o horário de São Paulo', () => {
  assert.equal(
    startOfDateInTimeZone('2026-07-27')?.toISOString(),
    '2026-07-27T03:00:00.000Z',
  )
  assert.equal(
    endOfDateInTimeZone('2026-07-27')?.toISOString(),
    '2026-07-28T02:59:59.999Z',
  )
})
