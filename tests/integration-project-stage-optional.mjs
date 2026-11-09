// Fictional loopback-only verification. Start analysis/finance-verification/{start-db,run-app}.mjs.
// This script never loads .env or reads production data.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request, chromium, expect } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).port, '55449')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const evidence = new URL('../../finance-verification/optional-stage/', import.meta.url)
const run = `optional-stage-${Date.now().toString(36)}`
const password = 'Stage-Fictional-2026!'
const ids = {}, results = [], contexts = []
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
async function project(label, stage = 'PROJECT_READY', environments = true) {
  return db.project.create({ data: {
    id: `${run}-${label}`, name: `Cozinha fictícia ${label}`, clientId: ids.client,
    managerId: ids.manager, stage, status: 'IN_PROGRESS', workflowVersion: 2,
    value: 10000, downPayment: 10000, initialPaymentRequired: true,
    paymentMethod: 'PIX', contractRequirement: 'REQUIRED',
    payments: { create: [{ type: 'DOWN_PAYMENT', installmentNumber: 0, amount: 10000, dueDate: new Date(), paidAt: null }] },
    ...(environments ? { environments: { create: [{ name: 'Cozinha não detalhada', position: 0, status: 'PENDING' }] } } : {}),
  } })
}
async function unchangedCommercial(id) {
  const row = await db.project.findUniqueOrThrow({ where: { id }, include: { payments: true, contracts: true, files: true, environments: true, financeReceipts: true } })
  assert.equal(row.paymentConfirmedAt, null)
  assert.equal(row.technicalApprovedAt, null)
  assert.equal(row.technicalApprovalSnapshot, null)
  assert.equal(row.contractRequirement, 'REQUIRED')
  assert.equal(row.contracts.length, 0)
  assert.equal(row.files.length, 0)
  assert.equal(row.financeReceipts.length, 0)
  assert.ok(row.payments.every(p => p.paidAt === null))
  assert.ok(row.environments.every(e => e.status === 'PENDING' && e.completedAt === null))
  return row
}
function pass(name, details = {}) { results.push({ name, details }); console.log(`PASS ${name}`) }
try {
  await mkdir(evidence, { recursive: true })
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['other', 'MANAGER'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], name: `Pessoa fictícia ${label}`, email: `${run}-${label}@example.local`, password: hash, role } })
  }
  ids.client = `${run}-client`
  await db.client.create({ data: { id: ids.client, managerId: ids.manager, name: 'Cliente fictício: etapas opcionais' } })
  const apiProject = await project('api')
  const manager = await login('manager'), other = await login('other'), viewer = await login('viewer')
  const anonymous = await request.newContext({ baseURL }); contexts.push(anonymous)
  await call(anonymous, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'PRODUCTION' }, 401)
  await call(other, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'PRODUCTION' }, 403)
  await call(viewer, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'PRODUCTION' }, 403)
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: apiProject.id } })).stage, 'PROJECT_READY')
  pass('Acesso continua restrito: anônimo, outro gerente e visualizador não movem o pedido')
  const before = await call(manager, 'GET', `/api/projects/${apiProject.id}`)
  assert.deepEqual(before.workflow.blockers, [])
  assert.equal(before.workflow.financial.ready, false)
  assert.equal(before.workflow.contract.ready, false)
  assert.equal(before.environmentSummary.completed, 0)
  assert.equal(before.environmentSummary.total, 1)
  assert.equal((await call(manager, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'PRODUCTION' })).stage, 'PRODUCTION')
  await unchangedCommercial(apiProject.id)
  assert.equal((await call(manager, 'PATCH', `/api/projects/${apiProject.id}`, { stage: 'COMPLETED' })).stage, 'COMPLETED')
  const completed = await unchangedCommercial(apiProject.id)
  assert.equal(completed.stage, 'COMPLETED')
  assert.equal(completed.status, 'COMPLETED')
  assert.ok(completed.actualEndDate && completed.postSaleFollowUpAt && completed.warrantyEndsAt)
  assert.ok(completed.postSaleFollowUpAt > completed.actualEndDate)
  assert.ok(completed.warrantyEndsAt > completed.postSaleFollowUpAt)
  assert.equal(await db.timelineEvent.count({ where: { projectId: apiProject.id, event: 'Etapa atualizada' } }), 1)
  assert.equal(await db.timelineEvent.count({ where: { projectId: apiProject.id, event: 'Projeto concluído' } }), 1)
  const persisted = await call(manager, 'GET', `/api/projects/${apiProject.id}`)
  assert.equal(persisted.stage, 'COMPLETED')
  assert.equal(persisted.payments[0].paidAt, null)
  pass('API move0de1 para produção e conclusão; preserva pendências e agenda garantia/pós-venda', { actualEndDate: completed.actualEndDate })
  const emptyProject = await project('sem-ambientes', 'PENDING_START', false)
  await call(manager, 'PATCH', `/api/projects/${emptyProject.id}`, { stage: 'PROJECT_READY' })
  await call(manager, 'PATCH', `/api/projects/${emptyProject.id}`, { stage: 'COMPLETED' })
  await unchangedCommercial(emptyProject.id)
  pass('Sem ambientes e sem anexos permite Projeto pronto e conclusão direta')

  const uiProject = await project('navegador')
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'msedge' }), headless: true })
  const context = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(`${baseURL}/dashboard/production`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: uiProject.name, exact: true }) })
  await expect(card).toBeVisible({ timeout: 60_000 })
  await expect(card.getByText('Ambientes 0 de 1', { exact: true })).toBeVisible()
  await card.getByText('Ações do pedido', { exact: true }).click()
  const [uiMove] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/projects/${uiProject.id}`) && r.request().method() === 'PATCH'),
    card.getByRole('button', { name: 'Avançar etapa', exact: true }).click(),
  ])
  assert.equal(uiMove.status(), 200)
  await expect.poll(async () => (await db.project.findUniqueOrThrow({ where: { id: uiProject.id } })).stage).toBe('PRODUCTION')
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: fileURLToPath(new URL('kanban-after-advance.png', evidence)), fullPage: true })
  await page.goto(`${baseURL}/dashboard/projects/${uiProject.id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(page.getByText('A lista é de acompanhamento. Os registros são opcionais para mudar a etapa ou concluir o pedido.', { exact: true })).toBeVisible({ timeout: 60_000 })
  const workspace = page.getByLabel('Fluxo do projeto')
  await workspace.screenshot({ path: fileURLToPath(new URL('workspace-before-completion.png', evidence)) })
  const [installMove] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/projects/${uiProject.id}`) && r.request().method() === 'PATCH'),
    workspace.getByRole('button', { name: 'Pronto para instalar', exact: true }).click(),
  ])
  assert.equal(installMove.status(), 200)
  await expect(workspace.getByRole('button', { name: 'Finalizar projeto', exact: true })).toBeEnabled({ timeout: 30_000 })
  const [finishMove] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/projects/${uiProject.id}`) && r.request().method() === 'PATCH'),
    workspace.getByRole('button', { name: 'Finalizar projeto', exact: true }).click(),
  ])
  assert.equal(finishMove.status(), 200)
  await expect.poll(async () => (await db.project.findUniqueOrThrow({ where: { id: uiProject.id } })).stage).toBe('COMPLETED')
  await page.screenshot({ path: fileURLToPath(new URL('project-completed.png', evidence)), fullPage: true })
  await unchangedCommercial(uiProject.id)
  assert.deepEqual(pageErrors, [])
  pass('Navegador: cartão avança0de1 e detalhe finaliza sem preencher campos, sem erros de execução')
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
