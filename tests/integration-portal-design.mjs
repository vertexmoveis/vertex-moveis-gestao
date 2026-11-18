// Anonymous customer UI against isolated fictional records on fixed loopback only.
// Never loads .env files, real tokens, production credentials or customer data.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { chromium, expect } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3229'
const databaseURL = 'postgresql://postgres:postgres@127.0.0.1:55449/postgres?pgbouncer=true&connection_limit=3&pool_timeout=30'
assert.equal(new URL(baseURL).hostname, '127.0.0.1')
assert.equal(new URL(baseURL).port, '3229')
assert.equal(new URL(databaseURL).hostname, '127.0.0.1')
assert.equal(new URL(databaseURL).port, '55449')
const db = new PrismaClient({ datasources: { db: { url: databaseURL } } })
const run = `portal-design-${Date.now().toString(36)}`
const evidence = new URL('../../finance-verification/portal-design/', import.meta.url)
const privateMarker = `${run}-PRIVATE-NOTE-DO-NOT-DISPLAY`
const labels = ['Aguardando medição', 'Em medição', 'Aguardando projeto', 'Projetando', 'Desenho pronto', 'Detalhamento e cotas', 'Projeto aprovado', 'Preparando produção', 'Em produção', 'Pronto para transporte', 'Em transporte', 'Em instalação', 'Concluído']
const checks = []
let browser

async function fixture(label, overrides = {}, environments = []) {
  const project = await db.project.create({ data: {
    name: `${run} ${label}`, clientId: `${run}-client`, managerId: `${run}-manager`,
    stage: 'DESIGN', value: 124567.89, internalNotes: privateMarker,
    ...overrides,
    environments: { create: environments.map((environment, position) => ({ position, notes: privateMarker, ...environment })) },
  } })
  const token = randomBytes(32).toString('base64url')
  await db.projectPortalAccess.create({ data: {
    projectId: project.id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    tokenEncrypted: 'fictional-fixture-not-used-for-public-lookup',
  } })
  return { ...project, token, url: `${baseURL}/acompanhar/${token}` }
}

async function assertPage(page, project) {
  const response = await page.goto(project.url, { waitUntil: 'networkidle', timeout: 60000 })
  assert.equal(response.status(), 200)
  await expect(page.getByRole('heading', { level: 1, name: project.name, exact: true })).toBeVisible()
  await expect(page.getByText('Olá, Cliente fictício do portal', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Andamento geral', exact: true })).toBeVisible()
  const source = await response.text()
  assert.ok(!source.includes(privateMarker))
  assert.ok(!source.includes('124567.89'))
  assert.match(source, /name="robots" content="noindex, nofollow"/)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  const session = await (await page.request.get(`${baseURL}/api/auth/session`)).json()
  assert.equal(session.user, undefined)
}

try {
  await mkdir(evidence, { recursive: true })
  await db.user.create({ data: { id: `${run}-manager`, name: 'Gerente fictício', email: `${run}@example.local`, password: 'fixture-with-no-login', role: 'MANAGER' } })
  await db.client.create({ data: { id: `${run}-client`, name: 'Cliente fictício do portal', managerId: `${run}-manager`, document: '12345678901', address: privateMarker } })
  const mixed = await fixture('Casa com ambientes em fases diferentes', {
    deliveryForecastMonth: '2027-01', deliveryDeadlineDate: new Date('2026-12-16T12:00:00Z'),
  }, [
    { name: 'Cozinha integrada com ilha e armários superiores', status: 'PENDING', workflowStage: 'DIMENSIONING' },
    { name: 'Dormitório principal', status: 'PENDING', workflowStage: 'DESIGN_PENDING' },
    { name: 'Lavanderia', status: 'IN_PROGRESS', workflowStage: 'PRODUCTION' },
    { name: 'Banheiro social', status: 'COMPLETED', workflowStage: 'COMPLETED' },
  ])
  const exact = await fixture('Projeto sem ambientes separados', { stage: 'MEASUREMENT', deliveryDeadlineDate: new Date('2027-02-12T12:00:00Z') })
  const scheduled = await fixture('Instalação com data marcada', { stage: 'PRODUCTION_READY' }, [
    { name: 'Sala', status: 'READY', workflowStage: 'PRODUCTION_READY' },
  ])
  const change = await fixture('Instalação com pedido de outra data', { stage: 'PRODUCTION_READY' })
  const schedules = []
  for (const project of [scheduled, change]) schedules.push(await db.installationSchedule.create({ data: {
    projectId: project.id, status: 'SCHEDULED', scheduledStart: new Date('2027-01-15T13:00:00Z'), scheduledEnd: new Date('2027-01-15T15:00:00Z'),
  } }))
  const completed = await fixture('Projeto instalado e entregue', {
    stage: 'COMPLETED', status: 'COMPLETED', actualEndDate: new Date('2026-11-10T12:00:00Z'), warrantyEndsAt: new Date('2028-11-10T12:00:00Z'),
  }, [{ name: 'Cozinha', status: 'COMPLETED', workflowStage: 'COMPLETED' }])
  const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'msedge' }), headless: true })
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }], ['narrow-mobile', { width: 320, height: 740 }]]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await assertPage(page, mixed)
      await expect(page.getByText('janeiro de 2027 — dia a definir', { exact: true })).toBeVisible()
      await expect(page.getByText('1 de 4 ambientes concluídos', { exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ambientes', exact: true })).toBeVisible()
      await expect(page.getByText('Cozinha integrada com ilha e armários superiores', { exact: true })).toBeVisible()
      assert.ok(!(await page.content()).includes('16/12/2026'))
      const details = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Ver todas as etapas' }) })
      assert.equal(await details.getAttribute('open'), null)
      await page.screenshot({ path: fileURLToPath(new URL(`${device}-overview.png`, evidence)), fullPage: true })
      await details.locator('summary').click()
      const timeline = details.locator('ol')
      await expect(timeline.locator('li')).toHaveCount(labels.length)
      for (const label of labels) await expect(timeline.getByText(label, { exact: true })).toBeVisible()
      await page.screenshot({ path: fileURLToPath(new URL(`${device}-all-stages.png`, evidence)), fullPage: true })
      await assertPage(page, exact)
      await expect(page.getByText('12/02/2027', { exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ambientes', exact: true })).toHaveCount(0)
      await assertPage(page, scheduled)
      await expect(page.getByRole('heading', { name: 'Instalação agendada', exact: true })).toBeVisible()
      const confirmButton = page.getByRole('button', { name: 'Confirmar data da instalação', exact: true })
      await expect(confirmButton).toBeVisible()
      const confirmBox = await confirmButton.boundingBox()
      assert.ok(confirmBox && confirmBox.width >= 44 && confirmBox.height >= 44)
      await page.screenshot({ path: fileURLToPath(new URL(`${device}-installation.png`, evidence)), fullPage: true })
      await assertPage(page, completed)
      await expect(page.getByRole('heading', { name: 'Projeto concluído', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Assistência e garantia', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Como foi sua experiência?', exact: true })).toBeVisible()
      await page.screenshot({ path: fileURLToPath(new URL(`${device}-completed.png`, evidence)), fullPage: true })
      assert.deepEqual(errors, [])
      checks.push({ device, scenarios: 4, anonymous: true, privateFieldsAbsent: true, pageErrors: 0, overflow: false })
    } finally { await context.close() }
  }

  // Confirm and request another date on distinct fictional schedules only.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await assertPage(page, scheduled)
    const [confirmed] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/project-portals/${scheduled.token}/installation`) && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Confirmar data da instalação', exact: true }).click(),
    ])
    assert.equal(confirmed.status(), 200)
    await expect(page.getByText('Data confirmada por você', { exact: true })).toBeVisible()
    assert.equal((await db.installationSchedule.findUniqueOrThrow({ where: { id: schedules[0].id } })).status, 'CONFIRMED')
    await assertPage(page, change)
    await page.getByLabel('Precisa de outra data?', { exact: true }).fill('Prefiro uma data na semana seguinte, no período da manhã.')
    const [changed] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/project-portals/${change.token}/installation`) && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Pedir alteração da data', exact: true }).click(),
    ])
    assert.equal(changed.status(), 200)
    await expect(page.getByText('Seu pedido foi enviado. A Vertex entrará em contato para combinar uma nova data.', { exact: true })).toBeVisible()
    const requested = await db.installationSchedule.findUniqueOrThrow({ where: { id: schedules[1].id } })
    assert.equal(requested.status, 'SCHEDULED')
    assert.ok(requested.notes.includes('semana seguinte'))
    checks.push({ installationConfirmation: true, changeRequest: true, actualDatePreserved: true })
    await assertPage(page, completed)
    const rating = page.getByRole('radio', { name: 'Nota 5', exact: true })
    const ratingBox = await rating.locator('..').boundingBox()
    assert.ok(ratingBox && ratingBox.width >= 44 && ratingBox.height >= 44)
    await rating.focus()
    await page.keyboard.press('Space')
    await expect(rating).toBeChecked()
    await page.getByLabel('Comentário (opcional)', { exact: true }).fill('Avaliação fictícia: bom acompanhamento do projeto.')
    const sendRating = page.getByRole('button', { name: 'Enviar avaliação', exact: true })
    const sendRatingBox = await sendRating.boundingBox()
    assert.ok(sendRatingBox && sendRatingBox.width >= 44 && sendRatingBox.height >= 44)
    const [rated] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/project-portals/${completed.token}/satisfaction`) && response.request().method() === 'POST'),
      sendRating.click(),
    ])
    assert.equal(rated.status(), 200)
    assert.equal(rated.request().postDataJSON().rating, 5)
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: completed.id } })).satisfactionRating, 5)
    checks.push({ nativeRadioRatingSubmitted: true, keyboardSelection: true, touchTargetsAtLeast44px: true })
  } finally { await context.close() }
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'passed', checks }, null, 2))
  console.log('PASS anonymous portal design: three viewports, monthly/exact forecasts, mixed/no rooms, installation responses and native keyboard rating')
} catch (error) {
  await writeFile(new URL('results.json', evidence), JSON.stringify({ run, status: 'failed', checks, error: error.stack || String(error) }, null, 2))
  throw error
} finally {
  if (browser) await browser.close()
  await db.$disconnect()
}
