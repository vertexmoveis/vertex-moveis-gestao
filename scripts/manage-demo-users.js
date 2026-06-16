/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const suspiciousEmails = [
  'admin@demo.com',
  'demo@demo.com',
  'test@test.com',
  'admin@example.com',
  'admin@vertexmoveis.com.br',
  'carlos@vertexmoveis.com.br',
  'ana@vertexmoveis.com.br',
]

function maskEmail(email) {
  const [local, domain] = email.split('@')
  if (!domain) return '[invalid-email]'
  return `${local.slice(0, 2)}***@${domain}`
}

function randomPassword() {
  return randomBytes(32).toString('base64url')
}

async function findSuspiciousUsers() {
  return prisma.user.findMany({
    where: {
      OR: [
        { email: { in: suspiciousEmails } },
        { name: { contains: 'demo' } },
        { name: { contains: 'Demo' } },
        { name: { contains: 'test' } },
        { name: { contains: 'Test' } },
        { name: { contains: 'teste' } },
        { name: { contains: 'Teste' } },
      ],
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
}

async function main() {
  const action = process.argv.find((arg) => arg.startsWith('--action='))?.split('=')[1] || 'list'
  const users = await findSuspiciousUsers()

  if (action === 'list') {
    console.log(JSON.stringify({
      suspiciousUsers: users.map((user) => ({
        id: user.id,
        email: maskEmail(user.email),
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      })),
    }, null, 2))
    return
  }

  if (!['reset-password', 'disable', 'delete'].includes(action)) {
    throw new Error('Use --action=list, --action=reset-password, --action=disable, or --action=delete.')
  }

  if (process.env.CONFIRM_DEMO_USER_ACTION !== 'true') {
    throw new Error('Set CONFIRM_DEMO_USER_ACTION=true to modify suspicious users.')
  }

  const results = []
  for (const user of users) {
    if (action === 'delete') {
      await prisma.user.delete({ where: { id: user.id } })
      results.push({ id: user.id, action: 'deleted', email: maskEmail(user.email) })
      continue
    }

    const data = {
      password: await bcrypt.hash(randomPassword(), 12),
    }

    if (action === 'disable') {
      data.email = `disabled-${user.id}@disabled.local`
      data.name = `Disabled ${user.id.slice(-6)}`
    }

    await prisma.user.update({ where: { id: user.id }, data })
    results.push({ id: user.id, action, email: maskEmail(user.email) })
  }

  console.log(JSON.stringify({ modified: results }, null, 2))
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
