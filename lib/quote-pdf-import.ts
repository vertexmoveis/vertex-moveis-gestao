import { parseBRLCurrency } from '@/lib/currency-input'

export const QUOTE_PDF_MAX_BYTES = 4 * 1024 * 1024
export const QUOTE_PDF_MAX_PAGES = 20
export const QUOTE_PDF_MAX_TEXT = 20_000
export const QUOTE_PDF_MAX_FILENAME = 180

export class QuotePdfImportError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) {
    super(message)
    this.name = 'QuotePdfImportError'
  }
}

function folded(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Remove control characters, retaining the document's wording and measurement units. */
export function normalizeQuotePdfText(value: string) {
  return value.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}

export function validateQuotePdfFile(fileName: string, size: number, mimeType: string) {
  const name = fileName.split(/[\\/]/).pop()?.trim() || ''
  if (name.length < 5 || name.length > QUOTE_PDF_MAX_FILENAME || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new QuotePdfImportError('INVALID_FILENAME', 'Use um nome de arquivo PDF com até 180 caracteres.', 400)
  }
  if (!/\.pdf$/i.test(name) || !['', 'application/pdf', 'application/octet-stream'].includes(mimeType.toLowerCase())) {
    throw new QuotePdfImportError('INVALID_TYPE', 'Escolha um arquivo PDF de orçamento.', 400)
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new QuotePdfImportError('EMPTY_FILE', 'O arquivo está vazio. Escolha um PDF de orçamento.', 400)
  }
  if (size > QUOTE_PDF_MAX_BYTES) {
    throw new QuotePdfImportError('FILE_TOO_LARGE', 'O PDF deve ter até 4 MB. Exporte um arquivo menor para importar.', 413)
  }
  return name
}

export function validateQuotePdfHeader(bytes: Uint8Array) {
  if (bytes.length < 8 || new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new QuotePdfImportError('INVALID_PDF', 'O arquivo não parece ser um PDF válido. Exporte o orçamento em PDF novamente.')
  }
}

const TOTAL_LABEL = /^(?:valor\s+total(?:\s+(?:do\s+orcamento|da\s+proposta|do\s+pedido))?|total(?:\s+(?:geral|liquido|final))?(?:\s+(?:do\s+orcamento|da\s+proposta|do\s+pedido|orcamento|a\s+pagar))?|valor\s+(?:do\s+orcamento|da\s+proposta|do\s+pedido))(?=\s|:|=|$)/

function amountFromLine(value: string): number | null {
  const match = value.trim().match(/^(?:R\$\s*)?([0-9][0-9.,]*)(?:\s*(?:BRL|reais))?$/i)
  if (!match) return null
  const amount = parseBRLCurrency(match[1])
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000_000 ? amount : null
}

export function quotePdfSuggestedTotal(lines: string[]): { value: number | null; warning: string | null } {
  const values: number[] = []
  let ambiguous = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    const label = folded(line).match(TOTAL_LABEL)
    if (!label) continue
    const suffix = line.slice(label[0].length).replace(/^\s*[:=]\s*/, '').trim()
    // A table's "Valor total Qtd ..." heading is not a document total.
    if (/\b(?:qtd|quantidade|unitario|unitaria|descricao|unidade)\b/.test(folded(suffix))) continue
    const candidate = suffix || lines[index + 1]?.trim() || ''
    const amount = amountFromLine(candidate)
    if (amount === null) {
      ambiguous = true
      continue
    }
    values.push(Math.round(amount * 100))
  }
  const unique = [...new Set(values)]
  if (ambiguous || unique.length > 1) return {
    value: null,
    warning: 'O PDF apresenta totais diferentes ou um total que não pôde ser confirmado. Informe o valor total correto do contrato.',
  }
  if (unique.length === 1) return { value: unique[0] / 100, warning: null }
  return { value: null, warning: 'Não foi identificado um valor total claro no PDF. Informe o valor total do contrato.' }
}

function isScopeHeading(value: string) {
  const line = folded(value)
  return /^(?:\d+[.)]\s*)?(?:produtos?(?:\s+e\s+servicos?)?|servicos?|itens?(?:\s+do\s+orcamento)?|descricao(?:\s+dos?\s+(?:produtos?|servicos?|itens?))?)(?:\s*:|\s*$|\s+(?:qtd|quantidade|unidade|valor|preco)\b)/.test(line)
    || (/\bdescricao\b/.test(line) && /\b(?:codigo|qtd|quantidade|unitario)\b/.test(line))
    || (/^(?:produto|servico|item|descricao)s?\s*[/|]/.test(line) && /\b(?:medidas|quantidade|qtd|valor)\b/.test(line))
}

function isScopeEnd(value: string) {
  const line = folded(value)
  return /^(?:sub\s*total|total(?:\s+(?:geral|do\s+orcamento|da\s+proposta|do\s+pedido|a\s+pagar|liquido))?|valor\s+total|valor\s+do\s+orcamento|condicoes\s+(?:de\s+)?pagamento|forma\s+(?:de\s+)?pagamento|pagamentos?|dados\s+(?:do\s+cliente|de\s+contato)|contatos?|telefone|e-?mail)(?=\s|:|=|$)/.test(line)
}

function suggestedTitle(description: string) {
  const line = description.split('\n').find(value => /\b(?:cozinha|quarto|sala|banheiro|lavanderia|gourmet|arm[aá]rio|m[oó]veis|roupeiro|dormit[oó]rio|closet)\b/i.test(value))
  if (line) {
    const title = line.replace(/^\d+\s*[.)-]?\s+/, '').split(/\s+R\$\s*/)[0].trim()
    if (title.length >= 3 && title.length <= 160) return title
  }
  return 'Móveis do orçamento importado'
}

/** Conservative suggestions only; the caller must let the user review the draft. */
export function buildQuotePdfSuggestions(rawText: string) {
  if (rawText.length > QUOTE_PDF_MAX_TEXT) {
    throw new QuotePdfImportError('TEXT_TOO_LONG', 'O PDF tem texto demais para um contrato. Separe o orçamento em arquivos menores; nenhuma informação foi importada.')
  }
  const text = normalizeQuotePdfText(rawText)
  if (text.replace(/\s/g, '').length < 20) {
    throw new QuotePdfImportError('NO_TEXT', 'Não foi possível ler texto neste PDF. Ele pode ser uma digitalização ou imagem. Use um PDF com texto selecionável ou preencha os itens manualmente.')
  }
  const lines = text.split('\n')
  const warnings = ['Confira a descrição, as medidas e o valor antes de criar o contrato. As condições de pagamento devem ser preenchidas por você.']
  const startIndex = lines.findIndex(isScopeHeading)
  let description = ''
  let endIndex = -1
  if (startIndex !== -1) {
    const initial = lines[startIndex].includes(':') ? lines[startIndex].slice(lines[startIndex].indexOf(':') + 1).trim() : ''
    const scopeLines = initial ? [initial] : []
    for (let index = startIndex + 1; index < lines.length; index++) {
      const line = lines[index]
      if (isScopeEnd(line)) { endIndex = index; break }
      scopeLines.push(line)
    }
    description = scopeLines.join('\n').trim()
  }
  // A repeated table or measurements after a subtotal may be another page's items.
  // Retain the entire text for review rather than silently discarding that scope.
  if (endIndex !== -1 && lines.slice(endIndex + 1).some(line => isScopeHeading(line) || /\d(?:[.,]\d+)?\s*(?:mm|cm|m)\b/i.test(line))) description = ''
  if (description.length < 5) {
    description = text
    warnings.push('Não foi possível separar os itens do orçamento. Revise o texto importado e mantenha na descrição somente os móveis e serviços contratados.')
  }
  const total = quotePdfSuggestedTotal(lines)
  if (total.warning) warnings.push(total.warning)
  return {
    text,
    suggested: { title: suggestedTitle(description), description, value: total.value },
    warnings,
  }
}
