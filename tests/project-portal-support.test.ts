import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canOpenPublicWarranty,
  publicChangeCanReceiveDecision,
  warrantyDeadline,
} from '../lib/project-portal-support'

test('permite assistência somente depois da conclusão e dentro da garantia', () => {
  const now = new Date('2026-08-07T12:00:00.000Z')
  assert.equal(canOpenPublicWarranty({ actualEndDate: null, warrantyEndsAt: null }, now), false)
  assert.equal(canOpenPublicWarranty({
    actualEndDate: new Date('2026-01-10T12:00:00.000Z'),
    warrantyEndsAt: new Date('2027-01-10T12:00:00.000Z'),
  }, now), true)
  assert.equal(canOpenPublicWarranty({
    actualEndDate: new Date('2024-01-10T12:00:00.000Z'),
    warrantyEndsAt: new Date('2025-01-10T12:00:00.000Z'),
  }, now), false)
})

test('calcula um ano de garantia quando o prazo ainda não foi gravado', () => {
  const deadline = warrantyDeadline({ actualEndDate: new Date('2026-04-15T12:00:00.000Z'), warrantyEndsAt: null })
  assert.equal(deadline?.getUTCFullYear(), 2027)
  assert.equal(deadline?.getUTCMonth(), 3)
  assert.equal(deadline?.getUTCDate(), 15)
})

test('alteração pública recebe resposta apenas quando foi enviada', () => {
  assert.equal(publicChangeCanReceiveDecision('SENT'), true)
  assert.equal(publicChangeCanReceiveDecision('DRAFT'), false)
  assert.equal(publicChangeCanReceiveDecision('CLIENT_APPROVED'), false)
  assert.equal(publicChangeCanReceiveDecision('APPROVED'), false)
})
