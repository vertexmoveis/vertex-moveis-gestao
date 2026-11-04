// Loopback-only verification with fictional customers/documents. Never loads .env.
// Start the isolated runtime in analysis/finance-verification/README.md first.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import PDFDocument from '@react-pdf/pdfkit'
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
const evidenceRoot = new URL('../../finance-verification/pdf-import/', import.meta.url)
const run = `pdf-import-${Date.now().toString(36)}`
const password = 'PDF-Import-Fictional-2026!'
const ids = {}
const results = []
const apiContexts = []
let browser, browserContext
let uploadSequence = 1
const localParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(part => [part.type, part.value]))
const today = `${localParts.year}-${localParts.month}-${localParts.day}`

function pass(name, evidence = {}) {
  results.push({ name, evidence })
  console.log(`PASS ${name}`)
}

async function json(api, method, path, data, expected = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }), timeout: 120_000 })
  const body = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 500) }))
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status()), `${method} ${path}: ${response.status()} ${JSON.stringify(body).slice(0, 1500)}`)
  return body
}

async function login(label) {
  const api = await request.newContext({ baseURL, timeout: 120_000 })
  apiContexts.push(api)
  const csrf = await json(api, 'GET', '/api/auth/csrf')
  const response = await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: `${run}-${label.toLowerCase()}@example.local`, password, json: 'true' } })
  assert.equal(response.status(), 200)
  assert.equal((await json(api, 'GET', '/api/auth/session')).user?.id, ids[label])
  return api
}

async function makePDF(fileName, pages, options = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 44, ...(options.password ? { userPassword: options.password, ownerPassword: `${options.password}-owner`, pdfVersion: '1.7' } : {}) })
  const chunks = []
  const ready = new Promise((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  for (const [index, lines] of pages.entries()) {
    if (index) doc.addPage()
    if (options.scanned) {
      // An image-only page, deliberately no extractable text/OCR layer.
      doc.rect(50, 50, 480, 500).fill('#eeeeee')
      doc.moveTo(75, 80).lineTo(475, 80).stroke('#111111')
      for (let row = 0; row < 16; row++) doc.rect(75, 105 + row * 23, 240 + row % 3 * 30, 8).fill('#777777')
    } else {
      doc.font('Helvetica').fontSize(11)
      for (const line of lines) doc.text(line, { width: 500, lineGap: 4 })
    }
  }
  doc.end()
  const buffer = await ready
  await writeFile(new URL(fileName, evidenceRoot), buffer)
  return { name: fileName, mimeType: 'application/pdf', buffer }
}

async function upload(api, fixture, clientId = ids.client, expected = 200, fixedIp) {
  const response = await api.post('/api/contracts/import-pdf', {
    multipart: { ...(clientId === undefined ? {} : { clientId }), file: fixture }, timeout: 120_000,
    headers: { 'x-forwarded-for': fixedIp || `127.0.1.${uploadSequence++}` },
  })
  const body = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 500) }))
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status()), `Import ${fixture.name}: ${response.status()} ${JSON.stringify(body).slice(0, 1500)}`)
  return body
}

function createForm(sourceDocument, description) {
  return {
    clientId: ids.client, title: `Cozinha importada ${run}`, description,
    value: '50.000,00', paymentMethod: 'CARD', downPayment: '10.000,00',
    downPaymentDate: today, installmentCount: 4, firstInstallmentDate: today,
    deliveryBusinessDays: 40, ...(sourceDocument ? { sourceDocument } : {}),
  }
}

async function persistEvidence(extra) {
  await writeFile(new URL('results.json', evidenceRoot), JSON.stringify({ run, baseURL, database: 'loopback in-memory only', completedAt: new Date().toISOString(), results, ...extra }, null, 2))
}

try {
  await mkdir(evidenceRoot, { recursive: true })
  const hash = await bcrypt.hash(password, 10)
  for (const [label, role] of [['manager', 'MANAGER'], ['otherManager', 'MANAGER'], ['admin', 'ADMIN'], ['viewer', 'VIEWER']]) {
    ids[label] = `${run}-${label}`
    await db.user.create({ data: { id: ids[label], name: `Pessoa fictícia ${label}`, email: `${run}-${label.toLowerCase()}@example.local`, password: hash, role } })
  }
  ids.client = `${run}-client`
  ids.otherClient = `${run}-other-client`
  ids.archivedClient = `${run}-archived-client`
  await db.client.createMany({ data: [
    { id: ids.client, name: `Cliente cadastrado ${run}`, managerId: ids.manager, document: '12345678901', street: 'Rua de Teste', number: '1', city: 'Cotia', state: 'SP', zipCode: '06702170' },
    { id: ids.otherClient, name: `Outro cliente ${run}`, managerId: ids.otherManager },
    { id: ids.archivedClient, name: `Cliente arquivado ${run}`, managerId: ids.manager, archivedAt: new Date() },
  ] })
  await db.companyProfile.upsert({ where: { id: 'vertex' }, create: { id: 'vertex', tradeName: 'Empresa fictícia', legalName: 'Empresa fictícia', street: 'Rua de Teste', number: '2', city: 'Cotia', state: 'SP', zipCode: '06702170' }, update: {} })
  const manager = await login('manager')
  const otherManager = await login('otherManager')
  const admin = await login('admin')
  const viewer = await login('viewer')
  const anonymous = await request.newContext({ baseURL, timeout: 120_000 }); apiContexts.push(anonymous)

  const standard = await makePDF('orcamento-ficticio-50000.pdf', [[
    'GESTAO CLIQUE - ORCAMENTO FICTICIO 501',
    'Cliente no documento: Nome externo que nao deve substituir o cadastro',
    'Ambiente: Cozinha planejada',
    'Produto / Medidas / Quantidade / Valor',
    'Armario inferior - Largura 1200 mm x Altura 800 mm x Profundidade 600 mm - 1 un - R$ 30.000,00',
    'Armario superior - Largura 1,20 m x Altura 0,70 m - 1 un - R$ 20.000,00',
    'Total do orcamento: R$ 50.000,00',
    'Condicao externa: 12 parcelas. Entrega externa: 15 dias.',
  ]])
  const discounted = await makePDF('orcamento-ficticio-desconto.pdf', [[
    'GESTAO CLIQUE - ORCAMENTO FICTICIO 502', 'Ambiente: Cozinha',
    'Armarios - 1200 mm - R$ 50.000,00', 'Subtotal: R$ 50.000,00',
    'Desconto: R$ 20.000,00', 'Total liquido do pedido: R$ 30.000,00',
  ]])
  const ambiguous = await makePDF('orcamento-ficticio-ambiguo.pdf', [[
    'GESTAO CLIQUE - ORCAMENTO FICTICIO 503', 'Ambiente: Cozinha',
    'Opcao A - Total: R$ 50.000,00', 'Opcao B - Total: R$ 30.000,00',
  ]])
  const noPrice = await makePDF('orcamento-ficticio-sem-total.pdf', [[
    'ORCAMENTO FICTICIO SEM TOTAL', 'Ambiente: Cozinha planejada',
    'Armario L 1200 mm x A 800 mm x P 600 mm', 'Medida adicional: 1,20 m. Quantidade: 2.',
  ]])
  const scanned = await makePDF('orcamento-ficticio-digitalizado.pdf', [[]], { scanned: true })
  const encrypted = await makePDF('orcamento-ficticio-protegido.pdf', [['Documento protegido ficticio']], { password: 'Fictional-PDF-2026' })
  const tooManyPages = await makePDF('orcamento-ficticio-21-paginas.pdf', Array.from({ length: 21 }, (_, index) => [`Pagina ficticia ${index + 1}`, 'Armarios planejados 1200 mm']))
  const longLines = Array.from({ length: 130 }, (_, index) => `ITEM ${String(index + 1).padStart(3, '0')} Armario planejado largura 1200 mm altura 800 mm profundidade 600 mm em MDF branco.`)
  const longScope = await makePDF('orcamento-ficticio-escopo-longo.pdf', [
    ['ORCAMENTO FICTICIO DETALHADO', 'Ambiente: Cozinha', ...longLines.slice(0, 40)],
    longLines.slice(40, 85), [...longLines.slice(85), 'Total do orcamento: R$ 50.000,00'],
  ])

  await upload(anonymous, standard, ids.client, 401)
  await upload(viewer, standard, ids.client, 403)
  await upload(otherManager, standard, ids.client, 404)
  await upload(manager, standard, '', 400)
  await upload(manager, standard, 'missing-client', 404)
  await upload(manager, standard, ids.archivedClient, 404)
  const countBeforeImport = await db.projectContract.count({ where: { createdById: ids.manager } })
  const imported = await upload(manager, standard)
  assert.equal(imported.sourceDocument.type, 'PDF_QUOTE')
  assert.equal(imported.sourceDocument.fileName, standard.name)
  assert.equal(imported.sourceDocument.sha256, createHash('sha256').update(standard.buffer).digest('hex'))
  assert.equal(imported.sourceDocument.pageCount, 1)
  assert.match(imported.sourceDocument.text, /1200 mm/)
  assert.match(imported.sourceDocument.text, /1,20 m/)
  assert.match(imported.suggested.description, /1200 mm/)
  assert.equal(imported.suggested.value, 50_000)
  assert.equal(await db.projectContract.count({ where: { createdById: ids.manager } }), countBeforeImport)
  assert.equal((await db.client.findUniqueOrThrow({ where: { id: ids.client } })).name, `Cliente cadastrado ${run}`)
  await upload(admin, standard)
  pass('Importacao exige cliente cadastrado permitido, extrai medidas/total e nao cria contrato nem altera cadastro')

  const discountResult = await upload(manager, discounted)
  assert.equal(discountResult.suggested.value, 30_000)
  const ambiguousResult = await upload(manager, ambiguous)
  assert.equal(ambiguousResult.suggested.value, null)
  assert.ok(ambiguousResult.warnings.length > 0)
  assert.equal((await upload(manager, noPrice)).suggested.value, null)
  pass('Total final prevalece sobre subtotal/desconto; totais ambiguos ou ausentes exigem preenchimento humano')

  const invalid = { name: 'arquivo-falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('isto nao e um PDF') }
  await upload(manager, invalid, ids.client, [400, 422])
  await upload(manager, { name: 'planilha.txt', mimeType: 'text/plain', buffer: standard.buffer }, ids.client, [400, 415])
  const oversized = { name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(4 * 1024 * 1024)]) }
  await upload(manager, oversized, ids.client, 413)
  const scannedResult = await upload(manager, scanned, ids.client, [400, 422])
  assert.match(JSON.stringify(scannedResult), /texto|digitaliz|imagem|manual|OCR/i)
  await upload(manager, encrypted, ids.client, [400, 422])
  await upload(manager, tooManyPages, ids.client, [400, 413, 422])
  pass('PDF malformado, protegido, digitalizado, grande ou com paginas demais recebe erro utilizavel')

  const longImported = await upload(manager, longScope)
  assert.equal(longImported.suggested.value, 50_000)
  assert.match(longImported.sourceDocument.text, /ITEM 001/)
  assert.match(longImported.sourceDocument.text, /ITEM 130/)
  assert.ok(longImported.suggested.description.length > 5000)
  assert.ok(longImported.suggested.description.length <= 20_000)
  const payload = createForm(longImported.sourceDocument, longImported.suggested.description)
  const created = await json(manager, 'POST', '/api/contracts', payload, 201)
  const saved = await db.projectContract.findUniqueOrThrow({ where: { id: created.id } })
  assert.equal(saved.snapshot.project.value, 50_000)
  assert.deepEqual(saved.snapshot.sourceDocument, longImported.sourceDocument)
  assert.equal(saved.snapshot.payment.downPayment, 10_000)
  assert.equal(saved.snapshot.payment.installmentCount, 4)
  assert.equal(saved.snapshot.project.deliveryBusinessDays, 40)
  assert.ok(JSON.stringify(saved.snapshot.project.scope).includes('ITEM 130'))
  const revision = await json(manager, 'GET', `/api/contracts/${created.id}`)
  assert.deepEqual(revision.form.sourceDocument, longImported.sourceDocument)
  const replacement = await json(manager, 'PATCH', `/api/contracts/${created.id}`, { ...revision.form, updatedAt: revision.updatedAt, title: `${payload.title} revisada` })
  assert.deepEqual((await db.projectContract.findUniqueOrThrow({ where: { id: replacement.id } })).snapshot.sourceDocument, longImported.sourceDocument)
  const token = new URL(replacement.publicUrl).pathname.split('/').at(-1)
  const generatedPDF = await manager.get(`/api/public/contracts/${token}/document`, { timeout: 120_000 })
  assert.equal(generatedPDF.status(), 200)
  const generatedBuffer = await generatedPDF.body()
  await writeFile(new URL('contrato-gerado-escopo-longo.pdf', evidenceRoot), generatedBuffer)
  const { extractText } = await import('unpdf')
  const generatedText = await extractText(new Uint8Array(generatedBuffer), { mergePages: true })
  assert.ok(generatedText.totalPages >= 3)
  assert.match(generatedText.text, /ITEM 001/)
  assert.match(generatedText.text, /ITEM 130/)
  assert.match(generatedText.text, /1200 mm/)
  assert.match(generatedText.text, /50\.000,00/)
  const publicSnapshot = await json(manager, 'GET', `/api/public/contracts/${token}`)
  assert.equal(publicSnapshot.snapshot.sourceDocument, undefined)
  assert.ok(JSON.stringify(publicSnapshot.snapshot.project.scope).includes('ITEM 130'))
  pass('Escopo longo e origem persistem em criacao e edicao; PDF final conserva inicio/fim, medidas, total e paginacao', { contractId: replacement.id, pages: generatedText.totalPages })

  // Browser checks are appended once the new accessible labels are in place.
  if (process.env.PDF_IMPORT_BROWSER === '1') {
    const edgePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
    browser = await chromium.launch({ ...(edgePath ? { executablePath: edgePath } : { channel: 'msedge' }), headless: true })
    browserContext = await browser.newContext({ storageState: await manager.storageState(), viewport: { width: 1440, height: 1000 } })
    const page = await browserContext.newPage()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`${baseURL}/dashboard/contracts`, { waitUntil: 'networkidle', timeout: 120_000 })
    await expect(page.getByRole('button', { name: /Venda sem orçamento/ }).first()).toBeVisible({ timeout: 60_000 })
    const importButton = page.getByRole('button', { name: /Importar PDF/ }).first()
    await expect(importButton).toBeVisible()
    await page.screenshot({ path: fileURLToPath(new URL('browser-contracts-entry.png', evidenceRoot)), fullPage: true })
    await importButton.click()
    const modal = page.locator('form').filter({ has: page.getByRole('button', { name: 'Criar contrato e abrir link' }) })
    await expect(modal.getByLabel('PDF do orçamento *')).toBeDisabled()
    await modal.getByPlaceholder('Digite o nome do cliente').fill(`Cliente cadastrado ${run}`)
    await modal.getByRole('button', { name: `Cliente cadastrado ${run}` }).click()
    await modal.getByLabel('PDF do orçamento *').setInputFiles(standard)
    await expect(modal.getByText(/Orçamento lido:/)).toBeVisible({ timeout: 60_000 })
    await expect(modal.getByLabel('Valor total (R$) *')).toHaveValue('50.000,00')
    await expect(modal.getByLabel('Descrição do que está sendo contratado *')).toHaveValue(/1200 mm/)
    await expect(modal.getByLabel('Forma de pagamento *')).toHaveValue('PIX')
    const createButton = modal.getByRole('button', { name: 'Criar contrato e abrir link' })
    await expect(createButton).toBeDisabled()
    await modal.getByRole('checkbox', { name: /Conferi os itens/ }).check()
    await expect(createButton).toBeEnabled()
    const createdRequest = page.waitForResponse(response => response.url().endsWith('/api/contracts') && response.request().method() === 'POST')
    await createButton.click()
    const browserSaved = await (await createdRequest).json()
    const browserRecord = await db.projectContract.findUniqueOrThrow({ where: { id: browserSaved.id } })
    assert.equal(browserRecord.snapshot.project.value, 50_000)
    assert.match(JSON.stringify(browserRecord.snapshot.project.scope), /1200 mm/)
    assert.equal(browserRecord.clientId, ids.client)
    await expect(modal).toBeHidden()
    await page.getByRole('button', { name: /Venda sem orçamento/ }).first().click()
    await expect(page.getByLabel('PDF do orçamento *')).toHaveCount(0)
    const manualModal = modal
    await expect(manualModal.getByLabel('Serviço contratado *')).toBeVisible()
    await manualModal.getByPlaceholder('Digite o nome do cliente').fill(`Cliente cadastrado ${run}`)
    await manualModal.getByRole('button', { name: `Cliente cadastrado ${run}` }).click()
    await manualModal.getByLabel('Serviço contratado *').fill('Armario criado manualmente')
    await manualModal.getByLabel('Descrição do que está sendo contratado *').fill('Armario branco largura 1200 mm cadastrado manualmente, sem PDF.')
    await manualModal.getByLabel('Valor total (R$) *').fill('1.000,00')
    const manualRequest = page.waitForResponse(response => response.url().endsWith('/api/contracts') && response.request().method() === 'POST')
    await manualModal.getByRole('button', { name: 'Criar contrato e abrir link' }).click()
    const manualSaved = await (await manualRequest).json()
    const manualRecord = await db.projectContract.findUniqueOrThrow({ where: { id: manualSaved.id } })
    assert.equal(manualRecord.snapshot.project.value, 1000)
    assert.equal(manualRecord.snapshot.sourceDocument, undefined)
    await expect(manualModal).toBeHidden()
    await page.setViewportSize({ width: 390, height: 844 })
    await importButton.click()
    await page.screenshot({ path: fileURLToPath(new URL('browser-import-mobile.png', evidenceRoot)), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(pageErrors, [])
    pass('Navegador importa para cliente cadastrado, exige revisao, salva medidas e mantem manual separado em desktop e celular')
  }

  for (let attempt = 0; attempt < 6; attempt++) await upload(manager, invalid, ids.client, 422, '127.0.2.254')
  await upload(manager, invalid, ids.client, 429, '127.0.2.254')
  pass('Setima importacao no mesmo minuto e bloqueada sem processar o documento')

  await persistEvidence({ success: true })
  console.log(JSON.stringify({ run, success: true, checks: results.length }))
} catch (error) {
  await mkdir(evidenceRoot, { recursive: true })
  await persistEvidence({ success: false, error: error.stack || String(error) })
  throw error
} finally {
  await browserContext?.close()
  await browser?.close()
  for (const api of apiContexts) await api.dispose()
  await db.$disconnect()
}
