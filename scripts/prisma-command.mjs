import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { loadDatabaseEnv } from './database-env.mjs'

const command = process.argv[2]
const projectRoot = path.resolve(import.meta.dirname, '..')
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js')

const argumentsByCommand = {
  generate: ['generate', '--schema', 'prisma/schema.prisma'],
  migrate: ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
  resolve: ['migrate', 'resolve', ...process.argv.slice(3), '--schema', 'prisma/schema.prisma'],
}

if (!argumentsByCommand[command]) {
  throw new Error('Use "generate", "migrate" ou "resolve" para executar o Prisma.')
}

loadDatabaseEnv()

const result = spawnSync(process.execPath, [prismaCli, ...argumentsByCommand[command]], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error
if (result.status !== 0) process.exitCode = result.status || 1
