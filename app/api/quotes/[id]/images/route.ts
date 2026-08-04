import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { inspectProjectBlob } from '@/lib/project-file-security'
import { invalidateQuoteGroupApprovals, serializeQuoteImage } from '@/lib/quote-image-records'
import { isQuoteImageBlobUrl, isQuoteImageType, QUOTE_IMAGE_MAX_SIZE } from '@/lib/quote-images'
import { badRequest, forbidden, requireAuth, serverError } from '@/lib/security'

const imageSchema = z.object({
  environmentName: z.string().trim().min(1, 'Informe o ambiente.').max(120),
  name: z.string().trim().min(1, 'Informe o nome da imagem.').max(180),
  caption: z.string().trim().max(240).optional().default(''),
  type: z.string().trim().min(1).max(120),
  url: z.string().url().max(1200),
  size: z.number().int().min(0).max(QUOTE_IMAGE_MAX_SIZE).nullable().optional(),
}).strict()

async function quoteAccess(id: string, user: { id: string; role: string }) {
  const quote = await prisma.quote.findFirst({ where: { id, archivedAt: null }, select: { groupId: true, createdById: true } })
  if (!quote) return { status: 404 as const, quote: null }
  if (user.role !== 'ADMIN' && quote.createdById !== user.id) return { status: 403 as const, quote: null }
  return { status: 200 as const, quote }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const access = await quoteAccess(id, auth.user)
  if (!access.quote) return access.status === 403 ? forbidden() : NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return badRequest('Dados da imagem inválidos.') }
  const parsed = imageSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados da imagem inválidos.')
  if (!isQuoteImageType(parsed.data.type)) return badRequest('Envie uma imagem JPG, PNG ou WebP.')
  if (!isQuoteImageBlobUrl(parsed.data.url, access.quote.groupId)) return badRequest('A imagem não pertence a este orçamento.')

  try {
    const inspection = await inspectProjectBlob({ url: parsed.data.url, expectedType: parsed.data.type, name: parsed.data.name })
    if (inspection.status === 'REJECTED') {
      await del(parsed.data.url).catch(() => undefined)
      await prisma.quoteEnvironmentImage.deleteMany({ where: { url: parsed.data.url } })
      return NextResponse.json({ error: inspection.details || 'A imagem foi rejeitada pela verificação de segurança.' }, { status: 422 })
    }
    const image = await prisma.$transaction(async (tx) => {
      const saved = await tx.quoteEnvironmentImage.upsert({
        where: { url: parsed.data.url },
        update: {
          environmentName: parsed.data.environmentName,
          name: parsed.data.name,
          caption: parsed.data.caption || null,
          type: parsed.data.type,
          size: inspection.size ?? parsed.data.size ?? null,
          securityStatus: inspection.status,
          securityDetails: inspection.details,
          securityCheckedAt: new Date(),
        },
        create: {
          groupId: access.quote.groupId,
          environmentName: parsed.data.environmentName,
          name: parsed.data.name,
          caption: parsed.data.caption || null,
          type: parsed.data.type,
          url: parsed.data.url,
          size: inspection.size ?? parsed.data.size ?? null,
          securityStatus: inspection.status,
          securityDetails: inspection.details,
          securityCheckedAt: new Date(),
        },
      })
      await invalidateQuoteGroupApprovals(tx, access.quote.groupId)
      return saved
    })
    if (inspection.status === 'ERROR') return NextResponse.json({ ...serializeQuoteImage(image), error: 'A imagem foi salva, mas precisa ser verificada novamente.' }, { status: 503 })
    return NextResponse.json(serializeQuoteImage(image), { status: 201 })
  } catch {
    return serverError()
  }
}
