import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { loadDatabaseEnv } from './database-env.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const defaultSourcePath = path.join(projectRoot, 'prisma', 'dev.db')
const sourcePath = path.resolve(process.env.SQLITE_DATABASE_PATH || defaultSourcePath)

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

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function normalizeValue(value, columnType) {
  if (value === null || value === undefined) return null

  const type = String(columnType || '').toUpperCase()
  if (type.includes('BOOLEAN')) return Boolean(value)
  if (type.includes('DATETIME') && typeof value === 'number') return new Date(value)

  return value
}

function loadSourceRows(sqlite) {
  const sourceTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'")
    .all()
    .map((row) => row.name)

  const unknownTables = sourceTables.filter((table) => !tableOrder.includes(table))
  if (unknownTables.length) {
    throw new Error(`Existem tabelas locais sem mapeamento: ${unknownTables.join(', ')}.`)
  }

  const missingTables = tableOrder.filter((table) => !sourceTables.includes(table))
  if (missingTables.length) {
    throw new Error(`Faltam tabelas locais esperadas: ${missingTables.join(', ')}.`)
  }

  return tableOrder.map((table) => {
    const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all()
    const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all()
    return { table, columns, rows }
  })
}

async function assertRemoteIsEmpty(client, sourceTables) {
  for (const { table } of sourceTables) {
    const tableExists = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists",
      [table],
    )
    if (!tableExists.rows[0]?.exists) {
      throw new Error(`A tabela ${table} nao existe no PostgreSQL. Execute a migracao de estrutura antes de copiar os dados.`)
    }

    const count = await client.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(table)}`)
    if (Number(count.rows[0]?.total || 0) > 0) {
      throw new Error(`O PostgreSQL ja possui dados na tabela ${table}. A copia foi bloqueada para evitar duplicacao.`)
    }
  }
}

async function importRows(client, sourceTables) {
  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'")

    for (const { table, columns, rows } of sourceTables) {
      if (!rows.length) continue

      const columnNames = columns.map((column) => column.name)
      const quotedColumns = columnNames.map(quoteIdentifier).join(', ')
      const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(', ')
      const statement = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`

      for (const row of rows) {
        const values = columns.map((column) => normalizeValue(row[column.name], column.type))
        await client.query(statement, values)
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function validateCounts(client, sourceTables) {
  const counts = []
  for (const { table, rows } of sourceTables) {
    const result = await client.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(table)}`)
    const targetCount = Number(result.rows[0]?.total || 0)
    if (targetCount !== rows.length) {
      throw new Error(`A validacao falhou em ${table}: local ${rows.length}, PostgreSQL ${targetCount}.`)
    }
    counts.push({ table, rows: targetCount })
  }
  return counts
}

async function main() {
  if (!existsSync(sourcePath)) throw new Error('Banco SQLite de origem nao encontrado.')

  const { directUrl } = loadDatabaseEnv()
  if (directUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL_UNPOOLED deve apontar para PostgreSQL, nao para SQLite.')
  }

  const sqlite = new DatabaseSync(sourcePath, { readOnly: true })
  const client = new Client({ connectionString: directUrl })

  try {
    const sourceTables = loadSourceRows(sqlite)
    await client.connect()
    await assertRemoteIsEmpty(client, sourceTables)
    await importRows(client, sourceTables)
    const counts = await validateCounts(client, sourceTables)
    const totalRows = counts.reduce((sum, entry) => sum + entry.rows, 0)

    process.stdout.write(`${JSON.stringify({ success: true, source: path.basename(sourcePath), totalRows, counts })}\n`)
  } finally {
    sqlite.close()
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Nao foi possivel copiar os dados para PostgreSQL.'}\n`)
  process.exitCode = 1
})
