import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLIENT_RELATIONSHIP_STAGES,
  classifyClientRelationship,
  clientAttentionLevel,
  clientIdentityData,
} from '@/lib/client-relationship'

test('classifica contato sem orçamento nem projeto', () => {
  assert.equal(
    classifyClientRelationship({
      hasProject: false,
      quoteStatuses: [],
    }),
    CLIENT_RELATIONSHIP_STAGES.CONTACT,
  )
})

test('classifica orçamento aberto como negociação', () => {
  for (const status of ['DRAFT', 'SENT', 'WAITING_APPROVAL']) {
    assert.equal(
      classifyClientRelationship({
        hasProject: false,
        quoteStatuses: [status],
      }),
      CLIENT_RELATIONSHIP_STAGES.NEGOTIATING,
    )
  }
})

test('classifica aprovação, venda ou projeto como cliente', () => {
  assert.equal(
    classifyClientRelationship({ hasProject: false, quoteStatuses: ['APPROVED'] }),
    CLIENT_RELATIONSHIP_STAGES.CUSTOMER,
  )
  assert.equal(
    classifyClientRelationship({ hasProject: false, quoteStatuses: ['SOLD'] }),
    CLIENT_RELATIONSHIP_STAGES.CUSTOMER,
  )
  assert.equal(
    classifyClientRelationship({ hasProject: true, quoteStatuses: [] }),
    CLIENT_RELATIONSHIP_STAGES.CUSTOMER,
  )
})

test('cliente não é rebaixado automaticamente', () => {
  assert.equal(
    classifyClientRelationship({
      currentStage: CLIENT_RELATIONSHIP_STAGES.CUSTOMER,
      hasProject: false,
      quoteStatuses: ['LOST'],
    }),
    CLIENT_RELATIONSHIP_STAGES.CUSTOMER,
  )
})

test('classifica somente propostas encerradas como inativo', () => {
  assert.equal(
    classifyClientRelationship({ hasProject: false, quoteStatuses: ['LOST'] }),
    CLIENT_RELATIONSHIP_STAGES.INACTIVE,
  )
})

test('contato reativado não volta a inativo por causa de proposta antiga', () => {
  assert.equal(
    classifyClientRelationship({
      currentStage: CLIENT_RELATIONSHIP_STAGES.CONTACT,
      hasProject: false,
      quoteStatuses: ['LOST'],
    }),
    CLIENT_RELATIONSHIP_STAGES.CONTACT,
  )
})

test('normaliza documento, telefones e email para detectar duplicidade', () => {
  assert.deepEqual(
    clientIdentityData({
      document: '39.778.558/0001-38',
      phone: '(11) 94313-1992',
      whatsapp: '11 99999-0000',
      email: '  CLIENTE@Email.COM ',
    }),
    {
      documentNormalized: '39778558000138',
      phoneNormalized: '11943131992',
      whatsappNormalized: '11999990000',
      emailNormalized: 'cliente@email.com',
    },
  )
})

test('avisa sem retorno e sugere encerramento nos prazos configurados', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

  assert.equal(
    clientAttentionLevel('NEGOTIATING', daysAgo(10), {
      noResponseDays: 30,
      closeSuggestionDays: 90,
    }),
    null,
  )
  assert.equal(
    clientAttentionLevel('NEGOTIATING', daysAgo(35), {
      noResponseDays: 30,
      closeSuggestionDays: 90,
    })?.code,
    'NO_RESPONSE',
  )
  assert.equal(
    clientAttentionLevel('NEGOTIATING', daysAgo(95), {
      noResponseDays: 30,
      closeSuggestionDays: 90,
    })?.code,
    'CLOSE_SUGGESTED',
  )
  assert.equal(
    clientAttentionLevel('CUSTOMER', daysAgo(200), {
      noResponseDays: 30,
      closeSuggestionDays: 90,
    }),
    null,
  )
})

test('migração comercial é aditiva e não remove registros', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(
    new URL('../prisma/migrations/20260729160000_client_relationship_stages/migration.sql', import.meta.url),
    'utf8',
  )

  assert.match(sql, /ADD COLUMN "relationshipStage"/)
  assert.match(sql, /UPDATE "Client"/)
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+"Client"/i)
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b/i)
})

test('gerente pode editar apenas clientes dentro do próprio escopo', async () => {
  const { readFile } = await import('node:fs/promises')
  const route = await readFile(
    new URL('../app/api/clients/[id]/route.ts', import.meta.url),
    'utf8',
  )

  assert.match(route, /requireRole\(\['ADMIN', 'MANAGER'\]\)/)
  assert.match(route, /findFirst\(\{\s*where: clientWhereForUser\(auth\.user, \{ id \}\)/)
  assert.match(route, /auth\.user\.role === 'ADMIN' \? parsed\.data : managerSafeData/)
})
