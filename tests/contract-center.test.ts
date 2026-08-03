import test from 'node:test'
import assert from 'node:assert/strict'
import { getContractCenterStatus, getContractReminderSequence } from '../lib/contract-center'

test('classifica corretamente o estado central do contrato', () => {
  const now = new Date('2026-08-10T12:00:00.000Z')
  assert.equal(getContractCenterStatus({ requirement: 'REQUIRED', now }), 'NOT_SENT')
  assert.equal(getContractCenterStatus({ requirement: 'OPTIONAL_LEGACY', now }), 'LEGACY')
  assert.equal(getContractCenterStatus({ requirement: 'REQUIRED', revisionRequiredAt: now, now }), 'NEEDS_REVISION')
  assert.equal(getContractCenterStatus({ requirement: 'REQUIRED', contract: { status: 'SENT', viewedAt: now }, now }), 'VIEWED')
  assert.equal(getContractCenterStatus({ requirement: 'REQUIRED', contract: { status: 'SIGNED', signedAt: now }, now }), 'SIGNED')
  assert.equal(getContractCenterStatus({ requirement: 'REQUIRED', contract: { status: 'SENT', expiresAt: '2026-08-09T12:00:00.000Z' }, now }), 'EXPIRED')
})

test('agenda lembretes de contrato nos dias 2, 5 e 7', () => {
  const sentAt = new Date('2026-08-01T12:00:00.000Z')
  assert.equal(getContractReminderSequence({ sentAt, reminderCount: 0, now: new Date('2026-08-03T12:00:00.000Z') }), 1)
  assert.equal(getContractReminderSequence({ sentAt, reminderCount: 1, now: new Date('2026-08-06T12:00:00.000Z') }), 2)
  assert.equal(getContractReminderSequence({ sentAt, reminderCount: 2, now: new Date('2026-08-08T12:00:00.000Z') }), 3)
  assert.equal(getContractReminderSequence({ sentAt, reminderCount: 3, now: new Date('2026-08-20T12:00:00.000Z') }), null)
})

test('não repete lembrete em menos de 24 horas', () => {
  const sentAt = new Date('2026-08-01T12:00:00.000Z')
  assert.equal(getContractReminderSequence({
    sentAt,
    reminderCount: 1,
    lastReminderAt: new Date('2026-08-06T08:00:00.000Z'),
    now: new Date('2026-08-06T12:00:00.000Z'),
  }), null)
})
