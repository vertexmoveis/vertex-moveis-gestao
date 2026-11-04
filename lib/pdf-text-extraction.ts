import {
  QUOTE_PDF_MAX_PAGES, QUOTE_PDF_MAX_TEXT, QuotePdfImportError,
  validateQuotePdfHeader,
} from '@/lib/quote-pdf-import'

type PositionedText = { str: string; x: number; y: number; width: number; height: number }

/** Read rows left to right; do not reinterpret measurements, codes or prices. */
export function positionedPdfText(items: PositionedText[]) {
  const rows: Array<{ y: number; height: number; items: PositionedText[] }> = []
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!item.str) continue
    const row = rows.find(candidate => Math.abs(candidate.y - item.y) <= Math.max(1, Math.min(candidate.height, item.height || 8) * 0.25))
    if (row) row.items.push(item)
    else rows.push({ y: item.y, height: item.height || 8, items: [item] })
  }
  return rows.map(row => row.items.sort((a, b) => a.x - b.x).map((item, index, sorted) => {
    const previous = sorted[index - 1]
    const gap = previous ? item.x - (previous.x + previous.width) : 0
    const separator = previous && gap > Math.max(0.5, (item.height || 8) * 0.08) && !/\s$/.test(previous.str) && !/^\s/.test(item.str) ? ' ' : ''
    return separator + item.str
  }).join('')).join('\n')
}

export async function extractQuotePdfText(bytes: Uint8Array) {
  validateQuotePdfHeader(bytes)
  let pdf: Awaited<ReturnType<typeof import('unpdf')['getDocumentProxy']>> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let expired = false
  const extraction = async () => {
    const { getDocumentProxy } = await import('unpdf')
    pdf = await getDocumentProxy(bytes, {
      useSystemFonts: false, disableFontFace: true,
      maxImageSize: 4_000_000, stopAtErrors: true, verbosity: 0,
    })
    if (expired) {
      await pdf.loadingTask.destroy()
      throw new QuotePdfImportError('READ_TIMEOUT', 'A leitura deste PDF demorou demais. Exporte uma versão menor com texto selecionável ou preencha os itens manualmente.')
    }
    if (pdf.numPages > QUOTE_PDF_MAX_PAGES) {
      throw new QuotePdfImportError('TOO_MANY_PAGES', 'O PDF deve ter até 20 páginas. Separe o orçamento em arquivos menores para importar.')
    }
    const pages: string[] = []
    let textLength = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      if (content.items.length > 20_000) throw new QuotePdfImportError('TEXT_TOO_LONG', 'Este PDF é muito complexo. Separe o orçamento em arquivos menores para importar.')
      const items = content.items.flatMap(item => 'str' in item ? [{
        str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height,
      }] : [])
      const text = positionedPdfText(items)
      page.cleanup()
      textLength += text.length + (pages.length ? 2 : 0)
      if (textLength > QUOTE_PDF_MAX_TEXT) {
        throw new QuotePdfImportError('TEXT_TOO_LONG', 'O PDF tem texto demais para um contrato. Separe o orçamento em arquivos menores; nenhuma informação foi importada.')
      }
      pages.push(text)
    }
    return { pageCount: pdf.numPages, text: pages.join('\n\n') }
  }
  try {
    return await Promise.race([
      extraction(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => {
        expired = true
        void pdf?.loadingTask.destroy().catch(() => undefined)
        reject(new QuotePdfImportError('READ_TIMEOUT', 'A leitura deste PDF demorou demais. Exporte uma versão menor com texto selecionável ou preencha os itens manualmente.'))
      }, 15_000) }),
    ])
  } catch (error) {
    if (error instanceof QuotePdfImportError) throw error
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new QuotePdfImportError('PROTECTED_PDF', 'Este PDF está protegido por senha. Exporte uma cópia sem senha ou preencha os itens manualmente.')
    }
    throw new QuotePdfImportError('UNREADABLE_PDF', 'Não foi possível ler este PDF. Exporte o orçamento novamente com texto selecionável ou preencha os itens manualmente.')
  } finally {
    if (timeout) clearTimeout(timeout)
    if (pdf) await pdf.loadingTask.destroy().catch(() => undefined)
  }
}
