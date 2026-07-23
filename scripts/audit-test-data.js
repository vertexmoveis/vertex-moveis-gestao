/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')

let prisma

function maskEmail(email) {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!domain) return '[invalid-email]'
  return `${local.slice(0, 2)}***@${domain}`
}

function maskPhone(phone) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return '***'
  return `${'*'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`
}

function redactRecord(record) {
  return {
    id: record.id,
    name: record.name,
    email: maskEmail(record.email),
    phone: maskPhone(record.phone || record.whatsapp),
    reason: record.reason,
  }
}

async function main() {
  const { loadDatabaseEnv } = await import('./database-env.mjs')
  loadDatabaseEnv()
  prisma = new PrismaClient()

  const userMatches = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: ['admin@demo.com', 'demo@demo.com', 'test@test.com', 'admin@example.com', 'carlos@vertexmoveis.com.br', 'ana@vertexmoveis.com.br'] } },
        { email: { contains: 'example' } },
        { name: { contains: 'demo' } },
        { name: { contains: 'Demo' } },
        { name: { contains: 'test' } },
        { name: { contains: 'Test' } },
        { name: { contains: 'teste' } },
        { name: { contains: 'Teste' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
  })

  const clientMatches = await prisma.client.findMany({
    where: {
      OR: [
        { name: { in: ['Roberto Almeida', 'Fernanda Costa', 'Marcos Pereira', 'Juliana Santos', 'Ricardo Oliveira', 'Patricia Lima', 'Eduardo Martins'] } },
        { email: { contains: 'example' } },
        { email: { contains: 'email.com' } },
        { phone: { contains: '99999' } },
        { whatsapp: { contains: '99999' } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true, whatsapp: true },
  })

  const projectMatches = await prisma.project.findMany({
    where: {
      OR: [
        { name: { in: ['Cozinha Completa', 'Home Office', 'Closet Master', 'Escritorio Corporativo', 'Dormitorio Casal', 'Cozinha Americana', 'Banheiro Casal', 'Varanda Gourmet'] } },
        { internalNotes: { contains: 'Freijo' } },
        { internalNotes: { contains: 'reordenar material' } },
      ],
    },
    select: { id: true, name: true },
  })

  const report = {
    generatedAt: new Date().toISOString(),
    users: userMatches.map((user) => ({
      id: user.id,
      email: maskEmail(user.email),
      name: user.name,
      role: user.role,
      reason: 'suspicious demo/test user',
    })),
    clients: clientMatches.map((client) => redactRecord({ ...client, reason: 'suspicious demo/test client' })),
    projects: projectMatches.map((project) => ({
      id: project.id,
      name: project.name,
      reason: 'suspicious demo/test project',
    })),
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma?.$disconnect())
