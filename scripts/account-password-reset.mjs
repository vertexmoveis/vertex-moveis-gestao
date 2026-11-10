import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

async function main() {
const rawPlan = process.env.ACCOUNT_PASSWORD_RESET_PLAN || ''
const planDigest = createHash('sha256').update(rawPlan).digest('hex')
assert.ok(process.env.RESET_PLAN_SHA256 && planDigest === process.env.RESET_PLAN_SHA256, 'PLAN_MISMATCH')
const plan = JSON.parse(rawPlan)
assert.equal(plan.operation, 'RESET_OWN_ACCOUNT_PASSWORD')
assert.ok(typeof plan.operationId === 'string' && /^[a-f0-9-]{36}$/.test(plan.operationId), 'INVALID_OPERATION')
assert.ok(typeof plan.userId === 'string' && typeof plan.email === 'string' && typeof plan.name === 'string', 'INVALID_TARGET')
assert.equal(plan.role, 'MANAGER')
assert.ok(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(plan.passwordHash), 'INVALID_PASSWORD_HASH')
assert.equal(bcrypt.getRounds(plan.passwordHash), 12)
assert.ok(Date.parse(plan.createdAt) <= Date.now() && Date.parse(plan.expiresAt) > Date.now(), 'PLAN_EXPIRED')
assert.ok(Date.parse(plan.expiresAt) - Date.parse(plan.createdAt) <= 60 * 60 * 1000, 'INVALID_PLAN_WINDOW')
const databaseURL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
assert.ok(databaseURL, 'DATABASE_NOT_CONFIGURED')
const prisma = new PrismaClient({ datasources: { db: { url: databaseURL } }, log: [] })

try {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${plan.userId} FOR UPDATE`
    const current = await tx.user.findUnique({ where: { id: plan.userId } })
    assert.ok(current && current.id === plan.userId && current.email === plan.email
      && current.name === plan.name && current.role === plan.role && current.active, 'TARGET_MISMATCH')
    const auditDetails = `Redefinição de senha solicitada pelo titular no suporte. Operação ${plan.operationId}. Sessões anteriores encerradas.`
    const previous = await tx.activityLog.findFirst({ where: { userId: current.id, action: 'Senha redefinida pelo suporte', details: auditDetails } })
    if (previous) {
      assert.equal(current.password, plan.passwordHash, 'ALREADY_CHANGED_AFTER_RESET')
      return
    }
    const now = new Date()
    const updated = await tx.user.update({
      where: { id: current.id },
      data: { password: plan.passwordHash, passwordChangedAt: now, sessionVersion: { increment: 1 } },
    })
    assert.equal(updated.password, plan.passwordHash)
    assert.equal(updated.passwordChangedAt?.getTime(), now.getTime())
    assert.equal(updated.sessionVersion, current.sessionVersion + 1)
    for (const key of ['id', 'name', 'email', 'role', 'active', 'twoFactorEnabled', 'twoFactorSecret']) {
      assert.equal(updated[key], current[key], 'UNRELATED_FIELD_CHANGED')
    }
    assert.equal(updated.lastLoginAt?.getTime(), current.lastLoginAt?.getTime(), 'UNRELATED_FIELD_CHANGED')
    await tx.activityLog.create({ data: { userId: current.id, action: 'Senha redefinida pelo suporte', details: auditDetails } })
  }, { isolationLevel: 'Serializable', timeout: 20000 })
  console.log('PASSWORD_RESET_APPLIED_AND_VERIFIED')
} finally {
  await prisma.$disconnect()
}
}

main().catch(() => {
  console.error('PASSWORD_RESET_FAILED_WITHOUT_CREDENTIAL_OUTPUT')
  process.exitCode = 1
})
