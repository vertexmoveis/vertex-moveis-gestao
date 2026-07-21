import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

test('backup cobre todas as tabelas persistentes do sistema', () => {
  const root = process.cwd()
  const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8')
  const script = readFileSync(path.join(root, 'scripts', 'backup-database.mjs'), 'utf8')
  const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1])
  const tableBlock = script.match(/const tableOrder = \[([\s\S]*?)\n\]/)?.[1] || ''
  const backedUp = [...tableBlock.matchAll(/'([^']+)'/g)].map((match) => match[1])
  const intentionallyEphemeral = new Set(['RateLimitBucket'])
  const missing = models.filter((model) => !intentionallyEphemeral.has(model) && !backedUp.includes(model))

  assert.deepEqual(missing, [])
})
