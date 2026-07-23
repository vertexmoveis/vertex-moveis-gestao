import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { del, list, put } from '@vercel/blob'
import { prisma } from '@/lib/db'

const BACKUP_TABLES = [
  'User',
  'LoginEvent',
  'Client',
  'CompanyProfile',
  'MaterialCatalogItem',
  'QuotePriceRule',
  'OperationalResource',
  'Project',
  'ProjectPortalAccess',
  'Quote',
  'QuoteItem',
  'QuoteRevision',
  'QuoteApprovalRequest',
  'ProjectMaterial',
  'ProjectExpense',
  'InstallationSchedule',
  'ProjectEnvironment',
  'ProjectPayment',
  'PaymentHistory',
  'ProjectChecklistItem',
  'Note',
  'ProjectFile',
  'TimelineEvent',
  'ActivityLog',
  'SystemEvent',
] as const

const BACKUP_PREFIX = 'backups/database/'
const RETENTION_DAYS = 30

type BackupEnvelope = {
  format: 'vertex-postgresql-backup-encrypted-v1'
  algorithm: 'aes-256-gcm'
  salt: string
  iv: string
  tag: string
  checksum: string
  ciphertext: string
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function backupTimestamp(date = new Date()) {
  return date.toISOString().replace(/\D/g, '').slice(0, 17)
}

function getEncryptionKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY?.trim()
  if (!secret || secret.length < 24) {
    throw new Error('BACKUP_ENCRYPTION_KEY não está configurada corretamente.')
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptCloudBackup(payload: unknown, secretKey = getEncryptionKey()): BackupEnvelope {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = createHash('sha256').update(Buffer.concat([secretKey, salt])).digest()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])

  return {
    format: 'vertex-postgresql-backup-encrypted-v1',
    algorithm: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    checksum: createHash('sha256').update(plaintext).digest('hex'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function verifyCloudBackup(envelope: BackupEnvelope, secretKey = getEncryptionKey()) {
  const salt = Buffer.from(envelope.salt, 'base64')
  const iv = Buffer.from(envelope.iv, 'base64')
  const key = createHash('sha256').update(Buffer.concat([secretKey, salt])).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ])
  const checksum = createHash('sha256').update(plaintext).digest('hex')
  if (checksum !== envelope.checksum) throw new Error('A verificação de integridade do backup falhou.')
  return JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>
}

async function createSnapshot() {
  const tables: Record<string, unknown[]> = {}

  for (const table of BACKUP_TABLES) {
    tables[table] = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier('id')}`,
    )
  }

  const migrations = await prisma.$queryRawUnsafe<unknown[]>(
    'SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at ASC',
  )

  return {
    format: 'vertex-postgresql-backup-v1',
    createdAt: new Date().toISOString(),
    migrations,
    tables,
  }
}

async function cleanExpiredBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const expired: string[] = []
  let cursor: string | undefined

  do {
    const page = await list({ prefix: BACKUP_PREFIX, cursor, limit: 1000 })
    for (const blob of page.blobs) {
      if (blob.uploadedAt.getTime() < cutoff) expired.push(blob.url)
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  if (expired.length > 0) await del(expired)
  return expired.length
}

export async function createCloudBackup() {
  const snapshot = await createSnapshot()
  const envelope = encryptCloudBackup(snapshot)
  const verified = verifyCloudBackup(envelope)
  if (verified.format !== snapshot.format || verified.createdAt !== snapshot.createdAt) {
    throw new Error('O conteúdo verificado não corresponde ao backup criado.')
  }

  const body = Buffer.from(JSON.stringify(envelope), 'utf8')
  const fileName = `vertex-postgres-${backupTimestamp()}.json.enc`
  const blob = await put(`${BACKUP_PREFIX}${fileName}`, body, {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/octet-stream',
    cacheControlMaxAge: 60,
  })
  const removed = await cleanExpiredBackups()
  const totalRows = Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)

  return {
    fileName,
    pathname: blob.pathname,
    retentionDays: RETENTION_DAYS,
    encrypted: true,
    verified: true,
    totalRows,
    bytes: body.byteLength,
    removed,
  }
}
