// Isolated fictional projects on fixed loopback only; no production configuration.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request, chromium, expect } from '@playwright/test'
const baseURL = 'http://127.0.0.1:3229'
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=4&pool_timeout=30' } } })
const run = `rooms-${Date.now().toString(36)}`, ids = {}, contexts = []
const password = 'Rooms-Fixture-2026!'
const evidence = new URL('../../finance-verification/environment-workflow/', import.meta.url)
let browser
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
  await mkdir(evidence, { recursive: true })
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['other', 'MANAGER'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], email: `${run}-${label}@example.local`, name: 'Pessoa fictícia', role, password: hash } })
  }
  const client = await db.client.create({ data: { name: 'Cliente fictício de ambientes', managerId: ids.manager } })
  const project = await db.project.create({ data: { clientId: client.id, managerId: ids.manager, name: 'Casa fictícia de dois ambientes', room: 'Escopo comercial original', stage: 'DESIGN', workflowVersion: 2, value: 10000, downPayment: 3000, deliveryForecastMonth: '2027-01', deliveryDeadlineDate: new Date('2026-12-16T12:00:00Z'), estimatedEndDate: new Date('2026-12-16T12:00:00Z') } })
  const path = `/api/projects/${project.id}`
  const manager = await login('manager'), other = await login('other'), viewer = await login('viewer')
  const anonymous = await request.newContext({ baseURL, timeout: 120000 }); contexts.push(anonymous)
  await call(anonymous, 'POST', `${path}/environments`, { name: 'Cozinha' }, 401)
  await call(other, 'POST', `${path}/environments`, { name: 'Cozinha' }, 403)
  const kitchen = await call(manager, 'POST', `${path}/environments`, { name: 'Cozinha' }, 201)
  const bedroom = await call(manager, 'POST', `${path}/environments`, { name: 'Quarto' }, 201)
  await call(manager, 'POST', `${path}/environments`, { name: ' cozinha ' }, 409)
  await call(manager, 'POST', `${path}/environments`, { name: '' }, 400)
  const kitchenPath = `${path}/environments/${kitchen.id}`, bedroomPath = `${path}/environments/${bedroom.id}`
  await call(other, 'PATCH', kitchenPath, { workflowStage: 'DIMENSIONING' }, 403)
  await call(manager, 'PATCH', kitchenPath, { workflowStage: 'MADE_UP' }, 400)
  await call(manager, 'PATCH', kitchenPath, { workflowStage: 'DIMENSIONING', status: 'COMPLETED' }, 400)
  await db.project.update({ where: { id: project.id }, data: { managerId: ids.viewer } })
  await call(viewer, 'PATCH', kitchenPath, { workflowStage: 'DIMENSIONING' }, 403)
  await call(viewer, 'POST', `${path}/environments`, { name: 'Sala' }, 403)
  await db.project.update({ where: { id: project.id }, data: { managerId: ids.manager } })
  const initialProject = await db.project.findUniqueOrThrow({ where: { id: project.id } })
  await Promise.all([
    call(manager, 'PATCH', kitchenPath, { workflowStage: 'DIMENSIONING' }),
    call(manager, 'PATCH', bedroomPath, { workflowStage: 'DESIGN' }),
  ])
  let kitchenRow = await db.projectEnvironment.findUniqueOrThrow({ where: { id: kitchen.id } })
  assert.equal(kitchenRow.workflowStage, 'DIMENSIONING')
  assert.equal(kitchenRow.status, 'PENDING')
  assert.equal(kitchenRow.startedAt, null)
  const bedroomSnapshot = await db.projectEnvironment.findUniqueOrThrow({ where: { id: bedroom.id } })
  for (const stage of ['PROJECT_APPROVED', 'SENDING_TO_PRODUCTION', 'PRODUCTION', 'PRODUCTION_READY', 'TRANSPORTATION', 'INSTALLATION', 'COMPLETED']) {
    await call(manager, 'PATCH', kitchenPath, { workflowStage: stage })
    assert.deepEqual(await db.projectEnvironment.findUniqueOrThrow({ where: { id: bedroom.id } }), bedroomSnapshot)
  }
  kitchenRow = await db.projectEnvironment.findUniqueOrThrow({ where: { id: kitchen.id } })
  assert.equal(kitchenRow.status, 'COMPLETED'); assert.ok(kitchenRow.completedAt)
  assert.equal((await call(manager, 'GET', path)).environmentSummary.completed, 1)
  const afterProject = await db.project.findUniqueOrThrow({ where: { id: project.id } })
  for (const key of ['stage', 'room', 'value', 'downPayment', 'deliveryForecastMonth', 'deliveryDeadlineDate', 'estimatedEndDate', 'actualEndDate', 'postSaleFollowUpAt', 'warrantyEndsAt', 'technicalApprovedAt']) assert.deepEqual(afterProject[key], initialProject[key])
  assert.equal(await db.financeReceipt.count({ where: { projectId: project.id } }), 0)
  console.log('PASS rooms advance independently, preserve other rooms and do not complete or change the whole order')
  await call(manager, 'PATCH', kitchenPath, { workflowStage: 'DIMENSIONING' })
  assert.equal((await db.projectEnvironment.findUniqueOrThrow({ where: { id: kitchen.id } })).completedAt, null)
  await call(manager, 'PATCH', kitchenPath, { notes: 'private fixture note' })
  assert.equal((await db.projectEnvironment.findUniqueOrThrow({ where: { id: kitchen.id } })).workflowStage, 'DIMENSIONING')
  await call(manager, 'PATCH', bedroomPath, { name: 'Dormitório' })
  await call(manager, 'PATCH', bedroomPath, { name: 'COZINHA' }, 409)
  await call(manager, 'PATCH', path, { stage: 'PROJECT_READY' })
  assert.equal((await db.projectEnvironment.findUniqueOrThrow({ where: { id: bedroom.id } })).workflowStage, 'DESIGN')
  assert.equal((await db.projectEnvironment.findUniqueOrThrow({ where: { id: kitchen.id } })).workflowStage, 'DIMENSIONING')
  await call(manager, 'PATCH', path, { stage: 'DESIGN' })
  const portal = await call(manager, 'POST', `${path}/portal`, undefined, 201)
  const html = await (await anonymous.get(portal.url)).text()
  assert.ok(html.includes('Colocando as cotas') && html.includes('Dormitório') && html.includes('janeiro de 2027'))
  assert.ok(!html.includes('private fixture note'))
  console.log('PASS reopening, metadata, naming and public tracking keep each environment distinct')
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'msedge' }), headless: true })
  const context = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${baseURL}/dashboard/projects/${project.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const panel = page.getByRole('region', { name: 'Etapas dos ambientes', exact: true })
  await expect(panel).toBeVisible({ timeout: 60000 })
  for (const stage of ['PROJECT_READY', 'DIMENSIONING']) {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/environments/${kitchen.id}`) && r.request().method() === 'PATCH'),
      panel.getByRole('combobox', { name: 'Etapa de Cozinha', exact: true }).selectOption(stage),
    ])
    assert.equal(response.status(), 200)
    await expect(panel.getByRole('combobox', { name: 'Etapa de Cozinha', exact: true })).toHaveValue(stage)
    await expect(panel.getByRole('combobox', { name: 'Etapa de Dormitório', exact: true })).toHaveValue('DESIGN')
  }
  await panel.getByLabel('Novo ambiente', { exact: true }).fill('Lavanderia')
  await panel.getByRole('button', { name: 'Adicionar ambiente', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: 'Etapa de Lavanderia', exact: true })).toBeVisible()
  const laundry = panel.getByRole('article', { name: 'Ambiente Lavanderia', exact: true })
  await laundry.getByRole('button', { name: 'Renomear Lavanderia', exact: true }).click()
  await laundry.getByLabel('Nome do ambiente', { exact: true }).fill('Lavanderia de serviço')
  const [renamed] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/environments/') && r.request().method() === 'PATCH'),
    laundry.getByRole('button', { name: 'Salvar nome', exact: true }).click(),
  ])
  assert.equal(renamed.status(), 200)
  await expect(panel.getByRole('article', { name: 'Ambiente Lavanderia de serviço', exact: true })).toBeVisible()
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).room, initialProject.room)
  await panel.screenshot({ path: fileURLToPath(new URL('desktop-rooms.png', evidence)) })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true)
  await page.screenshot({ path: fileURLToPath(new URL('mobile-rooms.png', evidence)), fullPage: true })
  await context.close()
  console.log('PASS desktop and mobile controls update one room and add another without advancing the order')
} finally {
  if (browser) await browser.close()
  for (const api of contexts) await api.dispose()
  await db.$disconnect()
}
