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
  assert.match(proxy.match(/`style-src ([^`]+)`/)?.[1] || '', /'nonce-\$\{nonce\}'/)
  assert.doesNotMatch(proxy.match(/`style-src ([^`]+)`/)?.[1] || '', /'unsafe-inline'/)
  assert.match(proxy, /style-src-attr 'unsafe-inline'/)
  assert.match(proxy, /worker-src 'self' blob:/)
})

test('a prévia HEIC usa a variante compatível com CSP dentro de um worker', () => {
  const viewer = readFileSync(
    path.join(process.cwd(), 'components/projects/project-file-viewer.tsx'),
    'utf8',
  )

  assert.match(viewer, /import\(['"]heic-to\/csp['"]\)/)
  assert.doesNotMatch(viewer, /heic-to\/next/)
})

test('documentos HTML usam nonce em scripts e estilos', () => {
  const files = [
    'app/api/quotes/[id]/proposal/route.ts',
    'app/api/projects/[id]/payments/[paymentId]/receipt/route.ts',
    'app/api/public/quote-approvals/[token]/certificate/route.ts',
  ]

  for (const file of files) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8')
    assert.doesNotMatch(source, /\bonclick=/)
    assert.match(source, /<script nonce=/)
    assert.match(source, /<style nonce=/)
    assert.doesNotMatch(source, /<style>/)
  }
})

test('cabecalhos removem tecnologia, restringem CORS e evitam cache zero no manifest', () => {
  const nextConfig = readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8')

  assert.match(nextConfig, /poweredByHeader:\s*false/)
  assert.match(nextConfig, /Access-Control-Allow-Origin/)
  assert.match(nextConfig, /Cross-Origin-Resource-Policy.*same-origin/)
  assert.doesNotMatch(nextConfig, /Access-Control-Allow-Origin'[^]*?value:\s*['"]\*['"]/)
  assert.match(nextConfig, /public, max-age=3600, stale-while-revalidate=86400/)
})

test('arquivos autenticados podem abrir no visualizador do próprio sistema', () => {
  const nextConfig = readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8')
  const proxy = readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')
  const globalRule = nextConfig.indexOf("source: '/(.*)'")
  const fileRule = nextConfig.indexOf("source: '/api/projects/:id/files/:fileId'")

  assert.ok(globalRule >= 0)
  assert.ok(fileRule > globalRule)
  assert.match(nextConfig.slice(fileRule), /X-Frame-Options'\s*,\s*value:\s*'SAMEORIGIN'/)
  assert.match(proxy, /api\\\/projects\\\/\[\^\/\]\+\\\/files\\\/\[\^\/\]\+/)
})
