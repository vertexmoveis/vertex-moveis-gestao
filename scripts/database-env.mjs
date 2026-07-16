import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

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
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      values[key] = value
      return values
    }, {})
}

export function loadDatabaseEnv() {
  const localValues = {
    ...parseEnvFile(path.join(projectRoot, '.env')),
    ...parseEnvFile(path.join(projectRoot, '.env.local')),
  }
  const runningOnVercel =
    process.env.VERCEL === '1' &&
    /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '')

  for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
    if (!runningOnVercel && localValues[key]) {
      process.env[key] = localValues[key]
    } else if (!process.env[key] && localValues[key]) {
      process.env[key] = localValues[key]
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao foi configurada para a conexao com o banco.')
  }

  if (!process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL
  }

  return {
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DATABASE_URL_UNPOOLED,
  }
}
