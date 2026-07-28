import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

test('a política de segurança permite o envio direto ao Vercel Blob', () => {
  const proxy = readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')
  const connectSource = proxy.match(/`connect-src ([^`]+)`/)?.[1] || ''

  assert.match(connectSource, /'self'/)
  assert.match(connectSource, /https:\/\/vercel\.com/)
  assert.match(connectSource, /https:\/\/\*\.blob\.vercel-storage\.com/)
  assert.match(proxy, /'nonce-\$\{nonce\}'/)
  assert.match(proxy, /'strict-dynamic'/)
  assert.doesNotMatch(proxy.match(/`script-src ([^`]+)`/)?.[1] || '', /'unsafe-inline'/)
})

test('documentos HTML usam scripts com nonce em vez de handlers inline', () => {
  const files = [
    'app/api/quotes/[id]/proposal/route.ts',
    'app/api/projects/[id]/payments/[paymentId]/receipt/route.ts',
    'app/api/public/quote-approvals/[token]/certificate/route.ts',
    'lib/quote-simple-proposal.ts',
  ]

  for (const file of files) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8')
    assert.doesNotMatch(source, /\bonclick=/)
    assert.match(source, /<script nonce=/)
  }
})
