/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const readline = require('node:readline/promises')
const { stdin: input, stdout: output } = require('node:process')

const prisma = new PrismaClient()

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 14 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

async function promptMissing() {
  const rl = readline.createInterface({ input, output })
  const email = process.env.ADMIN_EMAIL || (await rl.question('Admin email: '))
  const password = process.env.ADMIN_PASSWORD || (await rl.question('Admin password: '))
  rl.close()
  return { email: email.trim().toLowerCase(), password }
}

async function main() {
  const { email, password } = await promptMissing()

  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  if (!isStrongPassword(password)) {
    throw new Error('ADMIN_PASSWORD must be at least 14 chars and include uppercase, lowercase, number, and symbol.')
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  })

  if (existingAdmin && process.env.CONFIRM_OVERWRITE_ADMIN !== 'true') {
    throw new Error('An admin already exists. Set CONFIRM_OVERWRITE_ADMIN=true to create another admin intentionally.')
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })

  if (existingUser && process.env.CONFIRM_OVERWRITE_ADMIN !== 'true') {
    throw new Error('A user with this email already exists. Set CONFIRM_OVERWRITE_ADMIN=true to promote/reset it.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { password: passwordHash, role: 'ADMIN' },
    })
    console.log(JSON.stringify({ success: true, action: 'updated', email }))
    return
  }

  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME || 'Admin',
      email,
      password: passwordHash,
      role: 'ADMIN',
    },
  })

  console.log(JSON.stringify({ success: true, action: 'created', email }))
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
