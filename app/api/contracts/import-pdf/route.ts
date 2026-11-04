import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole, getClientIp, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { extractQuotePdfText } from '@/lib/pdf-text-extraction'
import {
  buildQuotePdfSuggestions, QUOTE_PDF_MAX_BYTES, QuotePdfImportError, validateQuotePdfFile,
} from '@/lib/quote-pdf-import'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`contract:pdf-import:${auth.user.id}:${getClientIp(req)}`, 6, 60_000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas importações. Aguarde um minuto antes de tentar novamente.' }, { status: 429 })
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    return NextResponse.json({ error: 'Escolha um cliente e envie um arquivo PDF de orçamento.' }, { status: 400 })
  }
  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > QUOTE_PDF_MAX_BYTES + 65_536) {
    return NextResponse.json({ error: 'O PDF deve ter até 4 MB. Exporte um arquivo menor para importar.' }, { status: 413 })
  }
  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'Não foi possível receber o PDF. Escolha o arquivo novamente.' }, { status: 400 })
  }
  const clientId = form.get('clientId')
  const file = form.get('file')
  if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 200 || !(file instanceof File) || form.getAll('file').length !== 1 || form.getAll('clientId').length !== 1) {
    return NextResponse.json({ error: 'Escolha um cliente cadastrado e um único PDF de orçamento.' }, { status: 400 })
  }
  try {
    const client = await prisma.client.findFirst({ where: {
      id: clientId.trim(), archivedAt: null, ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
    }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Escolha um cliente ativo ao qual você tenha acesso.' }, { status: 404 })
    const fileName = validateQuotePdfFile(file.name, file.size, file.type)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const extracted = await extractQuotePdfText(bytes)
    const imported = buildQuotePdfSuggestions(extracted.text)
    return NextResponse.json({
      sourceDocument: { type: 'PDF_QUOTE', fileName, sha256, pageCount: extracted.pageCount, text: imported.text },
      suggested: imported.suggested,
      warnings: imported.warnings,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof QuotePdfImportError) return NextResponse.json({ error: error.message }, { status: error.status })
    return serverError()
  }
}
