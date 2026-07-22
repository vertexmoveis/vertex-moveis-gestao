import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

test('a política de segurança permite o envio direto ao Vercel Blob', () => {
  const config = readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8')
  const connectSource = config.match(/"connect-src ([^"]+)"/)?.[1] || ''

  assert.match(connectSource, /'self'/)
  assert.match(connectSource, /https:\/\/vercel\.com/)
  assert.match(connectSource, /https:\/\/\*\.blob\.vercel-storage\.com/)
})
