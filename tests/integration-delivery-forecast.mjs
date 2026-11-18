// Fixed loopback fixtures only. No production credentials or environment files.
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request } from '@playwright/test'
const baseURL = 'http://127.0.0.1:3229'
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30' } } })
const run = `month-forecast-${Date.now().toString(36)}`, contexts = [], ids = {}
const password = 'Month-Fixture-2026!'
async function call(api, method, path, data, status = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }), timeout: 120000 })
  assert.equal(response.status(), status, `${method} ${path}: unexpected status`)
  return response.json()
}
async function login(label) {
  const api = await request.newContext({ baseURL, timeout: 120000 }); contexts.push(api)
  const csrf = await call(api, 'GET', '/api/auth/csrf')
  await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: `${run}-${label}@example.local`, password, json: 'true' } })
  assert.equal((await call(api, 'GET', '/api/auth/session')).user?.id, ids[label])
  return api
}
try {
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['other', 'MANAGER'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], email: `${run}-${label}@example.local`, name: 'Pessoa fictícia', role, password: hash } })
  }
  const client = await db.client.create({ data: { name: `${run} cliente`, managerId: ids.manager } })
  const project = await db.project.create({ data: {
    name: `${run} cozinha`, clientId: client.id, managerId: ids.manager, stage: 'DESIGN', workflowVersion: 2,
    deliveryDeadlineDate: new Date('2026-12-16T12:00:00Z'), estimatedEndDate: new Date('2026-12-16T12:00:00Z'),
    approvalDate: new Date('2026-11-04T12:00:00Z'), value: 10000, downPayment: 3000,
    environments: { create: [{ name: 'Cozinha fictícia', status: 'PENDING', position: 0 }] },
    payments: { create: [{ type: 'DOWN_PAYMENT', installmentNumber: 0, amount: 3000, dueDate: new Date('2026-11-04T12:00:00Z') }] },
  } })
  const manager = await login('manager'), other = await login('other'), viewer = await login('viewer')
  const anonymous = await request.newContext({ baseURL, timeout: 120000 }); contexts.push(anonymous)
  const path = `/api/projects/${project.id}`
  const patch = { deliveryForecastMonth: '2027-01' }
  await call(anonymous, 'PATCH', path, patch, 401)
  await call(other, 'PATCH', path, patch, 403)
  await db.project.update({ where: { id: project.id }, data: { managerId: ids.viewer } })
  await call(viewer, 'PATCH', path, patch, 403)
  await db.project.update({ where: { id: project.id }, data: { managerId: ids.manager } })
  for (const month of ['2027-00', '2027-13', '2027-01-01', '0000-01', '2027-1', '']) await call(manager, 'PATCH', path, { deliveryForecastMonth: month }, 400)
  const before = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { payments: true } })
  assert.equal((await call(manager, 'PATCH', path, patch)).deliveryForecastMonth, '2027-01')
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { payments: true } })
  for (const key of ['deliveryDeadlineDate', 'estimatedEndDate', 'approvalDate', 'stage', 'value', 'downPayment', 'actualEndDate', 'technicalApprovedAt', 'payments']) assert.deepEqual(after[key], before[key])
  assert.equal(await db.financeReceipt.count({ where: { projectId: project.id } }), 0)
  assert.equal((await call(manager, 'GET', path)).deliveryForecastMonth, '2027-01')
  assert.equal(await db.timelineEvent.count({ where: { projectId: project.id, event: 'Previsão de entrega atualizada' } }), 1)
  console.log('PASS month validation, scoped writes, persistence and unchanged financial/contract dates')
  const portal = await call(manager, 'POST', `${path}/portal`, undefined, 201)
  const publicResponse = await anonymous.get(portal.url)
  assert.equal(publicResponse.status(), 200)
  const html = await publicResponse.text()
  assert.ok(html.includes('janeiro de 2027') && html.includes('dia a definir'))
  assert.ok(!html.includes('16/12/2026') && !html.includes('01/01/2027') && !html.includes('31/01/2027'))
  console.log('PASS anonymous forecast shows January without a promised day')
  const schedule = await db.installationSchedule.create({ data: { projectId: project.id, scheduledStart: new Date('2027-01-15T13:00:00Z'), scheduledEnd: new Date('2027-01-15T15:00:00Z') } })
  const january = await (await manager.get('/dashboard/calendar?month=2027-01')).text()
  assert.ok(january.includes('Previsões sem dia definido') && january.includes(project.name))
  assert.ok(!january.includes(`${project.id}:deadline`))
  assert.ok(january.includes(`${schedule.id}:installation`))
  const december = await (await manager.get('/dashboard/calendar?month=2026-12')).text()
  assert.ok(!december.includes(`${project.id}:deadline`))
  const board = await (await manager.get('/dashboard/production')).text()
  assert.ok(board.includes('janeiro de 2027') && board.includes('Dia a definir'))
  console.log('PASS calendar lists the month without inventing a day and keeps real installation dates')
  await call(manager, 'PATCH', path, { deliveryForecastMonth: null })
  const fallback = await (await anonymous.get(portal.url)).text()
  assert.equal((await call(manager, 'GET', path)).deliveryForecastMonth, null)
  assert.ok(fallback.includes('16/12/2026') && !fallback.includes('janeiro de 2027 — dia a definir'))
  console.log('PASS clearing the month restores the previous precise forecast')
} finally {
  for (const api of contexts) await api.dispose()
  await db.$disconnect()
}
