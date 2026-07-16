import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { loadDatabaseEnv } from './database-env.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const backupDir = path.resolve(process.env.BACKUP_DIRECTORY || path.join(projectRoot, 'backups'))
// A second copy is opt-in because it may leave the Vertex computer.
const secondaryDirectory = process.env.BACKUP_SECONDARY_DIR?.trim() || ''
const retentionDays = Math.max(Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10) || 30, 1)
const backupPattern = /^vertex-postgres-\d{14}-\d{3}\.json$/
const tableOrder = [
  'User',
  'Client',
  'MaterialCatalogItem',
  'QuotePriceRule',
  'OperationalResource',
  'Project',
  'Quote',
  'QuoteItem',
  'QuoteRevision',
  'QuoteApprovalRequest',
  'ProjectMaterial',
  'InstallationSchedule',
  'ProjectEnvironment',
  'ProjectPayment',
  'PaymentHistory',
  'ProjectChecklistItem',
  'Note',
  'ProjectFile',
  'TimelineEvent',
  'ActivityLog',
]

function timestamp() {
  const now = new Date()
  const date = now.toISOString().slice(0, 19).replace(/[-:T]/g, '')
  return `${date}-${String(now.getMilliseconds()).padStart(3, '0')}`
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function withSchema(connectionString, schema) {
  const url = new URL(connectionString)
  url.searchParams.set('schema', schema)
  return url.toString()
}

function resolveSecondaryDirectory() {
  return secondaryDirectory ? path.resolve(secondaryDirectory) : null
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== 'vertex-postgresql-backup-v1' || !snapshot.tables) {
    throw new Error('O arquivo de backup nao possui o formato esperado.')
  }

  for (const table of tableOrder) {
    if (!Array.isArray(snapshot.tables[table])) {
      throw new Error(`O backup nao possui dados validos para ${table}.`)
    }
  }
}

async function readSnapshot(filePath) {
  const snapshot = JSON.parse(await readFile(filePath, 'utf8'))
  validateSnapshot(snapshot)
  return snapshot
}

async function cleanOldBackups(directory) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const entries = await readdir(directory, { withFileTypes: true })
  const removed = []

  for (const entry of entries) {
    if (!entry.isFile() || !backupPattern.test(entry.name)) continue
    const candidate = path.join(directory, entry.name)
    const candidateStat = await stat(candidate)
    if (candidateStat.mtimeMs < cutoff) {
      await rm(candidate, { force: true })
      removed.push(entry.name)
    }
  }

  return removed
}

function pushTemporarySchema(databaseUrl) {
  execFileSync(
    process.execPath,
    [path.join('node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
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

async function restoreTest(snapshot, directUrl) {
  const schema = `vertex_backup_test_${process.pid}_${Math.random().toString(36).slice(2, 10)}`
  const testUrl = withSchema(directUrl, schema)
  const admin = new Client({ connectionString: directUrl })

  try {
    await admin.connect()
    await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`)
    pushTemporarySchema(testUrl)

    const restored = new Client({ connectionString: testUrl })
    try {
      await restored.connect()
      await restored.query(`SET search_path TO ${quoteIdentifier(schema)}`)
      for (const table of tableOrder) {
        const rows = snapshot.tables[table]
        if (!rows.length) continue

        const columns = Object.keys(rows[0])
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        const statement = `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`
        for (const row of rows) {
          await restored.query(statement, columns.map((column) => row[column]))
        }
      }

      for (const table of tableOrder) {
        const result = await restored.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(table)}`)
        if (Number(result.rows[0]?.total || 0) !== snapshot.tables[table].length) {
          throw new Error(`O teste de restauracao falhou em ${table}.`)
        }
      }
    } finally {
      await restored.end().catch(() => {})
    }
  } finally {
    await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`).catch(() => {})
    await admin.end().catch(() => {})
  }
}

async function createBackup() {
  const { directUrl } = loadDatabaseEnv()
  if (!/^postgres(ql)?:\/\//.test(directUrl)) {
    throw new Error('O backup da versao web exige uma conexao PostgreSQL.')
  }

  const source = new Client({ connectionString: directUrl })
  const tables = {}
  let migrations = []

  try {
    await source.connect()
    for (const table of tableOrder) {
      const result = await source.query(`SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier('id')}`)
      tables[table] = result.rows
    }

    const migrationResult = await source.query(
      'SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at ASC',
    )
    migrations = migrationResult.rows
  } finally {
    await source.end().catch(() => {})
  }

  const fileName = `vertex-postgres-${timestamp()}.json`
  const snapshot = {
    format: 'vertex-postgresql-backup-v1',
    createdAt: new Date().toISOString(),
    migrations,
    tables,
  }
  validateSnapshot(snapshot)

  await mkdir(backupDir, { recursive: true })
  const targetPath = path.join(backupDir, fileName)
  await writeFile(targetPath, JSON.stringify(snapshot), 'utf8')
  const verifiedSnapshot = await readSnapshot(targetPath)
  await restoreTest(verifiedSnapshot, directUrl)

  const removedLocal = await cleanOldBackups(backupDir)
  const secondaryDir = resolveSecondaryDirectory()
  let secondaryPath = null
  let removedSecondary = []

  if (secondaryDir) {
    await mkdir(secondaryDir, { recursive: true })
    secondaryPath = path.join(secondaryDir, fileName)
    await copyFile(targetPath, secondaryPath)
    await readSnapshot(secondaryPath)
    removedSecondary = await cleanOldBackups(secondaryDir)
  }

  const totalRows = tableOrder.reduce((sum, table) => sum + snapshot.tables[table].length, 0)
  return {
    success: true,
    fileName,
    path: targetPath,
    secondaryPath,
    retentionDays,
    verified: true,
    restoreTested: true,
    totalRows,
    removed: removedLocal.length + removedSecondary.length,
  }
}

createBackup()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`)
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Nao foi possivel criar o backup PostgreSQL.'}\n`)
    process.exitCode = 1
  })
