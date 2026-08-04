import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { QUOTE_IMAGE_MAX_SIZE, QUOTE_IMAGE_TYPES } from '@/lib/quote-images'
import { requireAuth } from '@/lib/security'

const payloadSchema = z.object({
  quoteId: z.string().trim().min(1),
  environmentName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  caption: z.string().trim().max(240).optional().default(''),
  groupId: z.string().trim().min(1).optional(),
}).strict()

function parsePayload(value?: string | null) {
  let payload: unknown
  try { payload = JSON.parse(value || '{}') } catch { throw new Error('Dados da imagem inválidos.') }
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Dados da imagem inválidos.')
  return parsed.data
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'O armazenamento de imagens não está disponível.' }, { status: 503 })
  }
  const { id } = await params
  let body: HandleUploadBody
  try { body = await req.json() as HandleUploadBody } catch {
    return NextResponse.json({ error: 'Dados do envio inválidos.' }, { status: 400 })
  }

  try {
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const auth = await requireAuth()
        if (!auth.ok) throw new Error('Faça login para enviar imagens.')
        const payload = parsePayload(clientPayload)
        if (payload.quoteId !== id) throw new Error('Dados da imagem inválidos.')
        const quote = await prisma.quote.findFirst({
          where: { id, archivedAt: null },
          select: { groupId: true, createdById: true },
        })
        if (!quote) throw new Error('Orçamento não encontrado.')
        if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) throw new Error('Você não tem acesso a este orçamento.')
        if (!pathname.startsWith(`quotes/${quote.groupId}/`)) throw new Error('Destino de imagem inválido.')
        return {
          allowedContentTypes: [...QUOTE_IMAGE_TYPES],
          maximumSizeInBytes: QUOTE_IMAGE_MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ ...payload, groupId: quote.groupId }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload)
        const groupId = payload.groupId
        if (!groupId) throw new Error('Grupo do orçamento não encontrado.')
        await prisma.quoteEnvironmentImage.upsert({
          where: { url: blob.url },
          update: {},
          create: {
            groupId,
            environmentName: payload.environmentName,
            name: payload.name,
            caption: payload.caption || null,
            type: blob.contentType || 'application/octet-stream',
            url: blob.url,
            securityStatus: 'PENDING',
          },
        })
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a imagem.' }, { status: 400 })
  }
}
