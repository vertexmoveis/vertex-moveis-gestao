import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'
import { serializeCompanyPresentationImage } from '@/lib/company-presentation'
import {
  COMPANY_PRESENTATION_MEDIA_KINDS,
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  isCompanyPresentationImageBlobUrl,
  isCompanyPresentationImageType,
  isCompanyPresentationMediaType,
  isCompanyPresentationVideoType,
} from '@/lib/company-presentation-images'
import { inspectCompanyPresentationMedia } from '@/lib/company-presentation-media-security'
import { badRequest, requireRole, serverError } from '@/lib/security'

const imageSchema = z.object({
  environmentName: z.string().trim().min(1, 'Informe o ambiente.').max(120),
  name: z.string().trim().min(1, 'Informe o nome da imagem.').max(180),
  caption: z.string().trim().max(240).optional().default(''),
  mediaKind: z.enum(COMPANY_PRESENTATION_MEDIA_KINDS).default('PORTFOLIO'),
  pairKey: z.string().trim().max(120).nullable().optional(),
  type: z.string().trim().min(1).max(120),
  url: z.string().url().max(1200),
  size: z.number().int().min(0).max(COMPANY_PRESENTATION_VIDEO_MAX_SIZE).nullable().optional(),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = imageSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados da imagem inválidos.')
  if (!isCompanyPresentationMediaType(parsed.data.type)) return badRequest('Envie uma imagem JPG, PNG ou WebP, ou um vídeo MP4 ou WebM.')
  if (!isCompanyPresentationImageBlobUrl(parsed.data.url)) return badRequest('O arquivo não pertence à apresentação da empresa.')
  if (parsed.data.mediaKind === 'VIDEO' && !isCompanyPresentationVideoType(parsed.data.type)) return badRequest('Escolha um vídeo MP4 ou WebM.')
  if (parsed.data.mediaKind !== 'VIDEO' && !isCompanyPresentationImageType(parsed.data.type)) return badRequest('Escolha uma imagem JPG, PNG ou WebP.')
  if (['BEFORE', 'AFTER'].includes(parsed.data.mediaKind) && !parsed.data.pairKey?.trim()) return badRequest('Informe o nome da obra para montar o antes e depois.')

  try {
    const inspection = await inspectCompanyPresentationMedia({
      url: parsed.data.url,
      expectedType: parsed.data.type,
      name: parsed.data.name,
    })
    if (inspection.status === 'REJECTED') {
      await del(parsed.data.url).catch(() => undefined)
      await prisma.companyPresentationImage.deleteMany({ where: { url: parsed.data.url } })
      return NextResponse.json({ error: inspection.details || 'A imagem foi rejeitada pela verificação de segurança.' }, { status: 422 })
    }

    const image = await prisma.$transaction(async (tx) => {
      await tx.companyProfile.upsert({
        where: { id: COMPANY_PROFILE_ID },
        update: {},
        create: DEFAULT_COMPANY_PROFILE,
      })
      const currentCount = await tx.companyPresentationImage.count({ where: { companyId: COMPANY_PROFILE_ID } })
      return tx.companyPresentationImage.upsert({
        where: { url: parsed.data.url },
        update: {
          environmentName: parsed.data.environmentName,
          name: parsed.data.name,
          caption: parsed.data.caption || null,
          mediaKind: parsed.data.mediaKind,
          pairKey: parsed.data.pairKey || null,
          type: parsed.data.type,
          size: inspection.size ?? parsed.data.size ?? null,
          securityStatus: inspection.status,
          securityDetails: inspection.details,
          securityCheckedAt: new Date(),
          position: Math.max(0, currentCount - 1),
        },
        create: {
          companyId: COMPANY_PROFILE_ID,
          environmentName: parsed.data.environmentName,
          name: parsed.data.name,
          caption: parsed.data.caption || null,
          mediaKind: parsed.data.mediaKind,
          pairKey: parsed.data.pairKey || null,
          type: parsed.data.type,
          url: parsed.data.url,
          size: inspection.size ?? parsed.data.size ?? null,
          securityStatus: inspection.status,
          securityDetails: inspection.details,
          securityCheckedAt: new Date(),
          position: currentCount,
        },
      })
    })

    if (inspection.status === 'ERROR') {
      return NextResponse.json({ ...serializeCompanyPresentationImage(image), error: 'A imagem foi salva, mas precisa ser verificada novamente.' }, { status: 503 })
    }
    return NextResponse.json(serializeCompanyPresentationImage(image), { status: 201 })
  } catch {
    return serverError()
  }
}
