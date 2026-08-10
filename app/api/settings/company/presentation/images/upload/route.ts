import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'
import {
  COMPANY_PRESENTATION_IMAGE_PREFIX,
  COMPANY_PRESENTATION_MEDIA_KINDS,
  COMPANY_PRESENTATION_MEDIA_TYPES,
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
} from '@/lib/company-presentation-images'
import { requireRole } from '@/lib/security'

const payloadSchema = z.object({
  environmentName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  caption: z.string().trim().max(240).optional().default(''),
  mediaKind: z.enum(COMPANY_PRESENTATION_MEDIA_KINDS).default('PORTFOLIO'),
  pairKey: z.string().trim().max(120).nullable().optional(),
}).strict()

function parsePayload(value?: string | null) {
  let payload: unknown
  try { payload = JSON.parse(value || '{}') } catch { throw new Error('Dados da imagem inválidos.') }
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Dados da imagem inválidos.')
  return parsed.data
}

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'O armazenamento de imagens não está disponível.' }, { status: 503 })
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
        if (!auth.ok) throw new Error('Apenas administradores podem alterar o portfólio.')
        const payload = parsePayload(clientPayload)
        if (!pathname.startsWith(COMPANY_PRESENTATION_IMAGE_PREFIX)) throw new Error('Destino de imagem inválido.')
        return {
          allowedContentTypes: [...COMPANY_PRESENTATION_MEDIA_TYPES],
          maximumSizeInBytes: COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload)
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
              mediaKind: payload.mediaKind,
              pairKey: payload.pairKey || null,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a imagem.' }, { status: 400 })
  }
}
