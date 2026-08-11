import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'
import {
  COMPANY_PRESENTATION_MEDIA_PREFIX,
  COMPANY_PRESENTATION_POSTER_MAX_SIZE,
  COMPANY_PRESENTATION_POSTER_PREFIX,
  COMPANY_PRESENTATION_POSTER_TYPES,
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  COMPANY_PRESENTATION_VIDEO_TYPES_LIST,
} from '@/lib/company-presentation-images'
import { requireRole } from '@/lib/security'

const payloadSchema = z.object({
  assetKind: z.enum(['VIDEO', 'POSTER']).optional().default('VIDEO'),
  environmentName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  caption: z.string().trim().max(240).optional().default(''),
}).strict()

function parsePayload(value?: string | null) {
  let payload: unknown
  try { payload = JSON.parse(value || '{}') } catch { throw new Error('Dados do vídeo inválidos.') }
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Dados do vídeo inválidos.')
  return parsed.data
}

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'O armazenamento de vídeos não está disponível.' }, { status: 503 })
  }

  let body: HandleUploadBody
  try { body = await req.json() as HandleUploadBody } catch {
    return NextResponse.json({ error: 'Dados do envio inválidos.' }, { status: 400 })
  }

  try {
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const auth = await requireRole(['ADMIN'])
        if (!auth.ok) throw new Error('Apenas administradores podem alterar os vídeos da apresentação.')
        const payload = parsePayload(clientPayload)
        if (!pathname.startsWith(COMPANY_PRESENTATION_MEDIA_PREFIX)) throw new Error('Destino de vídeo inválido.')
        if (payload.assetKind === 'POSTER') {
          if (!pathname.startsWith(COMPANY_PRESENTATION_POSTER_PREFIX)) throw new Error('Destino da capa inválido.')
          return {
            allowedContentTypes: [...COMPANY_PRESENTATION_POSTER_TYPES],
            maximumSizeInBytes: COMPANY_PRESENTATION_POSTER_MAX_SIZE,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify(payload),
          }
        }
        return {
          allowedContentTypes: COMPANY_PRESENTATION_VIDEO_TYPES_LIST,
          maximumSizeInBytes: COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload)
        if (payload.assetKind === 'POSTER') return
        await prisma.$transaction(async (tx) => {
          await tx.companyProfile.upsert({
            where: { id: COMPANY_PROFILE_ID },
            update: {},
            create: DEFAULT_COMPANY_PROFILE,
          })
          await tx.companyPresentationImage.upsert({
            where: { url: blob.url },
            update: {},
            create: {
              companyId: COMPANY_PROFILE_ID,
              environmentName: payload.environmentName,
              name: payload.name,
              caption: payload.caption || null,
              mediaKind: 'VIDEO',
              pairKey: null,
              type: blob.contentType || 'application/octet-stream',
              url: blob.url,
              securityStatus: 'PENDING',
            },
          })
        })
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o vídeo.' }, { status: 400 })
  }
}
