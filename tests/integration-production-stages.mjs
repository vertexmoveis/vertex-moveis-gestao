// Fixed loopback runtime and fictional records only; never loads .env or production data.
import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request, chromium, expect } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(baseURL).port, '3229')
assert.equal(new URL(databaseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).port, '55449')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const stages = [
  ['PENDING_START', 'Aguardando início'], ['MEASUREMENT', 'Medição'],
  ['DESIGN', 'Projetando'], ['PROJECT_READY', 'Projeto pronto'],
  ['DIMENSIONING', 'Colocando as cotas'], ['PROJECT_APPROVED', 'Projeto aprovado'],
  ['SENDING_TO_PRODUCTION', 'Enviando para produção'], ['PRODUCTION', 'Em produção'],
  ['PRODUCTION_READY', 'Produção pronta'], ['TRANSPORTATION', 'Transportando'],
  ['INSTALLATION', 'Instalando'], ['COMPLETED', 'Pronto'],
]
const evidence = new URL('../../finance-verification/production-stages/', import.meta.url)
const run = `production-stages-${Date.now().toString(36)}`
const password = 'Stages-Fictional-2026!'
const saleDate = new Date('2026-11-01T12:00:00.000Z')
const ids = {}, contexts = [], results = []
let browser

async function call(api, method, path, data, expected = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }), timeout: 120_000 })
  const body = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 300) }))
  assert.equal(response.status(), expected, `${method} ${path}: ${JSON.stringify(body).slice(0, 1000)}`)
  return body
}
async function login(label) {
  const api = await request.newContext({ baseURL, timeout: 120_000 })
  contexts.push(api)
  const csrf = await call(api, 'GET', '/api/auth/csrf')
  const response = await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: `${run}-${label}@example.local`, password, json: 'true' } })
  assert.equal(response.status(), 200)
  assert.equal((await call(api, 'GET', '/api/auth/session')).user?.id, ids[label])
  return api
}
async function project(label, stage = 'PENDING_START') {
  return db.project.create({ data: {
    id: `${run}-${label}`, name: `${run} ${label}`, clientId: ids.client,
    managerId: ids.manager, stage, status: 'APPROVED', workflowVersion: 2,
    approvalDate: saleDate, value: 10000, downPayment: 10000, initialPaymentRequired: true,
    paymentMethod: 'PIX', contractRequirement: 'REQUIRED',
    payments: { create: [{ type: 'DOWN_PAYMENT', installmentNumber: 0, amount: 10000, dueDate: saleDate, paidAt: null }] },
    environments: { create: [{ name: 'Cozinha não detalhada', position: 0, status: 'PENDING' }] },
  } })
}
async function honestRecords(id, completed = false) {
  const row = await db.project.findUniqueOrThrow({ where: { id }, include: { payments: true, contracts: true, files: true, environments: true, financeReceipts: true } })
  assert.equal(row.approvalDate?.toISOString(), saleDate.toISOString())
  assert.equal(row.paymentConfirmedAt, null)
  assert.equal(row.technicalApprovedAt, null)
  assert.equal(row.technicalApprovalSnapshot, null)
  assert.equal(row.contractRequirement, 'REQUIRED')
  assert.equal(row.contracts.length, 0)
  assert.equal(row.files.length, 0)
  assert.equal(row.financeReceipts.length, 0)
  assert.ok(row.payments.every(p => p.paidAt === null))
  assert.ok(row.environments.every(e => e.status === 'PENDING' && e.completedAt === null))
  assert.equal(Boolean(row.actualEndDate), completed)
  assert.equal(Boolean(row.postSaleFollowUpAt), completed)
  assert.equal(Boolean(row.warrantyEndsAt), completed)
  return row
}
function pass(name, details = {}) { results.push({ name, details }); console.log(`PASS ${name}`) }
function cardFor(page, name) { return page.locator('article').filter({ has: page.getByRole('link', { name, exact: true }) }) }
async function moveCard(page, item, direction, expectedStage) {
  const card = cardFor(page, item.name)
  await card.scrollIntoViewIfNeeded()
  const details = card.locator('details')
  if (await details.getAttribute('open') === null) await details.locator('summary').click()
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/projects/${item.id}`) && r.request().method() === 'PATCH'),
    card.getByRole('button', { name: direction === 1 ? 'Avançar etapa' : 'Voltar etapa', exact: true }).click(),
  ])
  assert.equal(response.status(), 200)
  await expect.poll(async () => (await db.project.findUniqueOrThrow({ where: { id: item.id } })).stage).toBe(expectedStage)
}
async function dragToDesign(page, item) {
  const board = page.getByRole('region', { name: 'Quadro de produção: role horizontalmente para ver todas as etapas', exact: true })
  await board.evaluate(el => { el.scrollLeft = 0 })
  const handle = cardFor(page, item.name).getByRole('button', { name: `Mover ${item.name}`, exact: true })
  await handle.scrollIntoViewIfNeeded()
  const target = page.getByRole('region', { name: 'Projetos em Projetando', exact: true })
  const from = await handle.boundingBox(), to = await target.boundingBox()
  assert.ok(from && to)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 100), { steps: 15 })
  await page.mouse.up()
  await expect(page.getByRole('dialog', { name: 'Confirmar mudança de etapa' })).toBeVisible()
}

try {
  await mkdir(evidence, { recursive: true })
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['other', 'MANAGER'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], name: `Pessoa fictícia ${label}`, email: `${run}-${label}@example.local`, password: hash, role } })
  }
  ids.client = `${run}-client`
  await db.client.create({ data: { id: ids.client, managerId: ids.manager, name: 'Cliente fictício: doze etapas' } })
  const manager = await login('manager'), other = await login('other'), viewer = await login('viewer')
  const anonymous = await request.newContext({ baseURL }); contexts.push(anonymous)
  const apiProject = await project('api')
  await call(anonymous, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'DIMENSIONING' }, 401)
  await call(other, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'DIMENSIONING' }, 403)
  await call(viewer, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'DIMENSIONING' }, 403)
  await call(manager, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'MADE_UP_STAGE' }, 400)
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: apiProject.id } })).stage, 'PENDING_START')
  const viewerOwned = await project('visualizador-responsavel')
  await db.project.update({ where: { id: viewerOwned.id }, data: { managerId: ids.viewer } })
  await call(viewer, 'GET', `/api/projects/${viewerOwned.id}`)
  await call(viewer, 'PATCH', `/api/projects/${viewerOwned.id}`, { stage: 'DIMENSIONING' }, 403)
  const viewerSchedule = await db.installationSchedule.create({ data: {
    projectId: viewerOwned.id, scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    scheduledEnd: new Date(Date.now() + 26 * 60 * 60 * 1000),
  } })
  await call(viewer, 'PATCH', `/api/operations/schedules/${viewerSchedule.id}`, {
    projectId: viewerOwned.id, scheduledStart: viewerSchedule.scheduledStart.toISOString(),
    scheduledEnd: viewerSchedule.scheduledEnd.toISOString(), status: 'ON_ROUTE',
  }, 403)
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: viewerOwned.id } })).stage, 'PENDING_START')
  assert.equal((await db.installationSchedule.findUniqueOrThrow({ where: { id: viewerSchedule.id } })).status, 'SCHEDULED')
  pass('Novas etapas mantêm autenticação, escopo do gerente e rejeição de código desconhecido')

  for (const [stage] of stages) {
    const patched = await call(manager, 'PATCH', `/api/projects/${apiProject.id}`, { stage })
    assert.equal(patched.stage, stage)
    const persisted = await call(manager, 'GET', `/api/projects/${apiProject.id}`)
    assert.equal(persisted.stage, stage)
    assert.deepEqual(persisted.workflow.blockers, [])
    const row = await honestRecords(apiProject.id, stage === 'COMPLETED')
    if (stage === 'COMPLETED') {
      assert.equal(row.status, 'COMPLETED')
      assert.ok(row.postSaleFollowUpAt > row.actualEndDate)
      assert.ok(row.warrantyEndsAt > row.postSaleFollowUpAt)
    }
  }
  assert.equal(await db.timelineEvent.count({ where: { projectId: apiProject.id, event: 'Etapa atualizada' } }), 10)
  assert.equal(await db.timelineEvent.count({ where: { projectId: apiProject.id, event: 'Projeto concluído' } }), 1)
  pass('Doze etapas persistem sem fabricar aceites, recebimentos ou conclusão antecipada', { stages: stages.map(([stage]) => stage) })

  const transport = await project('filtro-transporte', 'TRANSPORTATION')
  const install = await project('filtro-instalacao', 'INSTALLATION')
  const transportRows = await call(manager, 'GET', `/api/projects?stage=TRANSPORTATION&q=${encodeURIComponent(run)}`)
  const installRows = await call(manager, 'GET', `/api/projects?stage=INSTALLATION&q=${encodeURIComponent(run)}`)
  assert.deepEqual(transportRows.map(p => p.id), [transport.id])
  assert.deepEqual(installRows.map(p => p.id), [install.id])
  pass('Filtros de transporte e instalação são separados')

  const scheduleProject = await project('agenda', 'PRODUCTION_READY')
  const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const scheduledEnd = new Date(Date.parse(scheduledStart) + 2 * 60 * 60 * 1000).toISOString()
  const scheduleBody = { projectId: scheduleProject.id, scheduledStart, scheduledEnd }
  const schedule = await call(manager, 'POST', '/api/operations/schedules', scheduleBody, 201)
  for (const [status, expectedStage] of [['CONFIRMED', 'PRODUCTION_READY'], ['ON_ROUTE', 'TRANSPORTATION'], ['IN_PROGRESS', 'INSTALLATION']]) {
    await call(manager, 'PATCH', `/api/operations/schedules/${schedule.id}`, { ...scheduleBody, status })
    assert.equal((await honestRecords(scheduleProject.id)).stage, expectedStage)
  }
  await call(manager, 'PATCH', `/api/operations/schedules/${schedule.id}`, { ...scheduleBody, status: 'COMPLETED' }, 400)
  assert.equal((await honestRecords(scheduleProject.id)).stage, 'INSTALLATION')
  await call(manager, 'PATCH', `/api/operations/schedules/${schedule.id}`, { ...scheduleBody, status: 'COMPLETED', clientConfirmation: 'Recebedor fictício', deliveryChecklist: ['ITEMS', 'INSTALLATION', 'CLEANING', 'CLIENT'] })
  const proof = await db.projectDeliveryProof.findUniqueOrThrow({ where: { installationScheduleId: schedule.id } })
  assert.equal(proof.confirmedBy, 'Recebedor fictício')
  assert.equal((await honestRecords(scheduleProject.id, true)).stage, 'COMPLETED')
  pass('Agenda confirma sem mudar etapa, rota transporta, chegada instala e entrega mantém conferência')

  const uiProject = await project('navegador', 'PROJECT_READY')
  const dragProject = await project('salto-confirmado')
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'msedge' }), headless: true })
  const context = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), pageErrors = [], hydrationErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /hydrated|hydration|DndDescribedBy/i.test(message.text())) hydrationErrors.push(message.text())
  })
  await page.goto(`${baseURL}/dashboard/production`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const board = page.getByRole('region', { name: 'Quadro de produção: role horizontalmente para ver todas as etapas', exact: true })
  await expect(board).toBeVisible({ timeout: 60_000 })
  for (const [, label] of stages) await expect(board.getByRole('heading', { level: 2, name: label, exact: true })).toHaveCount(1)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true)
  assert.equal(await board.evaluate(el => el.scrollWidth > el.clientWidth), true)
  await dragToDesign(page, dragProject)
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: dragProject.id } })).stage, 'PENDING_START')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await dragToDesign(page, dragProject)
  const [skipResponse] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/projects/${dragProject.id}`) && r.request().method() === 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click(),
  ])
  assert.equal(skipResponse.status(), 200)
  await expect.poll(async () => (await db.project.findUniqueOrThrow({ where: { id: dragProject.id } })).stage).toBe('DESIGN')
  await moveCard(page, uiProject, 1, 'DIMENSIONING')
  await moveCard(page, uiProject, -1, 'PROJECT_READY')
  await moveCard(page, uiProject, 1, 'DIMENSIONING')
  await page.screenshot({ path: fileURLToPath(new URL('desktop-board.png', evidence)), fullPage: true })
  pass('Navegador desktop: doze colunas, rolagem interna, voltar/avançar e salto com confirmação')

  await page.goto(`${baseURL}/dashboard/projects/${uiProject.id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const workspace = page.getByLabel('Fluxo do projeto')
  await expect(workspace).toBeVisible({ timeout: 60_000 })
  for (const [stage, label] of stages.slice(5)) {
    const name = stage === 'COMPLETED' ? 'Finalizar projeto' : `Avançar para ${label}`
    const button = workspace.getByRole('button', { name, exact: true })
    await expect(button).toBeEnabled({ timeout: 30_000 })
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/projects/${uiProject.id}`) && r.request().method() === 'PATCH'),
      button.click(),
    ])
    assert.equal(response.status(), 200)
    await expect.poll(async () => (await db.project.findUniqueOrThrow({ where: { id: uiProject.id } })).stage).toBe(stage)
    await honestRecords(uiProject.id, stage === 'COMPLETED')
  }
  await workspace.screenshot({ path: fileURLToPath(new URL('detail-completed.png', evidence)) })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(hydrationErrors, [])
  pass('Detalhe avança cotas, aprovação, envio, fabricação, produção pronta, transporte, instalação e conclusão')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseURL}/dashboard/production`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(board).toBeVisible({ timeout: 60_000 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true)
  assert.equal(await board.evaluate(el => el.scrollWidth > el.clientWidth), true)
  await board.evaluate(el => { el.scrollLeft = el.scrollWidth })
  await expect(board.getByRole('heading', { level: 2, name: 'Pronto', exact: true })).toBeVisible()
  await page.screenshot({ path: fileURLToPath(new URL('mobile-board.png', evidence)), fullPage: true })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(hydrationErrors, [])
  pass('Navegador celular: todas as etapas acessíveis sem alargar a página')

  const portalToken = randomBytes(32).toString('base64url')
  await db.projectPortalAccess.create({ data: { projectId: transport.id, tokenHash: createHash('sha256').update(portalToken).digest('hex'), tokenEncrypted: 'fictional-fixture-not-used-for-public-lookup' } })
  await page.goto(`${baseURL}/acompanhar/${portalToken}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(page.getByRole('heading', { name: 'Andamento geral', exact: true })).toBeVisible({ timeout: 60_000 })
  const timeline = page.locator('ol')
  await expect(timeline.locator('li')).toHaveCount(12)
  for (const [, label] of stages) await expect(timeline.getByText(label, { exact: true })).toHaveCount(1)
  await expect(page.getByText('Transportando', { exact: true })).toHaveCount(2)
  const completedToken = randomBytes(32).toString('base64url')
  await db.projectPortalAccess.create({ data: { projectId: uiProject.id, tokenHash: createHash('sha256').update(completedToken).digest('hex'), tokenEncrypted: 'fictional-fixture-not-used-for-public-lookup' } })
  await page.goto(`${baseURL}/acompanhar/${completedToken}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(page.getByText('100%', { exact: true })).toHaveCount(2)
  await honestRecords(uiProject.id, true)
  pass('Acompanhamento do cliente mostra as doze etapas, transporte separado e conclusão em 100%')
  await context.close()
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'passed', results }, null, 2))
} catch (error) {
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'failed', results, error: error.stack || String(error) }, null, 2))
  throw error
} finally {
  if (browser) await browser.close()
  for (const context of contexts) await context.dispose()
  await db.$disconnect()
}
