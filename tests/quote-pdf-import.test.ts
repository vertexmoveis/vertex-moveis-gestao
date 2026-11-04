import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQuotePdfSuggestions, QUOTE_PDF_MAX_BYTES, QuotePdfImportError,
  quotePdfSuggestedTotal, validateQuotePdfFile, validateQuotePdfHeader,
} from '@/lib/quote-pdf-import'
import { positionedPdfText } from '@/lib/pdf-text-extraction'

test('importa medidas literais e total brasileiro sem adivinhar unidades nem pagamentos', () => {
  const result = buildQuotePdfSuggestions('Gestão Clique\nCliente: Exemplo\nProdutos e serviços\nCozinha planejada\nArmário 1200 mm x 800 mm; bancada 1,20 m.\nMDF 18 mm, duas portas.\nTotal do Orçamento: R$ 50.000,00\nForma de pagamento: cartão em 10x')
  assert.equal(result.suggested.value, 50_000)
  assert.equal(result.suggested.title, 'Cozinha planejada')
  assert.equal(result.suggested.description, 'Cozinha planejada\nArmário 1200 mm x 800 mm; bancada 1,20 m.\nMDF 18 mm, duas portas.')
  assert.match(result.text, /cartão em 10x/)
  assert.doesNotMatch(result.suggested.description, /Cliente:|cartão/)
})

test('total explícito vale mais que preços de itens ou parcelas e não calcula totais por soma', () => {
  assert.equal(buildQuotePdfSuggestions('Itens\nCozinha R$ 50.000,00\nDesconto R$ 20.000,00\nTotal geral\nR$ 30.000,00\n10 parcelas de R$ 3.000,00').suggested.value, 30_000)
  assert.equal(buildQuotePdfSuggestions('Cozinha planejada por R$ 50.000,00\nArmários medindo 2000 mm\nEntrada de R$ 10.000,00').suggested.value, null)
  assert.equal(quotePdfSuggestedTotal(['Subtotal: R$ 60.000,00', 'Valor total: R$ 38.000,00']).value, 38_000)
})

test('totais conflitantes ou inválidos ficam vazios e pedem revisão', () => {
  for (const lines of [
    ['Total: R$ 50.000,00', 'Total geral: R$ 38.000,00'],
    ['Total do orçamento: R$ 50.000,00', 'Valor total: consultar'],
    ['Valor total: 38.000,000'],
    ['Total: 10.000.001,00'],
  ]) {
    const result = quotePdfSuggestedTotal(lines)
    assert.equal(result.value, null)
    assert.ok(result.warning)
  }
  assert.equal(quotePdfSuggestedTotal(['Total geral: R$ 50.000,00', 'Valor total do orçamento: R$ 50.000,00']).value, 50_000)
})

test('descrição não é cortada silenciosamente e PDF sem texto pede alternativa manual', () => {
  const raw = 'Armário com medidas 2000 x 800 mm e acabamento branco.\nTexto literal sem tabela.'
  const result = buildQuotePdfSuggestions(raw)
  assert.equal(result.suggested.description, raw)
  assert.ok(result.warnings.some(warning => /separar os itens/.test(warning)))
  assert.throws(() => buildQuotePdfSuggestions('X'.repeat(20_001)), error => error instanceof QuotePdfImportError && error.code === 'TEXT_TOO_LONG')
  assert.throws(() => buildQuotePdfSuggestions(''), error => error instanceof QuotePdfImportError && /manualmente/.test(error.message))
})

test('valida tipo, tamanho, nome e assinatura PDF antes de interpretar', () => {
  assert.equal(validateQuotePdfFile('cozinha.pdf', QUOTE_PDF_MAX_BYTES, 'application/pdf'), 'cozinha.pdf')
  for (const input of [
    ['cozinha.pdf', QUOTE_PDF_MAX_BYTES + 1, 'application/pdf'],
    ['cozinha.pdf', 0, 'application/pdf'],
    ['.pdf', 50, 'application/pdf'],
    ['cozinha.txt', 50, 'text/plain'],
    ['cozinha.pdf', 50, 'text/html'],
    ['x'.repeat(180) + '.pdf', 50, 'application/pdf'],
  ] as const) assert.throws(() => validateQuotePdfFile(input[0], input[1], input[2]), QuotePdfImportError)
  assert.doesNotThrow(() => validateQuotePdfHeader(new TextEncoder().encode('%PDF-1.7\nexemplo')))
  assert.throws(() => validateQuotePdfHeader(new TextEncoder().encode('<html>Não é PDF</html>')), QuotePdfImportError)
})

test('leitura de colunas conserva medidas e espaços de tabela', () => {
  const text = positionedPdfText([
    { str: '1200 mm', x: 140, y: 100, width: 45, height: 10 },
    { str: 'Cozinha', x: 10, y: 100, width: 45, height: 10 },
    { str: 'Total:', x: 10, y: 80, width: 30, height: 10 },
    { str: 'R$ 50.000,00', x: 140, y: 80, width: 80, height: 10 },
  ])
  assert.equal(text, 'Cozinha 1200 mm\nTotal: R$ 50.000,00')
})
