// Real API verification for the loopback-only, in-memory runtime in
// analysis/finance-verification/README.md. This never loads application .env files.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const require = createRequire(import.meta.url)
const { request, chromium, expect } = require('@playwright/test')
const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(baseURL).port, '3229')
assert.equal(new URL(databaseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).port, '55449')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const evidenceRoot = new URL('../../finance-verification/', import.meta.url)
const run = `contract-edit-${Date.now().toString(36)}`
const password = 'Contract-Edit-Fictional-2026!'
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(part => [part.type, part.value]))
const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
const month = today.slice(0, 7)
const results = []
const contexts = []
const ids = {}
let browser

function pass(name, evidence = {}) {
  results.push({ name, evidence })
  console.log(`PASS ${name}`)
}

async function call(api, method, path, data, expected = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }), timeout: 120_000 })
  const body = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 500) }))
  const statuses = Array.isArray(expected) ? expected : [expected]
  assert.ok(statuses.includes(response.status()), `${method} ${path}: expected ${statuses.join('/')}, got ${response.status()}: ${JSON.stringify(body).slice(0, 1200)}`)
  return body
}

async function login(label, role) {
  const api = await request.newContext({ baseURL, timeout: 120_000 })
  contexts.push(api)
  const csrf = await call(api, 'GET', '/api/auth/csrf')
  const response = await api.post('/api/auth/callback/credentials', {
    form: { csrfToken: csrf.csrfToken, email: `${run}-${label}@example.local`, password, json: 'true' },
  })
  assert.equal(response.status(), 200)
  const session = await call(api, 'GET', '/api/auth/session')
  assert.equal(session.user?.id, ids[label])
  assert.equal(session.user?.role, role)
  return api
}

function form(label, extra = {}) {
  return {
    clientId: ids.client, title: `Cozinha ${run} ${label}`,
    description: `Armários planejados fictícios para verificação ${label}.`,
    value: 12000, paymentMethod: 'CARD', downPayment: 2000,
    downPaymentDate: today, installmentCount: 5, firstInstallmentDate: today,
    deliveryBusinessDays: 30, ...extra,
  }
}

async function create(api, input) {
  const created = await call(api, 'POST', '/api/contracts', input, 201)
  assert.ok(created.id)
  assert.equal(new URL(created.publicUrl).origin, baseURL)
  return { ...created, token: new URL(created.publicUrl).pathname.split('/').at(-1) }
}

const editPath = id => `/api/contracts/${id}`
const publicPath = token => `/api/public/contracts/${token}`
const reportPath = `/api/financeiro/report?month=${month}&q=${encodeURIComponent(run)}`

async function evidence(extra = {}) {
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(new URL('./contract-edit-results.json', evidenceRoot), JSON.stringify({
    run, baseURL, database: '127.0.0.1:55449 isolated in-memory', completedAt: new Date().toISOString(), results, ...extra,
  }, null, 2))
}

try {
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['otherManager', 'MANAGER'], ['admin', 'ADMIN'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], name: `Pessoa fictícia ${label}`, email: `${run}-${label.toLowerCase()}@example.local`, password: hash, role } })
  }
  ids.client = `${run}-client`
  ids.otherClient = `${run}-other-client`
  await db.client.createMany({ data: [
    { id: ids.client, name: `Paula fictícia ${run}`, managerId: ids.manager, document: '12345678901', street: 'Rua de Teste', number: '1', city: 'Cotia', state: 'SP', zipCode: '06702170' },
    { id: ids.otherClient, name: `Outro cliente fictício ${run}`, managerId: ids.otherManager },
  ] })
  await db.companyProfile.upsert({ where: { id: 'vertex' }, create: { id: 'vertex', tradeName: 'Empresa fictícia de verificação', legalName: 'Empresa fictícia de verificação', street: 'Rua de Teste', number: '2', city: 'Cotia', state: 'SP', zipCode: '06702170' }, update: {} })
  const manager = await login('manager', 'MANAGER')
  const otherManager = await login('otherManager', 'MANAGER')
  const admin = await login('admin', 'ADMIN')
  const viewer = await login('viewer', 'VIEWER')
  const anonymous = await request.newContext({ baseURL, timeout: 120_000 }); contexts.push(anonymous)

  const originalForm = form('original')
  const created = await create(manager, originalForm)
  await call(anonymous, 'GET', editPath(created.id), undefined, 401)
  await call(anonymous, 'PATCH', editPath(created.id), {}, 401)
  await call(viewer, 'GET', editPath(created.id), undefined, 403)
  await call(viewer, 'PATCH', editPath(created.id), {}, 403)
  await call(otherManager, 'GET', editPath(created.id), undefined, 404)
  const initial = await call(manager, 'GET', editPath(created.id))
  assert.deepEqual(initial.form, originalForm)
  assert.equal(initial.clientName, `Paula fictícia ${run}`)
  assert.equal(initial.version, 1)
  assert.equal((await call(admin, 'GET', editPath(created.id))).id, created.id)
  await call(otherManager, 'PATCH', editPath(created.id), { ...initial.form, updatedAt: initial.updatedAt }, 404)
  pass('Leitura preenche todos os campos reais; autenticação e proprietário são respeitados')

  await call(anonymous, 'GET', publicPath(created.token))
  await call(manager, 'PATCH', '/api/contracts', { contractId: created.id })
  const current = await call(manager, 'GET', editPath(created.id))
  assert.notEqual(current.updatedAt, initial.updatedAt)
  const priorRecord = await db.projectContract.findUniqueOrThrow({ where: { id: created.id } })
  const correctedForm = { ...current.form, title: `Cozinha corrigida ${run}`, description: 'Escopo fictício corrigido: cozinha com armários e bancada.', value: 14500, downPayment: 2500, installmentCount: 6, deliveryBusinessDays: 45 }
  const patch = { ...correctedForm, updatedAt: current.updatedAt }
  await call(manager, 'PATCH', editPath(created.id), { ...patch, updatedAt: initial.updatedAt }, 409)
  await call(manager, 'PATCH', editPath(created.id), { ...patch, updatedAt: undefined }, 400)
  for (const value of [0, -1, 12000.001]) await call(manager, 'PATCH', editPath(created.id), { ...patch, value }, 400)
  await call(manager, 'PATCH', editPath(created.id), { ...patch, downPayment: 14500 }, 400)
  await call(manager, 'PATCH', editPath(created.id), { ...patch, clientId: ids.otherClient }, 409)
  assert.equal((await db.projectContract.findUniqueOrThrow({ where: { id: created.id } })).voidedAt, null)
  pass('Revisão antiga e dados inválidos são rejeitados sem alterar o contrato')

  const saved = await call(manager, 'PATCH', editPath(created.id), patch, [200, 201])
  assert.ok(saved.id)
  assert.notEqual(saved.id, created.id)
  assert.equal(new URL(saved.publicUrl).origin, baseURL)
  const newToken = new URL(saved.publicUrl).pathname.split('/').at(-1)
  assert.notEqual(newToken, created.token)
  const oldRecord = await db.projectContract.findUniqueOrThrow({ where: { id: created.id } })
  const newRecord = await db.projectContract.findUniqueOrThrow({ where: { id: saved.id } })
  assert.equal(oldRecord.status, 'VOID')
  assert.ok(oldRecord.voidedAt)
  assert.deepEqual(oldRecord.snapshot, priorRecord.snapshot)
  assert.equal(oldRecord.viewedAt?.toISOString(), priorRecord.viewedAt?.toISOString())
  assert.equal(oldRecord.reminderCount, priorRecord.reminderCount)
  assert.equal(newRecord.version, 2)
  assert.equal(newRecord.status, 'SENT')
  assert.equal(newRecord.createdById, ids.manager)
  assert.equal(newRecord.projectId, null)
  assert.equal(newRecord.viewedAt, null)
  assert.equal(newRecord.lastReminderAt, null)
  assert.equal(newRecord.reminderCount, 0)
  assert.equal(newRecord.snapshot.project.name, correctedForm.title)
  assert.equal(newRecord.snapshot.project.value, correctedForm.value)
  assert.equal(newRecord.snapshot.project.deliveryBusinessDays, 45)
  assert.equal(newRecord.snapshot.payment.downPayment, 2500)
  assert.equal(newRecord.snapshot.payment.installmentCount, 6)
  assert.ok(JSON.stringify(newRecord.snapshot.project.scope).includes(correctedForm.description))
  assert.notEqual(newRecord.tokenHash, oldRecord.tokenHash)
  assert.ok(newRecord.expiresAt > new Date())
  assert.deepEqual((await call(manager, 'GET', editPath(saved.id))).form, correctedForm)
  await call(manager, 'GET', editPath(created.id), undefined, 409)
  await call(manager, 'PATCH', editPath(created.id), patch, 409)
  await call(anonymous, 'GET', publicPath(created.token), undefined, 410)
  await call(anonymous, 'GET', `${publicPath(created.token)}/document`, undefined, 410)
  const acceptance = { signatoryName: 'Paula Fictícia Teste', acceptedTerms: true }
  await call(anonymous, 'POST', publicPath(created.token), acceptance, 410)
  const publicNew = await call(anonymous, 'GET', publicPath(newToken))
  assert.equal(publicNew.snapshot.project.value, correctedForm.value)
  assert.equal(publicNew.version, 2)
  const afterEdit = await call(manager, 'GET', reportPath)
  assert.equal(afterEdit.negotiating.count, 1)
  assert.equal(afterEdit.negotiating.amount, correctedForm.value)
  assert.equal(afterEdit.negotiating.items[0].contractId, saved.id)
  assert.equal(afterEdit.sold.count, 0)
  assert.equal(afterEdit.lost.count, 0)
  assert.equal(afterEdit.potentialTotal, correctedForm.value)
  pass('Salvar cria versão 2 e novo link, preserva original e mostra só o valor corrigido no Financeiro', { originalId: created.id, replacementId: saved.id, value: correctedForm.value })

  await call(anonymous, 'POST', publicPath(newToken), acceptance)
  await call(manager, 'GET', editPath(saved.id), undefined, 409)
  await call(manager, 'PATCH', editPath(saved.id), patch, 409)
  const afterSign = await call(manager, 'GET', reportPath)
  assert.equal(afterSign.sold.count, 1)
  assert.equal(afterSign.sold.amount, correctedForm.value)
  assert.equal(afterSign.negotiating.count, 0)
  assert.equal(afterSign.lost.count, 0)
  pass('Cliente aceita somente a nova versão e contrato assinado bloqueia edição')

  const converted = await create(manager, form('convertido'))
  const convertedRevision = await call(manager, 'GET', editPath(converted.id))
  const project = await db.project.create({ data: { id: `${run}-converted-project`, clientId: ids.client, managerId: ids.manager, name: `Projeto fictício ${run}`, value: 12000, status: 'APPROVED', stage: 'PENDING_START', workflowVersion: 2, approvalDate: new Date() } })
  await db.projectContract.update({ where: { id: converted.id }, data: { projectId: project.id } })
  await call(manager, 'GET', editPath(converted.id), undefined, 409)
  await call(manager, 'PATCH', editPath(converted.id), { ...convertedRevision.form, updatedAt: convertedRevision.updatedAt }, 409)
  pass('Contrato já convertido em projeto bloqueia edição pelo fluxo avulso')

  const expired = await create(manager, form('expirado', { paymentMethod: 'PIX', downPayment: 0, installmentCount: 1 }))
  await db.projectContract.update({ where: { id: expired.id }, data: { expiresAt: new Date('2000-01-01T12:00:00Z') } })
  const expiredRevision = await call(admin, 'GET', editPath(expired.id))
  const expiredSaved = await call(admin, 'PATCH', editPath(expired.id), { ...expiredRevision.form, title: `${expiredRevision.form.title} refeito`, updatedAt: expiredRevision.updatedAt }, [200, 201])
  const expiredReplacement = await db.projectContract.findUniqueOrThrow({ where: { id: expiredSaved.id } })
  assert.equal(expiredReplacement.createdById, ids.manager)
  assert.equal(expiredReplacement.version, 2)
  assert.ok(expiredReplacement.expiresAt > new Date())
  pass('Administrador corrige contrato expirado e preserva gerente responsável')

  const concurrent = await create(manager, form('concorrente'))
  const concurrentRevision = await call(manager, 'GET', editPath(concurrent.id))
  const concurrentPatch = { ...concurrentRevision.form, title: `${run} correção concorrente`, value: 12345, updatedAt: concurrentRevision.updatedAt }
  const beforeCount = await db.projectContract.count({ where: { createdById: ids.manager } })
  const concurrentResponses = await Promise.all([manager.patch(editPath(concurrent.id), { data: concurrentPatch, timeout: 120_000 }), manager.patch(editPath(concurrent.id), { data: concurrentPatch, timeout: 120_000 })])
  assert.deepEqual(concurrentResponses.map(response => response.status()).sort(), [200, 409])
  assert.equal(await db.projectContract.count({ where: { createdById: ids.manager } }), beforeCount + 1)
  assert.equal(await db.projectContract.count({ where: { createdById: ids.manager, standaloneTitle: concurrentPatch.title, voidedAt: null } }), 1)
  pass('Dois salvamentos simultâneos criam apenas uma versão substituta')

  if (process.env.CONTRACT_EDIT_BROWSER === '1') {
    const uiForm = form('navegador', { value: 9876, paymentMethod: 'PIX', downPayment: 0, installmentCount: 1 })
    const uiCreated = await create(manager, uiForm)
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const context = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`${baseURL}/dashboard/contracts?standalone=1`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.getByText(uiForm.title, { exact: true }).waitFor({ timeout: 60_000 })
    const row = page.getByText(uiForm.title, { exact: true }).locator('..').locator('..')
    await row.getByRole('button', { name: /Editar/i }).click()
    await expect(page.getByLabel('Serviço contratado *')).toHaveValue(uiForm.title, { timeout: 30_000 })
    await expect(page.getByLabel('Descrição do que está sendo contratado *')).toHaveValue(uiForm.description)
    await expect(page.getByLabel('Valor total (R$) *')).toHaveValue('9876')
    await expect(page.getByPlaceholder('Digite o nome do cliente')).toHaveValue(`Paula fictícia ${run}`)
    const editedTitle = `${run} cozinha ajustada no navegador`
    await page.getByLabel('Serviço contratado *').fill(editedTitle)
    await page.getByLabel('Valor total (R$) *').fill('10999')
    await page.getByLabel('Descrição do que está sendo contratado *').fill('Escopo corrigido e salvo pelo navegador de verificação.')
    const saveResponse = page.waitForResponse(response => response.url() === `${baseURL}${editPath(uiCreated.id)}` && response.request().method() === 'PATCH', { timeout: 60_000 })
    await page.getByRole('button', { name: /Salvar correções/i }).click()
    const uiSavedResponse = await saveResponse
    assert.equal(uiSavedResponse.status(), 200)
    const uiSaved = await uiSavedResponse.json()
    await page.getByText(editedTitle, { exact: true }).waitFor({ timeout: 30_000 })
    assert.equal(await db.projectContract.count({ where: { standaloneTitle: editedTitle, voidedAt: null } }), 1)
    assert.equal(await page.getByText(uiForm.title, { exact: true }).count(), 0)
    await expect(page.getByRole('link', { name: /Abrir contrato corrigido/i })).toHaveAttribute('href', uiSaved.publicUrl)
    assert.deepEqual(pageErrors, [])
    await page.screenshot({ path: fileURLToPath(new URL('./contract-edit-desktop.png', evidenceRoot)), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible()
    await page.screenshot({ path: fileURLToPath(new URL('./contract-edit-mobile.png', evidenceRoot)), fullPage: true })
    await page.goto(`${baseURL}/dashboard/financeiro?month=${month}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.getByRole('button', { name: 'Relatório do mês', exact: true }).click()
    const financeRow = page.getByRole('link').filter({ has: page.getByText(editedTitle, { exact: true }) })
    await expect(financeRow).toContainText('10.999,00', { timeout: 30_000 })
    await expect(financeRow).toHaveAttribute('href', new RegExp(uiSaved.id))
    assert.equal(await page.getByText(uiForm.title, { exact: true }).count(), 0)
    assert.deepEqual(pageErrors, [])
    await page.screenshot({ path: fileURLToPath(new URL('./contract-edit-finance-mobile.png', evidenceRoot)), fullPage: true })
    pass('Navegador Edge: Editar preenche, salva, atualiza a lista e funciona em tela móvel', { originalId: uiCreated.id })
    await context.close()
  }
  await evidence({ success: true })
  console.log(JSON.stringify({ run, success: true, checks: results.length }))
} catch (error) {
  await evidence({ success: false, error: error.stack || String(error) })
  throw error
} finally {
  await browser?.close()
  for (const context of contexts) await context.dispose()
  await db.$disconnect()
}
