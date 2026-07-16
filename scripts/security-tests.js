/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execFileSync } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const root = path.resolve(__dirname, '..')
const port = Number(process.env.SECURITY_TEST_PORT || 3217)
const baseUrl = `http://127.0.0.1:${port}`
const password = `Security-${randomBytes(12).toString('hex')}!Aa1`
const testAuthSecret = `security-test-${randomBytes(16).toString('hex')}`
const testEnvironmentFile = path.join(root, '.env.production.local')
let databaseUrl = ''
let directDatabaseUrl = ''
let testSchema = ''
let createdTestEnvironmentFile = false

function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function withSchema(connectionString, schema) {
  const url = new URL(connectionString)
  url.searchParams.set('schema', schema)
  return url.toString()
}

function testEnvironment() {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: databaseUrl,
    NEXTAUTH_SECRET: testAuthSecret,
    NEXTAUTH_URL: baseUrl,
    SECURITY_TEST_MODE: 'true',
    RATE_LIMIT_TEST_BACKEND: 'memory',
  }
}

function testServerEnvironment() {
  const environment = testEnvironment()
  delete environment.DATABASE_URL
  delete environment.DATABASE_URL_UNPOOLED
  return environment
}

function createTestEnvironmentFile() {
  if (fs.existsSync(testEnvironmentFile)) {
    throw new Error('O arquivo .env.production.local ja existe e nao sera substituido pelo teste de seguranca.')
  }

  const content = [
    `DATABASE_URL=${databaseUrl}`,
    `DATABASE_URL_UNPOOLED=${databaseUrl}`,
    `NEXTAUTH_SECRET=${testAuthSecret}`,
    `NEXTAUTH_URL=${baseUrl}`,
    'SECURITY_TEST_MODE=true',
    'RATE_LIMIT_TEST_BACKEND=memory',
  ].join('\n')

  fs.writeFileSync(testEnvironmentFile, `${content}\n`, { encoding: 'utf8', mode: 0o600 })
  createdTestEnvironmentFile = true
}

function removeTestEnvironmentFile() {
  if (!createdTestEnvironmentFile) return
  fs.rmSync(testEnvironmentFile, { force: true })
  createdTestEnvironmentFile = false
}

function pushTestSchema() {
  execFileSync(
    process.execPath,
    [path.join('node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_URL_UNPOOLED: databaseUrl,
      },
      stdio: 'inherit',
    },
  )
}

function buildTestApplication() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command('npm')
  const args = process.platform === 'win32' ? ['/c', 'npm.cmd run build'] : ['run', 'build']
  execFileSync(executable, args, { cwd: root, env: testServerEnvironment(), stdio: 'inherit' })
}

async function prepareTestDatabase() {
  const { loadDatabaseEnv } = await import('./database-env.mjs')
  const { directUrl } = loadDatabaseEnv()
  testSchema = `vertex_security_${process.pid}_${randomBytes(4).toString('hex')}`
  directDatabaseUrl = directUrl
  databaseUrl = withSchema(directUrl, testSchema)
  const client = new Client({ connectionString: directUrl })

  try {
    await client.connect()
    await client.query(`CREATE SCHEMA ${quoteIdentifier(testSchema)}`)
  } finally {
    await client.end().catch(() => {})
  }

  pushTestSchema()
}

async function removeTestDatabase() {
  if (!directDatabaseUrl || !testSchema) return
  const client = new Client({ connectionString: directDatabaseUrl })
  try {
    await client.connect()
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(testSchema)} CASCADE`)
  } finally {
    await client.end().catch(() => {})
  }
}

async function seedDatabase() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  const admin = await prisma.user.create({
    data: { name: 'Admin Test', email: 'admin-test@example.local', password: await bcrypt.hash(password, 12), role: 'ADMIN' },
  })
  const managerOne = await prisma.user.create({
    data: { name: 'Manager One', email: 'manager-one@example.local', password: await bcrypt.hash(password, 12), role: 'MANAGER' },
  })
  const managerTwo = await prisma.user.create({
    data: { name: 'Manager Two', email: 'manager-two@example.local', password: await bcrypt.hash(password, 12), role: 'MANAGER' },
  })
  const clientOne = await prisma.client.create({ data: { name: 'Client One', email: 'client-one@example.local' } })
  const clientTwo = await prisma.client.create({ data: { name: 'Client Two', email: 'client-two@example.local' } })
  const ownProject = await prisma.project.create({
    data: { clientId: clientOne.id, managerId: managerOne.id, name: 'Project One', status: 'APPROVED', stage: 'PENDING_START' },
  })
  const otherProject = await prisma.project.create({
    data: { clientId: clientTwo.id, managerId: managerTwo.id, name: 'Project Two', status: 'APPROVED', stage: 'PENDING_START' },
  })
  const team = await prisma.operationalResource.create({ data: { name: 'Security Team', type: 'TEAM' } })
  const quote = await prisma.quote.create({
    data: {
      clientId: clientOne.id,
      createdById: managerOne.id,
      title: 'Security Quote',
      status: 'DRAFT',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal: 1000,
      total: 1000,
      costTotal: 500,
      items: {
        create: {
          environment: 'Cozinha',
          description: 'Armario de teste',
          width: 100,
          height: 100,
          quantity: 1,
          areaM2: 1,
          unitPrice: 1000,
          cost: 500,
          total: 1000,
          position: 1,
        },
      },
    },
  })
  await prisma.$disconnect()
  return { admin, managerOne, managerTwo, clientOne, ownProject, otherProject, team, quote }
}

function startServer() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command('npm')
  const args =
    process.platform === 'win32'
      ? ['/c', `npm.cmd run start -- -p ${port}`]
      : ['run', 'start', '--', '-p', String(port)]

  const child = spawn(executable, args, {
    cwd: root,
    env: testServerEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', () => {})
  child.stderr.on('data', (data) => process.stderr.write(data))
  return child
}

async function waitForServer() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      await fetch(`${baseUrl}/api/auth/csrf`)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
  throw new Error('Server did not start in time.')
}

function parseSetCookie(headers) {
  return headers.getSetCookie ? headers.getSetCookie() : (headers.get('set-cookie') ? [headers.get('set-cookie')] : [])
}

function mergeCookies(existing, setCookies) {
  const jar = new Map(existing)
  for (const cookie of setCookies) {
    const first = cookie.split(';')[0]
    const index = first.indexOf('=')
    if (index > 0) jar.set(first.slice(0, index), first.slice(index + 1))
  }
  return jar
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

async function login(email, candidatePassword = password) {
  let jar = new Map()
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  jar = mergeCookies(jar, parseSetCookie(csrfResponse.headers))
  const csrf = await csrfResponse.json()
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password: candidatePassword,
    json: 'true',
  })

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body,
    redirect: 'manual',
  })
  jar = mergeCookies(jar, parseSetCookie(response.headers))
  return jar
}

function hasSessionCookie(jar) {
  return [...jar.keys()].some((key) => key.includes('session-token'))
}

async function verifyDatabaseRateLimit() {
  const key = `security-rate-limit-${randomBytes(12).toString('hex')}`
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  try {
    let latest = null
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const now = new Date()
      const nextResetAt = new Date(now.getTime() + 15 * 60 * 1000)
      ;[latest] = await prisma.$queryRaw`
        INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
        VALUES (${key}, 1, ${nextResetAt}, ${now})
        ON CONFLICT ("key") DO UPDATE
        SET
          "count" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
            ELSE "RateLimitBucket"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextResetAt}
            ELSE "RateLimitBucket"."resetAt"
          END,
          "updatedAt" = ${now}
        RETURNING "count", "resetAt"
      `
    }
    return latest?.count === 6
  } finally {
    await prisma.rateLimitBucket.delete({ where: { key } }).catch(() => {})
    await prisma.$disconnect()
  }
}

async function status(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: 'manual',
    ...options,
  })
  return response.status
}

async function runTests(ids) {
  const databaseRateLimitWorks = await verifyDatabaseRateLimit()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await login(ids.managerTwo.email, 'senha-incorreta')
  }
  const blockedLoginJar = await login(ids.managerTwo.email)
  const loginWasBlocked = !hasSessionCookie(blockedLoginJar)

  const managerJar = await login(ids.managerOne.email)
  const cookie = cookieHeader(managerJar)
  const jsonHeaders = { 'Content-Type': 'application/json', Cookie: cookie }
  const schedulePayload = {
    projectId: ids.ownProject.id,
    scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    teamId: ids.team.id,
    vehicleId: null,
    notes: 'Teste de reserva',
    status: 'SCHEDULED',
  }
  const scheduledStatus = await status('/api/operations/schedules', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(schedulePayload),
  })
  const conflictingScheduleStatus = await status('/api/operations/schedules', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(schedulePayload),
  })
  const completionStatus = await status(`/api/projects/${ids.ownProject.id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ stage: 'COMPLETED' }),
  })
  const postSaleStatus = await status(`/api/projects/${ids.ownProject.id}/post-sale`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ contacted: true }),
  })
  const approvalRequest = await fetch(`${baseUrl}/api/quotes/${ids.quote.id}/approval-request`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({}),
  })
  const approvalPayload = await approvalRequest.json().catch(() => ({}))
  const approvalToken = approvalPayload.approvalUrl ? new URL(approvalPayload.approvalUrl).pathname.split('/').pop() : ''
  const publicApprovalStatus = approvalToken
    ? await status(`/api/public/quote-approvals/${approvalToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE' }),
      })
    : 0

  const tests = [
    ['database rate limit persists six attempts', databaseRateLimitWorks, true],
    ['login rate limit blocks the sixth attempt', loginWasBlocked, true],
    ['valid credentials create a session', hasSessionCookie(managerJar), true],
    ['unauthenticated API returns 401', await status('/api/clients'), 401],
    ['manager cannot delete client', await status(`/api/clients/${ids.clientOne.id}`, { method: 'DELETE', headers: { Cookie: cookie } }), 403],
    ['manager cannot delete project', await status(`/api/projects/${ids.ownProject.id}`, { method: 'DELETE', headers: { Cookie: cookie } }), 403],
    ['manager cannot read another manager project', await status(`/api/projects/${ids.otherProject.id}`, { headers: { Cookie: cookie } }), 403],
    ['PATCH rejects managerId', await status(`/api/projects/${ids.ownProject.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ managerId: null }) }), 400],
    ['PATCH rejects clientId', await status(`/api/projects/${ids.ownProject.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ clientId: 'x' }) }), 400],
    ['PATCH rejects value', await status(`/api/projects/${ids.ownProject.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ value: 1 }) }), 400],
    ['PATCH rejects role', await status(`/api/projects/${ids.ownProject.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ role: 'ADMIN' }) }), 400],
    ['invalid payload returns 400', await status('/api/clients', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'invalid' }) }), 400],
    ['huge note returns 400', await status(`/api/projects/${ids.ownProject.id}/notes`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ content: 'A'.repeat(3000) }) }), 400],
    ['seed without token returns 404', await status('/api/seed', { method: 'POST' }), 404],
    ['manager can reserve an installation', scheduledStatus, 201],
    ['same team cannot be double-booked', conflictingScheduleStatus, 409],
    ['manager can complete own project', completionStatus, 200],
    ['manager can register post-sale after completion', postSaleStatus, 200],
    ['manager can create an approval link', approvalRequest.status, 200],
    ['public approval link records approval', publicApprovalStatus, 200],
  ]

  const failed = tests.filter(([, actual, expected]) => actual !== expected)
  for (const [name, actual, expected] of tests) {
    console.log(`${actual === expected ? 'PASS' : 'FAIL'} ${name}: expected ${expected}, got ${actual}`)
  }

  if (failed.length) process.exitCode = 1
}

async function main() {
  let server
  try {
    await prepareTestDatabase()
    createTestEnvironmentFile()
    buildTestApplication()
    const ids = await seedDatabase()
    server = startServer()
    await waitForServer()
    await runTests(ids)
  } finally {
    if (server) {
      if (process.platform === 'win32') {
        try {
          execFileSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
        } catch {
          server.kill()
        }
      } else {
        server.kill()
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    removeTestEnvironmentFile()
    await removeTestDatabase()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
}).finally(() => {
  process.exit(process.exitCode || 0)
})
