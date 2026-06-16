/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execFileSync } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const root = path.resolve(__dirname, '..')
const port = Number(process.env.SECURITY_TEST_PORT || 3217)
const baseUrl = `http://127.0.0.1:${port}`
const dbPath = path.join(os.tmpdir(), `vertex-security-${process.pid}.db`)
const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`
const password = `Security-${randomBytes(12).toString('hex')}!Aa1`

function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

function runPrismaPush() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command('npm')
  const args =
    process.platform === 'win32'
      ? ['/c', 'npm.cmd exec prisma db push -- --skip-generate']
      : ['exec', 'prisma', 'db', 'push', '--', '--skip-generate']

  execFileSync(executable, args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
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
  await prisma.$disconnect()
  return { admin, managerOne, clientOne, ownProject, otherProject }
}

function startServer() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command('npm')
  const args =
    process.platform === 'win32'
      ? ['/c', `npm.cmd run start -- -p ${port}`]
      : ['run', 'start', '--', '-p', String(port)]

  const child = spawn(executable, args, {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NEXTAUTH_SECRET: `security-test-${randomBytes(16).toString('hex')}`,
      NEXTAUTH_URL: baseUrl,
      SECURITY_TEST_MODE: 'true',
    },
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

async function login(email) {
  let jar = new Map()
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  jar = mergeCookies(jar, parseSetCookie(csrfResponse.headers))
  const csrf = await csrfResponse.json()
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
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

async function status(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: 'manual',
    ...options,
  })
  return response.status
}

async function runTests(ids) {
  const managerJar = await login(ids.managerOne.email)
  const cookie = cookieHeader(managerJar)
  const jsonHeaders = { 'Content-Type': 'application/json', Cookie: cookie }

  const tests = [
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
  ]

  const failed = tests.filter(([, actual, expected]) => actual !== expected)
  for (const [name, actual, expected] of tests) {
    console.log(`${actual === expected ? 'PASS' : 'FAIL'} ${name}: expected ${expected}, got ${actual}`)
  }

  if (failed.length) {
    process.exitCode = 1
  }
}

async function main() {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  runPrismaPush()
  const ids = await seedDatabase()
  const server = startServer()
  try {
    await waitForServer()
    await runTests(ids)
  } finally {
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
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => {
  process.exit(process.exitCode || 0)
})
