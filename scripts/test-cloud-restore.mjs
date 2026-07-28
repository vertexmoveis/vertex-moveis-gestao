import { execFileSync } from 'node:child_process'
import {
  createDecipheriv,
  createHash,
  randomUUID,
} from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { get, list } from '@vercel/blob'
import { Client } from 'pg'
import { loadDatabaseEnv } from './database-env.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const backupPrefix = 'backups/database/'
const tableOrder = [
  'User',
  'LoginEvent',
  'Client',
  'CompanyProfile',
  'MaterialCatalogItem',
  'MaterialSupplierPrice',
  'QuotePriceRule',
  'OperationalResource',
  'Project',
  'ProjectPortalAccess',
  'ProjectContract',
  'WarrantyTicket',
  'QuoteGroup',
  'Quote',
  'QuoteItem',
  'QuoteRevision',
  'QuoteApprovalRequest',
  'QuoteApprovalOption',
  'ProjectMaterial',
  'ProjectExpense',
  'InstallationSchedule',
  'ProjectEnvironment',
  'ProjectPayment',
  'PaymentHistory',
  'WhatsAppMessage',
  'ProjectChecklistItem',
  'Note',
  'ProjectFile',
  'TimelineEvent',
  'ActivityLog',
  'SystemEvent',
]

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return values
      const separator = trimmed.indexOf('=')
      if (separator < 1) return values
      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      values[key] = value
      return values
    }, {})
}

function loadOptionalProjectEnv() {
  const values = {
    ...parseEnvFile(path.join(projectRoot, '.env.production.local')),
    ...parseEnvFile(path.join(projectRoot, '.env')),
    ...parseEnvFile(path.join(projectRoot, '.env.local')),
  }
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function withSchema(connectionString, schema) {
  const url = new URL(connectionString)
  url.searchParams.set('schema', schema)
  return url.toString()
}

function sameDatabase(leftConnectionString, rightConnectionString) {
  const left = new URL(leftConnectionString)
  const right = new URL(rightConnectionString)
  return left.hostname === right.hostname
    && left.port === right.port
    && left.pathname === right.pathname
}

function safeMessage(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[conexao removida]')
    .replace(/(password|token|secret)=([^&\s]+)/gi, '$1=[removido]')
    .slice(0, 1000)
}

function decryptCloudBackup(envelope) {
  if (
    !envelope
    || envelope.format !== 'vertex-postgresql-backup-encrypted-v1'
    || envelope.algorithm !== 'aes-256-gcm'
  ) {
    throw new Error('O arquivo da nuvem não possui o formato criptografado esperado.')
  }
  const configuredSecret = process.env.BACKUP_ENCRYPTION_KEY?.trim()
  if (!configuredSecret || configuredSecret.length < 24) {
    throw new Error('BACKUP_ENCRYPTION_KEY não está configurada corretamente.')
  }

  const baseKey = createHash('sha256').update(configuredSecret, 'utf8').digest()
  const salt = Buffer.from(envelope.salt, 'base64')
  const iv = Buffer.from(envelope.iv, 'base64')
  const key = createHash('sha256').update(Buffer.concat([baseKey, salt])).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ])
  const checksum = createHash('sha256').update(plaintext).digest('hex')
  if (checksum !== envelope.checksum) throw new Error('A integridade do backup da nuvem falhou.')
  return JSON.parse(plaintext.toString('utf8'))
}

async function latestCloudBackup() {
  let cursor
  let latest = null
  do {
    const page = await list({ prefix: backupPrefix, cursor, limit: 1000 })
    for (const blob of page.blobs) {
      if (!latest || blob.uploadedAt > latest.uploadedAt) latest = blob
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  if (!latest) throw new Error('Nenhum backup foi encontrado na nuvem privada.')
  return latest
}

function pushTemporarySchema(databaseUrl) {
  execFileSync(
    process.execPath,
    [
      path.join('node_modules', 'prisma', 'build', 'index.js'),
      'db',
      'push',
      '--schema',
      'prisma/schema.prisma',
      '--skip-generate',
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_URL_UNPOOLED: databaseUrl,
      },
      stdio: 'ignore',
    },
  )
}

async function recordEvent(databaseUrl, event) {
  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    await client.query(
      'INSERT INTO "SystemEvent" ("id", "type", "severity", "source", "message", "details", "createdAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)',
      [
        randomUUID(),
        event.type,
        event.severity,
        'cloud-restore-test',
        safeMessage(event.message),
        JSON.stringify(event.details || {}),
      ],
    )
  } catch {
    // O resultado principal do teste continua válido mesmo sem o registro de auditoria.
  } finally {
    await client.end().catch(() => {})
  }
}

async function restoreSnapshot(snapshot, targetDatabaseUrl) {
  if (!snapshot || snapshot.format !== 'vertex-postgresql-backup-v1' || !snapshot.tables) {
    throw new Error('O conteúdo descriptografado não possui o formato de backup esperado.')
  }

  const schema = `vertex_cloud_restore_${process.pid}_${Math.random().toString(36).slice(2, 9)}`
  const schemaUrl = withSchema(targetDatabaseUrl, schema)
  const admin = new Client({ connectionString: targetDatabaseUrl })
  let totalRows = 0
  let missingTables = 0

  try {
    await admin.connect()
    await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`)
    pushTemporarySchema(schemaUrl)

    const restored = new Client({ connectionString: schemaUrl })
    try {
      await restored.connect()
      await restored.query(`SET search_path TO ${quoteIdentifier(schema)}`)

      for (const table of tableOrder) {
        const rows = Array.isArray(snapshot.tables[table]) ? snapshot.tables[table] : []
        if (!Array.isArray(snapshot.tables[table])) missingTables += 1
        totalRows += rows.length
        if (rows.length === 0) continue

        const columns = Object.keys(rows[0])
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        const statement = `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`
        for (const row of rows) {
          await restored.query(statement, columns.map((column) => row[column]))
        }
      }

      for (const table of tableOrder) {
        const expected = Array.isArray(snapshot.tables[table]) ? snapshot.tables[table].length : 0
        const result = await restored.query(
          `SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(table)}`,
        )
        if (Number(result.rows[0]?.total || 0) !== expected) {
          throw new Error(`A restauração não conferiu a tabela ${table}.`)
        }
      }
    } finally {
      await restored.end().catch(() => {})
    }
  } finally {
    await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`).catch(() => {})
    await admin.end().catch(() => {})
  }

  return { totalRows, missingTables }
}

async function run() {
  loadOptionalProjectEnv()
  const { directUrl } = loadDatabaseEnv()
  const configuredTarget = process.env.RESTORE_TEST_DATABASE_URL?.trim()
  const targetDatabaseUrl = configuredTarget || directUrl
  const externalDatabase = Boolean(configuredTarget && !sameDatabase(configuredTarget, directUrl))

  const latest = await latestCloudBackup()
  const blob = await get(latest.pathname, { access: 'private', useCache: false })
  if (!blob || blob.statusCode !== 200) throw new Error('Não foi possível baixar o backup privado.')
  const envelope = JSON.parse(await new Response(blob.stream).text())
  const snapshot = decryptCloudBackup(envelope)
  const restored = await restoreSnapshot(snapshot, targetDatabaseUrl)

  const result = {
    success: true,
    source: 'vercel-blob-private',
    fileName: latest.pathname.split('/').at(-1),
    externalDatabase,
    createdAt: snapshot.createdAt || null,
    totalRows: restored.totalRows,
    missingTables: restored.missingTables,
  }
  await recordEvent(directUrl, {
    type: 'RESTORE_TEST_SUCCESS',
    severity: 'INFO',
    message: externalDatabase
      ? 'Backup da nuvem restaurado e conferido em banco externo.'
      : 'Backup da nuvem restaurado e conferido em esquema isolado.',
    details: result,
  })
  return result
}

run()
  .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch(async (error) => {
    try {
      loadOptionalProjectEnv()
      const { directUrl } = loadDatabaseEnv()
      await recordEvent(directUrl, {
        type: 'RESTORE_TEST_FAILURE',
        severity: 'ERROR',
        message: error instanceof Error ? error.message : 'Falha no teste de restauração.',
      })
    } catch {
      // A mensagem original é mantida abaixo.
    }
    process.stderr.write(`${safeMessage(error instanceof Error ? error.message : error)}\n`)
    process.exitCode = 1
  })
