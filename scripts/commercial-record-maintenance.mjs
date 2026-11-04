import { constants, createCipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { Prisma, PrismaClient } from '@prisma/client'

const db = new PrismaClient({ log: [] })
let publicKey
function encryptedResult(payload) {
  const aesKey = randomBytes(32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
  const encryptedKey = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey)
  aesKey.fill(0)
  writeFileSync('commercial-record-result.encrypted.json', JSON.stringify({
    version: 1, algorithm: 'RSA-OAEP-256+A256GCM', encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'),
  }))
}

try {
  publicKey = createPublicKey(Buffer.from(process.env.MAINTENANCE_PUBLIC_KEY || '', 'base64').toString())
  if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 2048) throw new Error('INVALID_PUBLIC_KEY')
  const plan = JSON.parse(process.env.COMMERCIAL_RECORD_MAINTENANCE_PLAN || '')
  if (!Array.isArray(plan.clientNames) || !plan.clientNames.length || plan.clientNames.length > 5 || plan.clientNames.some(name => typeof name !== 'string' || name.length < 3 || name.length > 100)) throw new Error('INVALID_PLAN')
  const mode = process.env.MAINTENANCE_MODE
  if (!['audit', 'apply'].includes(mode)) throw new Error('INVALID_MODE')
  if (mode === 'apply') {
    if (!Array.isArray(plan.targets) || plan.targets.length < 1 || plan.targets.length > 5 || typeof plan.actorId !== 'string') throw new Error('INVALID_EXACT_PLAN')
    const { convertApprovedQuote } = await import('../lib/quote-conversion.ts')
    const { buildFinanceCommercialReport } = await import('../lib/finance-commercial-report.ts')
    const result = await db.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: plan.actorId }, select: { id: true, name: true, role: true, active: true } })
      if (!actor?.active || !['ADMIN', 'MANAGER'].includes(actor.role)) throw new Error('ACTOR_NOT_AUTHORIZED')
      const changes = []
      for (const target of plan.targets) {
        if (!target.id || !target.clientId || !target.ownerId || !target.updatedAt || !Number.isFinite(target.value)) throw new Error('EXACT_GUARDS_REQUIRED')
        if (actor.role !== 'ADMIN' && target.ownerId !== actor.id) throw new Error('OWNER_MISMATCH')
        if (target.kind === 'PROJECT_SALE_DATE') {
          await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${target.id} FOR UPDATE`
          const before = await tx.project.findUnique({ where: { id: target.id } })
          if (!before || before.archivedAt || before.clientId !== target.clientId || before.managerId !== target.ownerId || before.updatedAt.toISOString() !== target.updatedAt || Number(before.value) !== target.value || before.approvalDate?.toISOString() !== target.previousDate) throw new Error('PROJECT_CHANGED')
          const date = new Date(target.saleDate)
          if (!Number.isFinite(date.getTime()) || date.toISOString() !== target.saleDate || !/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/.test(target.saleDate)) throw new Error('INVALID_SALE_DATE')
          const after = await tx.project.update({ where: { id: target.id }, data: { approvalDate: date } })
          if (before.startDate?.toISOString() !== after.startDate?.toISOString() || before.deliveryDeadlineDate?.toISOString() !== after.deliveryDeadlineDate?.toISOString()) throw new Error('OPERATIONAL_DATES_CHANGED')
          changes.push({ kind: target.kind, id: after.id, clientId: after.clientId, name: after.name, value: Number(after.value), beforeDate: before.approvalDate, saleDate: after.approvalDate, operationalDatesPreserved: true, reason: target.reason })
        } else if (target.kind === 'APPROVED_QUOTE_SALE') {
          if (!target.groupId) throw new Error('GROUP_GUARD_REQUIRED')
          await tx.$queryRaw`SELECT "id" FROM "QuoteGroup" WHERE "id" = ${target.groupId} FOR UPDATE`
          await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "id" = ${target.id} FOR UPDATE`
          const before = await tx.quote.findUnique({ where: { id: target.id } })
          if (!before || before.archivedAt || before.status !== 'APPROVED' || before.convertedProjectId || before.clientId !== target.clientId || before.createdById !== target.ownerId || before.groupId !== target.groupId || before.updatedAt.toISOString() !== target.updatedAt || Number(before.total) !== target.value) throw new Error('QUOTE_CHANGED')
          await convertApprovedQuote(tx, { quoteId: target.id, user: actor })
          const after = await tx.quote.findUniqueOrThrow({ where: { id: target.id } })
          const project = await tx.project.findUniqueOrThrow({ where: { id: after.convertedProjectId }, include: { payments: true } })
          if (after.status !== 'SOLD' || !after.soldAt || !after.convertedProjectId || project.clientId !== target.clientId || project.payments.some(payment => payment.paidAt)) throw new Error('SALE_POSTCONDITION_FAILED')
          changes.push({ kind: target.kind, id: after.id, clientId: after.clientId, name: after.title, value: Number(after.total), beforeStatus: before.status, status: after.status, soldAt: after.soldAt, projectId: project.id, projectSaleDate: project.approvalDate, paymentsUnpaid: true })
        } else throw new Error('UNSUPPORTED_TARGET_KIND')
        await tx.activityLog.create({ data: { userId: actor.id, action: 'Registro comercial ajustado', details: JSON.stringify(changes.at(-1)) } })
      }
      const clientIds = [...new Set(plan.targets.map(target => target.clientId))]
      const [projects, quotes] = await Promise.all([
        tx.project.findMany({ where: { clientId: { in: clientIds } }, include: { client: { select: { name: true } }, sourceQuote: { select: { id: true, groupId: true } } } }),
        tx.quote.findMany({ where: { clientId: { in: clientIds } }, include: { client: { select: { name: true } }, revisions: { select: { snapshot: true, createdAt: true } } } }),
      ])
      const reports = ['2026-10', '2026-11'].map(month => {
        const report = buildFinanceCommercialReport({ month, projects, quotes, now: new Date() })
        return { month, sold: report.sold, negotiating: report.negotiating }
      })
      for (const target of plan.targets) {
        const month = target.kind === 'PROJECT_SALE_DATE' ? target.saleDate.slice(0, 7) : '2026-11'
        const items = reports.find(report => report.month === month)?.sold.items || []
        const matches = items.filter(item => item.amount === target.value && (target.kind === 'PROJECT_SALE_DATE' ? item.projectId === target.id : item.quoteId === target.id))
        if (matches.length !== 1) throw new Error('REPORT_POSTCONDITION_FAILED')
      }
      return { changes, reports }
    }, { timeout: 45_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    encryptedResult({ success: true, mode, completedAt: new Date().toISOString(), result })
    console.log('Selected commercial changes verified; encrypted result written.')
  } else {
  const clients = await db.client.findMany({ where: {
    OR: plan.clientNames.map(name => ({ name: { contains: name, mode: 'insensitive' } })),
  }, select: { id: true, name: true, managerId: true, archivedAt: true, relationshipStage: true } })
  const clientIds = clients.map(client => client.id)
  const [quotes, projects, contracts] = await Promise.all([
    db.quote.findMany({ where: { clientId: { in: clientIds } }, select: {
      id: true, clientId: true, groupId: true, title: true, number: true, variationOrder: true, total: true, status: true,
      createdById: true, createdAt: true, updatedAt: true, sentAt: true, approvedAt: true, soldAt: true, lostAt: true,
      archivedAt: true, convertedProjectId: true,
    } }),
    db.project.findMany({ where: { clientId: { in: clientIds } }, select: {
      id: true, clientId: true, name: true, value: true, managerId: true, stage: true,
      createdAt: true, updatedAt: true, approvalDate: true, startDate: true, archivedAt: true,
      sourceQuote: { select: { id: true, groupId: true } },
    } }),
    db.projectContract.findMany({ where: { clientId: { in: clientIds }, projectId: null }, select: {
      id: true, clientId: true, standaloneTitle: true, status: true, version: true, signedAt: true,
      voidedAt: true, createdAt: true, updatedAt: true,
    } }),
  ])
  const ownerIds = [...new Set(clients.map(client => client.managerId).filter(Boolean))]
  const owners = await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, role: true, active: true } })
  encryptedResult({ success: true, mode: 'audit', completedAt: new Date().toISOString(), result: { clients, quotes, projects, contracts, owners } })
  console.log('Encrypted audit completed.')
  }
} catch (error) {
  if (publicKey) encryptedResult({ success: false, error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database]') : 'AUDIT_FAILED' })
  console.error('Audit failed. See encrypted result.')
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
