import { backup, DatabaseSync } from 'node:sqlite'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const sourcePath = path.resolve(process.env.BACKUP_SOURCE || path.join(projectRoot, 'prisma', 'dev.db'))
const backupDir = path.resolve(process.env.BACKUP_DIRECTORY || path.join(projectRoot, 'backups'))
const secondaryDirectory = process.env.BACKUP_SECONDARY_DIR?.trim()
  || (process.env.OneDrive ? path.join(process.env.OneDrive, 'VertexMoveisBackups') : '')
const retentionDays = Math.max(Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10) || 30, 1)
const backupPattern = /^vertex-dev-\d{14}(?:-\d{3}|\.-\d{3})\.db$/

function timestamp() {
  const now = new Date()
  const date = now.toISOString().slice(0, 19).replace(/[-:T]/g, '')
  return `${date}-${String(now.getMilliseconds()).padStart(3, '0')}`
}

function resolveSecondaryDirectory() {
  return secondaryDirectory ? path.resolve(secondaryDirectory) : null
}

async function ensureSourceExists() {
  const sourceStat = await stat(sourcePath)
  if (!sourceStat.isFile()) {
    throw new Error(`Banco local não encontrado em ${sourcePath}`)
  }
}

function verifyDatabase(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get()
    if (integrity?.integrity_check !== 'ok') {
      throw new Error(`A verificação do banco falhou: ${integrity?.integrity_check || 'resultado desconhecido'}`)
    }

    const schema = database.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type IN ('table', 'index')").get()
    if (!schema?.total) {
      throw new Error('O backup não possui a estrutura esperada do banco.')
    }

    return Number(schema.total)
  } finally {
    database.close()
  }
}

async function testRestore(backupPath) {
  const restorePath = `${backupPath}.restore-test`
  try {
    await copyFile(backupPath, restorePath)
    return verifyDatabase(restorePath)
  } finally {
    await rm(restorePath, { force: true })
  }
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

async function createBackup() {
  await ensureSourceExists()
  await mkdir(backupDir, { recursive: true })

  const fileName = `vertex-dev-${timestamp()}.db`
  const targetPath = path.join(backupDir, fileName)
  const sourceDatabase = new DatabaseSync(sourcePath, { readOnly: true })

  try {
    await backup(sourceDatabase, targetPath)
  } finally {
    sourceDatabase.close()
  }

  const schemaEntries = verifyDatabase(targetPath)
  const restoreSchemaEntries = await testRestore(targetPath)
  const removedLocal = await cleanOldBackups(backupDir)
  const secondaryDir = resolveSecondaryDirectory()
  let secondaryPath = null
  let removedSecondary = []

  if (secondaryDir) {
    await mkdir(secondaryDir, { recursive: true })
    secondaryPath = path.join(secondaryDir, fileName)
    await copyFile(targetPath, secondaryPath)
    verifyDatabase(secondaryPath)
    removedSecondary = await cleanOldBackups(secondaryDir)
  }

  return {
    success: true,
    fileName,
    path: targetPath,
    secondaryPath,
    retentionDays,
    verified: true,
    restoreTested: true,
    schemaEntries,
    restoreSchemaEntries,
    removed: removedLocal.length + removedSecondary.length,
  }
}

createBackup()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`)
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Não foi possível criar o backup.'}\n`)
    process.exitCode = 1
  })
