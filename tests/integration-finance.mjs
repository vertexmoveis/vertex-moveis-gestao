// Run only against the isolated runtime documented in analysis/finance-verification/README.md.
// Kept outside *.test.ts so npm test never requires a database or browser.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const require = createRequire(import.meta.url)
const { request, chromium } = require('@playwright/test')
const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
const databaseTarget = new URL(databaseURL)
assert.equal(databaseTarget.hostname, '127.0.0.1')
assert.equal(databaseTarget.port, '55449')
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(baseURL).port, '3229')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const evidenceRoot = new URL('../../finance-verification/', import.meta.url)
const run = `finance-it-${Date.now().toString(36)}`
const password = 'Finance-Fictional-2026!'
const results = []
const contexts = []
let browser
let manager
let admin
let viewer
const ids = {}

function pass(name, evidence) {
  results.push({ name, evidence })
  console.log(`PASS ${name}`)
}

async function apiCall(api, method, path, data, expected = 200) {
  const response = await api.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    timeout: 120_000,
  })
  const payload = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 500) }))
  const statuses = Array.isArray(expected) ? expected : [expected]
  assert.ok(statuses.includes(response.status()), `${method} ${path}: expected ${statuses.join('/')}, got ${response.status()}: ${JSON.stringify(payload).slice(0, 1000)}`)
  return payload
}

async function login(role) {
  const api = await request.newContext({ baseURL, timeout: 120_000 })
  contexts.push(api)
  const csrf = await apiCall(api, 'GET', '/api/auth/csrf')
  const response = await api.post('/api/auth/callback/credentials', {
    form: { csrfToken: csrf.csrfToken, email: `${run}-${role}@example.local`, password, json: 'true' },
  })
  assert.equal(response.status(), 200)
  const session = await apiCall(api, 'GET', '/api/auth/session')
  assert.equal(session.user?.id, ids[role])
  assert.equal(session.user?.role, role.toUpperCase())
  return api
}

async function seedProject(label, paymentMethod, value, amounts, extra = {}) {
  const projectId = `${run}-${label}`
  return db.project.create({
    data: {
      id: projectId, clientId: ids.client, managerId: ids.manager,
      name: `Teste fictício Financeiro: ${label}`, paymentMethod, value,
      stage: 'PENDING_START', status: 'APPROVED', workflowVersion: 2,
      approvalDate: new Date('2026-09-05T12:00:00Z'),
      downPayment: 0, installmentCount: amounts.length,
      installmentValue: amounts[0], firstInstallmentDate: new Date('2026-10-15T12:00:00Z'),
      ...extra,
      payments: { create: amounts.map((amount, index) => ({
        id: `${projectId}-p${index + 1}`,
        installmentNumber: index + 1, type: 'INSTALLMENT', amount,
        dueDate: new Date(Date.UTC(2026, 9 + index, 15, 12)), paidAt: null,
      })) },
    },
    include: { payments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

async function balances(month = '2026-09') {
  return apiCall(manager, 'GET', `/api/financeiro/settlements?month=${month}`)
}

function projectIn(report, id) {
  const project = report.projects.find(item => item.id === id)
  assert.ok(project, `Project ${id} must appear in finance response`)
  return project
}

async function settle(data, api = manager, expected = [200, 201]) {
  return apiCall(api, 'POST', '/api/financeiro/settlements', data, expected)
}

async function activeReceipts(projectId) {
  return db.financeReceipt.findMany({ where: { projectId, reversedAt: null }, include: { allocations: true } })
}

async function writeEvidence(extra = {}) {
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(new URL('./integration-results.json', evidenceRoot), JSON.stringify({
    run, baseURL, database: `${databaseTarget.hostname}:${databaseTarget.port}`,
    completedAt: new Date().toISOString(), results, ...extra,
  }, null, 2))
}

try {
  const hash = await bcrypt.hash(password, 10)
  for (const role of ['admin', 'manager', 'viewer']) {
    ids[role] = `${run}-${role}`
    await db.user.create({ data: { id: ids[role], name: `Pessoa fictícia ${role}`, email: `${run}-${role}@example.local`, password: hash, role: role.toUpperCase() } })
  }
  ids.client = `${run}-client`
  await db.client.create({ data: { id: ids.client, name: 'Cliente fictício: verificação financeira', managerId: ids.manager } })
  const anonymous = await request.newContext({ baseURL }); contexts.push(anonymous)
  await apiCall(anonymous, 'GET', '/api/financeiro/settlements', undefined, 401)
  await apiCall(anonymous, 'POST', '/api/financeiro/settlements', {}, 401)
  manager = await login('manager')
  admin = await login('admin')
  viewer = await login('viewer')
  await apiCall(viewer, 'GET', '/api/financeiro/settlements', undefined, 403)
  await apiCall(viewer, 'POST', '/api/financeiro/settlements', {}, 403)
  await apiCall(manager, 'GET', '/api/financeiro/report?month=2026-09')
  pass('Autenticação real: gerente autorizado; visitante e visualizador bloqueados', { managerId: ids.manager })

  const baselineSeptember = (await balances('2026-09')).summary
  const baselineOctober = (await balances('2026-10')).summary
  const card = await seedProject('cartao', 'CARD', 12000, [3000, 3000, 3000, 3000], { cardFeeAmount: 240 })
  const cash = await seedProject('dinheiro', 'TO_DEFINE', 50000, [50000])
  const boleto = await seedProject('boleto', 'BOLETO', 10000, [2500, 2500, 2500, 2500])
  const legacy = await seedProject('legado-pago', 'PIX', 1000, [1000])
  await db.projectPayment.update({ where: { id: legacy.payments[0].id }, data: { paidAt: new Date('2026-09-07T12:00:00Z'), paymentMethod: 'PIX' } })

  const cardRequest = {
    action: 'RECEIVE', projectId: card.id, requestId: randomUUID(), amount: 12000,
    fee: 240, method: 'CARTAO', source: 'CARD', receivedAt: '2026-09-12',
    note: 'Operação fictícia: cartão passado e saldo integral recebido.',
  }
  await settle({ ...cardRequest, requestId: randomUUID(), amount: 0 }, manager, 400)
  await settle({ ...cardRequest, requestId: randomUUID(), amount: 12000.001 }, manager, 400)
  await settle({ ...cardRequest, requestId: randomUUID(), fee: 12001 }, manager, 409)
  await settle({ ...cardRequest, requestId: randomUUID(), receivedAt: '2099-01-01' }, manager, 409)
  await settle({ ...cardRequest, requestId: randomUUID(), amount: 3000 }, manager, 409)
  const cardResponses = await Promise.all([settle(cardRequest), settle(cardRequest)])
  assert.equal(cardResponses[0].receiptId, cardResponses[1].receiptId)
  const cardReceipts = await activeReceipts(card.id)
  assert.equal(cardReceipts.length, 1)
  assert.equal(Number(cardReceipts[0].amount), 12000)
  assert.equal(Number(cardReceipts[0].fee), 240)
  assert.equal(cardReceipts[0].allocations.length, 4)
  assert.equal(cardReceipts[0].allocations.reduce((sum, item) => sum + Number(item.amount), 0), 12000)
  const cardPayments = await db.projectPayment.findMany({ where: { projectId: card.id } })
  assert.ok(cardPayments.every(payment => payment.paidAt && payment.paymentMethod === 'CARTAO'))
  assert.equal(projectIn(await balances('2026-09'), card.id).remaining, 0)
  await settle({ ...cardRequest, amount: 11000 }, manager, 409)
  pass('Cartão: saldo integral em uma operação; taxa líquida e repetição simultânea sem duplicar', {
    gross: 12000, fee: 240, net: 11760, allocations: 4, receiptId: cardResponses[0].receiptId,
  })

  const cashSeptember = await settle({
    action: 'RECEIVE', projectId: cash.id, requestId: randomUUID(), amount: 15000,
    method: 'DINHEIRO', source: 'DIRECT', receivedAt: '2026-09-15',
  })
  let cashReport = projectIn(await balances('2026-09'), cash.id)
  assert.equal(cashReport.received, 15000)
  assert.equal(cashReport.remaining, 35000)
  assert.equal((await db.projectPayment.findUniqueOrThrow({ where: { id: cash.payments[0].id } })).paidAt, null)
  await apiCall(admin, 'GET', `/api/projects/${cash.id}/payments/${cash.payments[0].id}/receipt`, undefined, 409)
  const cashOctober = await settle({
    action: 'RECEIVE', projectId: cash.id, requestId: randomUUID(), amount: 35000,
    method: 'DINHEIRO', source: 'DIRECT', receivedAt: '2026-10-05',
  })
  cashReport = projectIn(await balances('2026-10'), cash.id)
  assert.equal(cashReport.received, 50000)
  assert.equal(cashReport.remaining, 0)
  assert.ok((await db.projectPayment.findUniqueOrThrow({ where: { id: cash.payments[0].id } })).paidAt)
  const september = (await balances('2026-09')).summary
  const october = (await balances('2026-10')).summary
  assert.equal(september.receivedGross - baselineSeptember.receivedGross, 28000)
  assert.equal(september.fees - baselineSeptember.fees, 240)
  assert.equal(september.received - baselineSeptember.received, 27760)
  assert.equal(october.receivedGross - baselineOctober.receivedGross, 35000)
  const legacySeptember = await apiCall(manager, 'GET', '/api/financeiro?month=2026-09')
  const legacyOctober = await apiCall(manager, 'GET', '/api/financeiro?month=2026-10')
  assert.equal(legacySeptember.summary.received, september.received)
  assert.equal(legacyOctober.summary.received, october.received)
  const legacyExport = await manager.get('/api/financeiro/export?month=2026-09', { maxRedirects: 0 })
  assert.equal(legacyExport.status(), 307)
  assert.ok(legacyExport.headers().location.includes('/api/financeiro/settlements/export?month=2026-09'))
  pass('Dinheiro parcial preserva cada mês; legado é contado uma vez', {
    firstReceipt: cashSeptember.receiptId, finalReceipt: cashOctober.receiptId,
    september: { gross: 28000, fees: 240, net: 27760 }, october: { gross: 35000 },
  })

  const preCredit = (await balances('2026-10')).summary.receivedGross
  await settle({ action: 'CREDIT_REVIEW', projectId: boleto.id, creditStatus: 'APPROVED', creditLimit: 6000, note: 'Limite fictício aprovado para o teste isolado.' })
  assert.equal((await activeReceipts(boleto.id)).length, 0)
  assert.equal((await balances('2026-10')).summary.receivedGross, preCredit)
  const reviewedClient = await db.client.findUniqueOrThrow({ where: { id: ids.client } })
  assert.equal(reviewedClient.creditStatus, 'APPROVED')
  assert.equal(Number(reviewedClient.creditLimit), 6000)
  assert.ok(reviewedClient.creditReviewedAt)
  const advanceRequest = {
    action: 'RECEIVE', projectId: boleto.id, requestId: randomUUID(), amount: 5000,
    fee: 100, method: 'BOLETO', source: 'BOLETO_ADVANCE', receivedAt: '2026-10-10',
  }
  await settle({ ...advanceRequest, requestId: randomUUID(), amount: 7000 }, manager, 409)
  const advance = await settle(advanceRequest)
  assert.equal((await settle(advanceRequest)).receiptId, advance.receiptId)
  await settle({ ...advanceRequest, requestId: randomUUID(), amount: 1500 }, manager, 409)
  assert.equal((await activeReceipts(boleto.id)).length, 1)
  const advancedProject = projectIn(await balances('2026-10'), boleto.id)
  assert.equal(advancedProject.remaining, 5000)
  assert.equal(advancedProject.creditAvailable, 1000)
  assert.equal((await balances('2026-10')).summary.receivedGross, preCredit + 5000)
  const secondBoleto = await seedProject('boleto-mesmo-cliente', 'BOLETO', 10000, [2500, 2500, 2500, 2500])
  const secondProjectCredit = projectIn(await balances('2026-10'), secondBoleto.id)
  assert.equal(secondProjectCredit.creditStatus, 'APPROVED')
  assert.equal(secondProjectCredit.creditAvailable, 1000)
  await settle({ ...advanceRequest, projectId: secondBoleto.id, requestId: randomUUID(), amount: 1500 }, manager, 409)
  assert.equal((await activeReceipts(secondBoleto.id)).length, 0)
  pass('Jurídico: limite aprovado sem criar caixa; antecipação respeita limite e não duplica', {
    approvedLimit: 6000, advancedGross: 5000, fee: 100, net: 4900, creditAvailable: 1000, sharedAcrossProjects: true,
  })

  await apiCall(manager, 'PATCH', `/api/projects/${card.id}/payments/${card.payments[0].id}`, { paid: false }, 409)
  await apiCall(manager, 'PATCH', `/api/projects/${cash.id}/payments/${cash.payments[0].id}`, { paid: false }, 409)
  await apiCall(admin, 'PUT', `/api/projects/${cash.id}`, {
    clientId: ids.client, name: cash.name, status: 'APPROVED', stage: 'PENDING_START',
    approvalDate: '2026-09-05', paymentConfirmedAt: '2026-10-05',
    value: 51000, productionCost: 0, paymentMethod: 'BOLETO',
    downPayment: 0, installmentCount: 1, firstInstallmentDate: '2026-10-15',
    managerId: ids.manager, deliveryBusinessDays: 30, productionReminderBusinessDays: 7,
  }, 409)
  assert.equal((await activeReceipts(cash.id)).length, 2)
  const anotherClient = await db.client.create({ data: { id: `${run}-another-client`, name: 'Outro cliente fictício', managerId: ids.manager } })
  const clientChange = await apiCall(admin, 'PUT', `/api/projects/${card.id}`, {
    clientId: anotherClient.id, name: card.name, status: 'APPROVED', stage: 'PENDING_START',
    approvalDate: '2026-09-05', paymentConfirmedAt: '2026-09-12',
    value: 12000, productionCost: 0, paymentMethod: 'CARD', cardFeePercent: 0,
    downPayment: 0, installmentCount: 4, firstInstallmentDate: '2026-10-15',
    managerId: ids.manager, deliveryBusinessDays: 30, productionReminderBusinessDays: 7,
  }, 409)
  assert.match(clientChange.error, /preserve o cliente/iu)
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: card.id } })).clientId, ids.client)
  pass('Proteção de histórico: API antiga não reabre recebimentos e edição não apaga lançamentos', { cashReceiptsPreserved: 2 })

  await settle({ action: 'REVERSE', projectId: boleto.id, receiptId: advance.receiptId, note: 'Estorno fictício do cenário de teste.' })
  await settle({ action: 'REVERSE', projectId: boleto.id, receiptId: advance.receiptId, note: 'Repetição do estorno fictício.' })
  const reversedProject = projectIn(await balances('2026-10'), boleto.id)
  assert.equal(reversedProject.received, 0)
  assert.equal(reversedProject.remaining, 10000)
  assert.equal(reversedProject.creditAvailable, 6000)
  assert.equal((await balances('2026-10')).summary.receivedGross, preCredit)
  const reversed = await db.financeReceipt.findUniqueOrThrow({ where: { id: advance.receiptId }, include: { allocations: true } })
  assert.ok(reversed.reversedAt)
  assert.equal(reversed.reversedById, ids.manager)
  assert.equal(reversed.allocations.length, 2)
  assert.ok((await db.projectPayment.findMany({ where: { projectId: boleto.id } })).every(payment => payment.paidAt === null))
  pass('Estorno preserva a auditoria, devolve saldo e limite e exclui o caixa estornado', { receiptId: advance.receiptId, remaining: 10000, available: 6000 })

  const commercialBaseline = await apiCall(manager, 'GET', '/api/financeiro/report?month=2026-09')
  const quoteBase = { clientId: ids.client, createdById: ids.manager, createdAt: new Date('2026-09-01T12:00:00Z'), sentAt: new Date('2026-09-02T12:00:00Z') }
  await db.quoteGroup.create({ data: {
    id: `${run}-open-group`, clientId: ids.client, title: 'Negociação fictícia em andamento', createdById: ids.manager,
    quotes: { create: [
      { ...quoteBase, id: `${run}-open-q1`, title: 'Negociação fictícia padrão', status: 'SENT', total: 8000, variationOrder: 0 },
      { ...quoteBase, id: `${run}-open-q2`, title: 'Negociação fictícia alternativa', status: 'SENT', total: 11000, variationOrder: 1 },
    ] },
  } })
  await db.quoteGroup.create({ data: {
    id: `${run}-lost-group`, clientId: ids.client, title: 'Negociação fictícia perdida', createdById: ids.manager,
    quotes: { create: [{ ...quoteBase, id: `${run}-lost-q`, title: 'Negociação fictícia perdida', status: 'LOST', total: 9000, variationOrder: 0, lostAt: new Date('2026-09-20T12:00:00Z'), lossReason: 'Teste fictício de perda comercial.' }] },
  } })
  const commercial = await apiCall(manager, 'GET', '/api/financeiro/report?month=2026-09')
  assert.equal(commercial.negotiating.count - commercialBaseline.negotiating.count, 1)
  assert.equal(commercial.negotiating.amount - commercialBaseline.negotiating.amount, 8000)
  assert.equal(commercial.lost.count - commercialBaseline.lost.count, 1)
  assert.equal(commercial.lost.amount - commercialBaseline.lost.amount, 9000)
  assert.equal(commercial.potentialTotal, commercial.sold.amount + commercial.negotiating.amount)
  assert.ok(commercial.sold.items.some(item => item.projectId === card.id && item.amount === 12000))
  pass('Relatório mensal: vendido, perdido e negociação sem somar opções alternativas', {
    negotiatingAdded: 8000, lostAdded: 9000, potentialTotal: commercial.potentialTotal,
  })

  const beforeArchive = await balances('2026-09')
  const archiveName = `${card.name} ${run} arquivo verificado`
  try {
    await db.project.update({ where: { id: card.id }, data: { archivedAt: new Date(), name: archiveName } })
    const archivedReport = await balances('2026-09')
    const archivedCard = projectIn(archivedReport, card.id)
    assert.ok(archivedCard.archivedAt)
    assert.equal(archivedReport.summary.received, beforeArchive.summary.received)
    assert.equal(archivedReport.summary.pending, beforeArchive.summary.pending)
    const csv = await manager.get(`/api/financeiro/settlements/export?month=2026-09&q=${encodeURIComponent(run)}`)
    assert.equal(csv.status(), 200)
    assert.ok((await csv.text()).includes(archiveName))
    pass('Arquivar preserva recebimentos no mês e na exportação sem criar pendência', { cardReceiptRetained: true })
  } finally {
    await db.project.update({ where: { id: card.id }, data: { archivedAt: null, name: card.name } })
  }

  if (process.env.FINANCE_INTEGRATION_BROWSER === '1') {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const context = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`${baseURL}/dashboard/financeiro`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.getByRole('heading', { name: /Financeiro/i }).first().waitFor({ timeout: 60_000 })
    await page.screenshot({ path: fileURLToPath(new URL('./finance-desktop.png', evidenceRoot)), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.screenshot({ path: fileURLToPath(new URL('./finance-mobile.png', evidenceRoot)), fullPage: true })
    assert.deepEqual(pageErrors, [])
    pass('Navegador: financeiro abre para gerente em desktop e celular sem erros de execução', { pageErrors, desktopWidth: 1440, mobileWidth: 390 })
  }
  await writeEvidence({ status: 'passed' })
} catch (error) {
  await writeEvidence({ status: 'failed', error: error.stack || String(error) })
  throw error
} finally {
  if (browser) await browser.close()
  for (const context of contexts) await context.dispose()
  await db.$disconnect()
}
