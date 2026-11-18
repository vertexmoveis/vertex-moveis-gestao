// Actual API lifecycle against fixed loopback fixtures only; no .env or production data.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(baseURL).port, '3229')
assert.equal(new URL(databaseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).port, '55449')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const evidence = new URL('../../finance-verification/project-portal/', import.meta.url)
const run = `project-portal-${Date.now().toString(36)}`
const password = 'Portal-Fictional-2026!'
const ids = {}, contexts = [], results = []
const labels = ['Aguardando início', 'Medição', 'Projetando', 'Projeto pronto', 'Colocando as cotas', 'Projeto aprovado', 'Enviando para produção', 'Em produção', 'Produção pronta', 'Transportando', 'Instalando', 'Pronto']

async function call(api, method, path, expected = 200) {
  const response = await api.fetch(path, { method, timeout: 120000 })
  const body = await response.json().catch(() => null)
  assert.equal(response.status(), expected, `${method} ${path}: unexpected response status`)
  return body
}
async function login(label) {
  const api = await request.newContext({ baseURL, timeout: 120000 })
  contexts.push(api)
  const csrf = await call(api, 'GET', '/api/auth/csrf')
  await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: `${run}-${label}@example.local`, password, json: 'true' } })
  assert.equal((await call(api, 'GET', '/api/auth/session')).user?.id, ids[label])
  return api
}
function pass(name) { results.push({ name }); console.log(`PASS ${name}`) }
function portalToken(url) {
  const parsed = new URL(url)
  assert.equal(parsed.origin, baseURL)
  assert.match(parsed.pathname, /^\/acompanhar\/[A-Za-z0-9_-]{43}$/)
  return parsed.pathname.split('/').at(-1)
}
async function verifyPublic(anonymous, url) {
  const response = await anonymous.get(url)
  assert.equal(response.status(), 200)
  assert.equal(new URL(response.url()).pathname, new URL(url).pathname)
  const html = await response.text()
  assert.ok(html.includes(`${run} cozinha para cliente fictício`))
  assert.ok(html.includes('Kelly fictícia do teste'))
  assert.ok(html.includes('Colocando as cotas'))
  const timeline = html.match(/<ol\b[\s\S]*?<\/ol>/)?.[0]
  assert.ok(timeline)
  assert.equal((timeline.match(/<li\b/g) || []).length, 12)
  for (const label of labels) assert.ok(timeline.includes(label), `missing public stage ${label}`)
  assert.ok(!html.includes(`${run}-PRIVATE-INTERNAL-NOTE`))
  assert.ok(!html.includes('124567.89'))
  assert.match(html, /name="robots" content="noindex, nofollow"/)
}

try {
  await mkdir(evidence, { recursive: true })
  const hash = await bcrypt.hash(password, 10)
  for (const label of ['manager', 'other']) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], name: `Pessoa fictícia ${label}`, email: `${run}-${label}@example.local`, password: hash, role: 'MANAGER' } })
  }
  ids.client = `${run}-client`
  await db.client.create({ data: { id: ids.client, name: 'Kelly fictícia do teste', managerId: ids.manager } })
  ids.project = `${run}-project`
  await db.project.create({ data: {
    id: ids.project, clientId: ids.client, managerId: ids.manager,
    name: `${run} cozinha para cliente fictício`, stage: 'DIMENSIONING', status: 'PROJECT_READY',
    value: 124567.89, internalNotes: `${run}-PRIVATE-INTERNAL-NOTE`,
    environments: { create: [{ name: 'Cozinha fictícia', status: 'PENDING', position: 0 }] },
  } })
  const manager = await login('manager'), other = await login('other')
  const anonymous = await request.newContext({ baseURL, timeout: 120000 })
  contexts.push(anonymous)
  const path = `/api/projects/${ids.project}/portal`
  await call(anonymous, 'POST', path, 401)
  await call(other, 'POST', path, 404)
  assert.equal(await db.projectPortalAccess.count({ where: { projectId: ids.project } }), 0)
  assert.deepEqual(await call(manager, 'GET', path), { active: false, url: null })
  pass('Anonymous and unrelated manager cannot create or revoke a project link')

  const first = await call(manager, 'POST', path, 201)
  assert.equal(first.active, true)
  const firstToken = portalToken(first.url)
  const firstAccess = await db.projectPortalAccess.findFirstOrThrow({ where: { projectId: ids.project } })
  assert.equal(Object.hasOwn(firstAccess, 'token'), false)
  assert.equal(firstAccess.tokenHash, createHash('sha256').update(firstToken).digest('hex'))
  assert.notEqual(firstAccess.tokenHash, firstToken)
  assert.ok(firstAccess.tokenEncrypted.startsWith('v1.'))
  assert.ok(!firstAccess.tokenEncrypted.includes(firstToken))
  assert.equal(firstAccess.revokedAt, null)
  assert.ok(firstAccess.expiresAt > new Date(Date.now() + 350 * 24 * 60 * 60 * 1000))
  const existing = await call(manager, 'GET', path)
  assert.equal(existing.active, true)
  assert.equal(existing.url, first.url)
  await verifyPublic(anonymous, first.url)
  assert.ok((await db.projectPortalAccess.findUniqueOrThrow({ where: { id: firstAccess.id } })).lastViewedAt)
  assert.equal(await db.activityLog.count({ where: { projectId: ids.project, action: 'Link de acompanhamento criado' } }), 1)
  pass('Actual POST creates encrypted access, GET recovers the same link, anonymous client sees the correct twelve-stage project')

  const second = await call(manager, 'POST', path, 201)
  const secondToken = portalToken(second.url)
  assert.notEqual(secondToken, firstToken)
  assert.ok((await db.projectPortalAccess.findUniqueOrThrow({ where: { id: firstAccess.id } })).revokedAt)
  assert.equal((await anonymous.get(first.url)).status(), 404)
  assert.equal((await call(manager, 'GET', path)).url, second.url)
  await verifyPublic(anonymous, second.url)
  assert.equal(await db.projectPortalAccess.count({ where: { projectId: ids.project, revokedAt: null } }), 1)
  assert.equal(await db.activityLog.count({ where: { projectId: ids.project, action: 'Link de acompanhamento criado' } }), 2)
  pass('Explicit renewal revokes the old URL and preserves one working current URL')

  await call(other, 'DELETE', path, 404)
  await call(anonymous, 'DELETE', path, 401)
  assert.equal((await anonymous.get(second.url)).status(), 200)
  assert.deepEqual(await call(manager, 'DELETE', path), { success: true })
  assert.equal((await anonymous.get(second.url)).status(), 404)
  assert.deepEqual(await call(manager, 'GET', path), { active: false, url: null })
  assert.equal(await db.projectPortalAccess.count({ where: { projectId: ids.project, revokedAt: null } }), 0)
  pass('Only the responsible manager can revoke access and revoked links return 404 without login')
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'passed', results }, null, 2))
} catch (error) {
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'failed', results, error: error.stack || String(error) }, null, 2))
  throw error
} finally {
  for (const context of contexts) await context.dispose()
  await db.$disconnect()
}
