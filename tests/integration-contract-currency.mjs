// Only the fixed loopback runtime documented in analysis/finance-verification/README.md.
// No application .env file is loaded and all seeded records are fictional.
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
const run = `contract-currency-${Date.now().toString(36)}`
const password = 'Currency-Fictional-2026!'
const managerId = `${run}-manager`
const clientId = `${run}-client`
const clientName = `Cliente fictício ${run}`
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(part => [part.type, part.value]))
const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
const month = today.slice(0, 7)
const results = []
let api, browser, context

function pass(name, evidence = {}) {
  results.push({ name, evidence })
  console.log(`PASS ${name}`)
}

async function call(method, path, data, expected = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }), timeout: 120_000 })
  const body = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 500) }))
  assert.equal(response.status(), expected, `${method} ${path}: ${JSON.stringify(body).slice(0, 1000)}`)
  return body
}

async function verifySnapshot(id, value, downPayment) {
  const record = await db.projectContract.findUniqueOrThrow({ where: { id } })
  const snapshot = record.snapshot
  assert.equal(snapshot.project.value, value)
  assert.equal(snapshot.payment.downPayment, downPayment)
  assert.equal(Math.round(snapshot.payment.schedule.reduce((total, payment) => total + payment.amount, 0) * 100), Math.round(value * 100))
  assert.equal(snapshot.payment.schedule.find(payment => payment.type === 'DOWN_PAYMENT')?.amount, downPayment)
  return snapshot
}

async function evidence(extra = {}) {
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(new URL('./contract-currency-results.json', evidenceRoot), JSON.stringify({
    run, baseURL, database: '127.0.0.1:55449 isolated in-memory', completedAt: new Date().toISOString(), results, ...extra,
  }, null, 2))
}

try {
  await db.user.create({ data: { id: managerId, name: 'Gerente fictício', email: `${run}@example.local`, password: await bcrypt.hash(password, 10), role: 'MANAGER' } })
  await db.client.create({ data: { id: clientId, name: clientName, managerId, document: '12345678901', street: 'Rua de Teste', number: '1', city: 'Cotia', state: 'SP', zipCode: '06702170' } })
  await db.companyProfile.upsert({ where: { id: 'vertex' }, create: { id: 'vertex', tradeName: 'Empresa fictícia', legalName: 'Empresa fictícia', street: 'Rua de Teste', number: '2', city: 'Cotia', state: 'SP', zipCode: '06702170' }, update: {} })
  api = await request.newContext({ baseURL, timeout: 120_000 })
  const csrf = await call('GET', '/api/auth/csrf')
  assert.equal((await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: `${run}@example.local`, password, json: 'true' } })).status(), 200)
  assert.equal((await call('GET', '/api/auth/session')).user?.id, managerId)

  const input = { clientId, title: `Cozinha API ${run}`, description: 'Contrato fictício para verificação monetária.', value: '50.000', paymentMethod: 'CARD', downPayment: '10.000', downPaymentDate: today, installmentCount: 4, firstInstallmentDate: today, deliveryBusinessDays: 30 }
  const apiCreated = await call('POST', '/api/contracts', input, 201)
  await verifySnapshot(apiCreated.id, 50_000, 10_000)
  const reportPath = `/api/financeiro/report?month=${month}&q=${encodeURIComponent(run)}`
  assert.equal((await call('GET', reportPath)).negotiating.amount, 50_000)
  const revision = await call('GET', `/api/contracts/${apiCreated.id}`)
  const apiEdited = await call('PATCH', `/api/contracts/${apiCreated.id}`, { ...revision.form, value: '38.000,00', downPayment: '8.000,00', updatedAt: revision.updatedAt })
  await verifySnapshot(apiEdited.id, 38_000, 8_000)
  const afterEdit = await call('GET', reportPath)
  assert.equal(afterEdit.negotiating.amount, 38_000)
  assert.equal(afterEdit.negotiating.count, 1)
  pass('API criar/editar converte 50.000 e 38.000,00 e mantém entrada e parcelas consistentes', { createdId: apiCreated.id, replacementId: apiEdited.id })

  browser = await chromium.launch({ channel: 'msedge', headless: true })
  context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(`${baseURL}/dashboard/sales?new=1&clientId=${encodeURIComponent(clientId)}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await expect(page.getByPlaceholder('Digite o nome do cliente')).toHaveValue(clientName, { timeout: 30_000 })
  const title = `Cozinha navegador ${run}`
  await page.getByLabel('Serviço contratado *').fill(title)
  const valueField = page.getByLabel('Valor total (R$) *')
  await expect(valueField).toHaveAttribute('type', 'text')
  await expect(valueField).toHaveAttribute('inputmode', 'decimal')
  await valueField.fill('50.000')
  await page.getByLabel('Descrição do que está sendo contratado *').fill('Armários fictícios com valor de cinquenta mil reais.')
  await expect(valueField).toHaveValue('50.000,00')
  await expect(page.getByText(/Valor informado:.*50\.000,00/)).toBeVisible()
  await page.getByLabel('Forma de pagamento *').selectOption('CARD')
  const entryField = page.getByLabel('Entrada (R$)')
  await expect(entryField).toHaveAttribute('type', 'text')
  await entryField.fill('10.000')
  await page.getByLabel('Quantidade de parcelas *').fill('4')
  await expect(entryField).toHaveValue('10.000,00')
  await page.screenshot({ path: fileURLToPath(new URL('./contract-currency-create.png', evidenceRoot)), fullPage: true })
  const createResponse = page.waitForResponse(response => response.url() === `${baseURL}/api/contracts` && response.request().method() === 'POST', { timeout: 60_000 })
  await page.getByRole('button', { name: /Criar contrato e abrir link/ }).click()
  const browserCreatedResponse = await createResponse
  assert.equal(browserCreatedResponse.status(), 201)
  const browserPayload = browserCreatedResponse.request().postDataJSON()
  assert.equal(browserPayload.value, 50_000)
  assert.equal(browserPayload.downPayment, 10_000)
  const browserCreated = await browserCreatedResponse.json()
  await verifySnapshot(browserCreated.id, 50_000, 10_000)
  pass('Navegador cria 50.000 com entrada 10.000; JSON e banco recebem 50000/10000 numéricos', { contractId: browserCreated.id })

  await page.goto(`${baseURL}/dashboard/sales?contractId=${encodeURIComponent(browserCreated.id)}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.getByText(title, { exact: true }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Editar/i }).click()
  await expect(valueField).toHaveValue('50.000,00', { timeout: 30_000 })
  await expect(entryField).toHaveValue('10.000,00')
  await valueField.fill('38.000,00')
  await entryField.fill('8.000,25')
  await page.getByLabel('Serviço contratado *').fill(`${title} corrigida`)
  const editResponse = page.waitForResponse(response => response.url() === `${baseURL}/api/contracts/${browserCreated.id}` && response.request().method() === 'PATCH', { timeout: 60_000 })
  await page.getByRole('button', { name: /Salvar correções/ }).click()
  const browserEditedResponse = await editResponse
  assert.equal(browserEditedResponse.status(), 200)
  const editPayload = browserEditedResponse.request().postDataJSON()
  assert.equal(editPayload.value, 38_000)
  assert.equal(editPayload.downPayment, 8000.25)
  const browserEdited = await browserEditedResponse.json()
  await verifySnapshot(browserEdited.id, 38_000, 8000.25)
  const token = new URL(browserEdited.publicUrl).pathname.split('/').at(-1)
  const publicContract = await call('GET', `/api/public/contracts/${token}`)
  assert.equal(publicContract.snapshot.project.value, 38_000)
  assert.equal(publicContract.snapshot.payment.downPayment, 8000.25)
  const pdf = await api.get(`/api/public/contracts/${token}/document`, { timeout: 120_000 })
  assert.equal(pdf.status(), 200)
  assert.match(pdf.headers()['content-type'], /application\/pdf/)
  const pdfBuffer = await pdf.body()
  assert.equal(pdfBuffer.subarray(0, 5).toString(), '%PDF-')
  await writeFile(new URL('./contract-currency.pdf', evidenceRoot), pdfBuffer)
  pass('Navegador edita para 38.000,00 e entrada 8.000,25; snapshot público e PDF usam a nova versão', { contractId: browserEdited.id })

  const finalReport = await call('GET', reportPath)
  assert.equal(finalReport.negotiating.count, 2)
  assert.equal(finalReport.negotiating.amount, 76_000)
  assert.equal(finalReport.potentialTotal, 76_000)
  await page.goto(`${baseURL}/dashboard/financeiro?month=${month}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.getByRole('button', { name: 'Relatório do mês', exact: true }).click()
  const financeRow = page.getByRole('link').filter({ has: page.getByText(`${title} corrigida`, { exact: true }) })
  await expect(financeRow).toContainText('38.000,00', { timeout: 30_000 })
  assert.deepEqual(pageErrors, [])
  await page.screenshot({ path: fileURLToPath(new URL('./contract-currency-finance.png', evidenceRoot)), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(financeRow).toContainText('38.000,00')
  await page.screenshot({ path: fileURLToPath(new URL('./contract-currency-finance-mobile.png', evidenceRoot)), fullPage: true })
  pass('Financeiro mostra 38.000,00 no relatório em desktop e celular, sem duplicar a versão antiga', { total: finalReport.potentialTotal })
  await evidence({ success: true })
  console.log(JSON.stringify({ run, success: true, checks: results.length }))
} catch (error) {
  await evidence({ success: false, error: error.stack || String(error) })
  throw error
} finally {
  await context?.close()
  await browser?.close()
  await api?.dispose()
  await db.$disconnect()
}
