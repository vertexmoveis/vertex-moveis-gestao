import assert from 'node:assert/strict'
import test from 'node:test'
import { clientAccessScope } from '@/lib/client-access'
import { csvCell, neutralizeSpreadsheetFormula } from '@/lib/csv'
import {
  isValidPublicToken,
  maskPersonalDocument,
  publicClientLocation,
  publicRateLimitKey,
} from '@/lib/public-access'
import { canDownloadProjectFile } from '@/lib/project-file-security'

test('escopo de cliente limita o gerente aos vinculos de responsabilidade', () => {
  assert.deepEqual(clientAccessScope({ id: 'admin-1', role: 'ADMIN' }), {})
  assert.deepEqual(clientAccessScope({ id: 'manager-1', role: 'MANAGER' }), {
    OR: [
      { managerId: 'manager-1' },
      { projects: { some: { managerId: 'manager-1', archivedAt: null } } },
      { quotes: { some: { createdById: 'manager-1', archivedAt: null } } },
    ],
  })
})

test('tokens publicos aceitam somente o formato criptografico esperado', () => {
  assert.equal(isValidPublicToken('a'.repeat(32)), true)
  assert.equal(isValidPublicToken('A1_-'.repeat(10)), true)
  assert.equal(isValidPublicToken('curto'), false)
  assert.equal(isValidPublicToken(`${'a'.repeat(31)}!`), false)
  assert.equal(isValidPublicToken('a'.repeat(65)), false)
})

test('limite publico usa apenas rota e IP estaveis', () => {
  assert.equal(
    publicRateLimitKey('quote-approval:respond', '203.0.113.10'),
    'api:public:quote-approval:respond:ip:203.0.113.10',
  )
})

test('comprovante publico mascara documento e endereco completo', () => {
  assert.equal(maskPersonalDocument('123.456.789-10'), 'Documento protegido (final 8910)')
  assert.equal(maskPersonalDocument(null), 'Não informado')
  assert.equal(publicClientLocation({ city: 'Cotia', state: 'SP' }), 'Cotia/SP')
  assert.equal(
    publicClientLocation({ city: null, state: null }),
    'Endereço completo protegido no CRM',
  )
})

test('CSV neutraliza formulas antes de abrir no Excel', () => {
  assert.equal(neutralizeSpreadsheetFormula('=HYPERLINK("https://example.test")'), '\'=HYPERLINK("https://example.test")')
  assert.equal(neutralizeSpreadsheetFormula('  +1+1'), '\'  +1+1')
  assert.equal(neutralizeSpreadsheetFormula('Cliente comum'), 'Cliente comum')
  assert.equal(csvCell('@SUM(1,1)'), '"\'@SUM(1,1)"')
})

test('PDF exige antivirus e imagens podem usar conferencia de assinatura', () => {
  assert.equal(canDownloadProjectFile('application/pdf', 'TYPE_CHECKED'), false)
  assert.equal(canDownloadProjectFile('application/pdf', 'CLEAN'), true)
  assert.equal(canDownloadProjectFile('image/png', 'TYPE_CHECKED'), true)
  assert.equal(canDownloadProjectFile('image/png', 'PENDING'), false)
})
