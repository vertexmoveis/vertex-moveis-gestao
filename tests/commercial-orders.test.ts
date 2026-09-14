import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { commercialOrdersQuery, type CommercialInput } from '../lib/commercial-orders'
import type { CommercialResult } from '../lib/commercial-order-types'

test('commercial list deduplicates requests, preserves alternatives and scopes every view', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`
      CREATE TABLE "User" (id text PRIMARY KEY, name text);
      CREATE TABLE "Client" (id text PRIMARY KEY, name text);
      CREATE TABLE "QuoteRequest" (id text PRIMARY KEY, title text, "clientId" text, "assignedToId" text, "createdById" text, status text, "dueDate" timestamp, "updatedAt" timestamp, environments text);
      CREATE TABLE "QuoteGroup" (id text PRIMARY KEY, title text, "clientId" text, "createdById" text, "requestId" text, "updatedAt" timestamp);
      CREATE TABLE "Quote" (id text PRIMARY KEY, "groupId" text, status text, total numeric, "validUntil" timestamp, "updatedAt" timestamp, "archivedAt" timestamp, "variationOrder" int, number int, "variationName" text, "convertedProjectId" text);
      CREATE TABLE "Project" (id text PRIMARY KEY, "managerId" text, "archivedAt" timestamp);
      INSERT INTO "User" VALUES ('a','Ana'),('b','Bruno');
      INSERT INTO "Client" VALUES ('c','Cliente um'),('d','Cliente dois');
      INSERT INTO "Project" VALUES ('p','b',NULL);
      INSERT INTO "QuoteRequest" VALUES
        ('r','Cozinha','c','a','a','IN_PROGRESS','2026-09-10','2026-09-14','Cozinha'),
        ('restricted','Pedido restrito','c','a','b','IN_PROGRESS','2026-09-10','2026-09-14','Sala'),
        ('cancelled','Pedido cancelado','c','a','a','CANCELLED','2026-09-10','2026-09-14','Sala'),
        ('ready','Pronto','c','a','a','READY','2026-09-10','2026-09-14','Sala');
      INSERT INTO "QuoteGroup" VALUES
        ('g','Cozinha','c','a','r','2026-09-14'),
        ('secret','Confidencial','c','b','restricted','2026-09-14'),
        ('legacy','Orçamento legado','d','a',NULL,'2026-09-14'),
        ('archived','Arquivado','c','a',NULL,'2026-09-14');
      INSERT INTO "Quote" VALUES
        ('lost','g','LOST',100,'2026-09-10','2026-09-14',NULL,1,1,'Opção perdida',NULL),
        ('approved','g','APPROVED',200,'2026-09-20','2026-09-14',NULL,2,2,'Opção aceita',NULL),
        ('secret-q','secret','APPROVED',999999,'2026-09-20','2026-09-14',NULL,1,3,'Segredo',NULL),
        ('legacy-q','legacy','SOLD',300,NULL,'2026-09-14',NULL,1,4,'Padrão','p'),
        ('archived-q','archived','LOST',100,NULL,'2026-09-14','2026-09-14',1,5,'Padrão',NULL);
    `)
    const list = async (overrides: Partial<CommercialInput> = {}) => {
      const sql = commercialOrdersQuery({ userId: 'a', isAdmin: false, view: 'all', page: 1, pageSize: 20, today: new Date('2026-09-14T12:00:00Z'), ...overrides })
      const result = await db.query<{ result: CommercialResult }>(sql.text, sql.values)
      return result.rows[0].result
    }
    const all = await list()
    assert.equal(all.total, 5)
    assert.deepEqual(all.counts, { all: 5, active: 3, closed: 2 })
    assert.equal(all.items.filter(i => i.requestId === 'r').length, 1)
    assert.equal(all.items.find(i => i.quoteId === 'approved')?.variantCount, 2)
    assert.equal(all.items.find(i => i.quoteId === 'approved')?.amount, 200)
    const restricted = all.items.find(i => i.requestId === 'restricted')!
    assert.equal(restricted.restricted, true)
    assert.equal(restricted.amount, null)
    assert.equal(restricted.quoteId, null)
    assert.equal(all.items.find(i => i.quoteId === 'legacy-q')?.projectId, null)
    assert.equal((await list({ isAdmin: true })).items.find(i => i.quoteId === 'legacy-q')?.projectId, 'p')
    assert.equal((await list({ query: 'Segredo' })).total, 0)
    assert.equal((await list({ query: '2' })).items[0].quoteId, 'approved')
    assert.equal((await list({ clientId: 'd' })).total, 1)
    assert.equal((await list({ view: 'closed' })).total, 2)
    assert.equal((await list({ status: 'APPROVED' })).total, 1)
    assert.equal((await list({ archived: true })).total, 1)
    assert.equal((await list({ attention: 'late' })).total, 1)
    assert.equal((await list({ attention: 'ready' })).total, 1)
    assert.equal((await list({ userId: 'nobody' })).total, 0)
    await db.exec(`INSERT INTO "QuoteRequest" SELECT 'extra-'||n, 'Pedido '||n, 'c','a','a','RECEIVED','2026-09-20','2026-09-14','Sala' FROM generate_series(1,25) n`)
    const first = await list()
    const second = await list({ page: 2 })
    assert.equal(first.total, 30)
    assert.equal(first.items.length, 20)
    assert.equal(second.items.length, 10)
    assert.equal(new Set([...first.items, ...second.items].map(i => i.id)).size, 30)
    assert.deepEqual(first.counts, second.counts)
  } finally { await db.close() }
})
