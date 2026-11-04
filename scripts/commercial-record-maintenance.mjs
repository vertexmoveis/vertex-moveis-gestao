import { constants, createCipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

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
  if (process.env.MAINTENANCE_MODE !== 'audit') throw new Error('INVALID_MODE')
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
} catch (error) {
  if (publicKey) encryptedResult({ success: false, error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database]') : 'AUDIT_FAILED' })
  console.error('Audit failed. See encrypted result.')
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
