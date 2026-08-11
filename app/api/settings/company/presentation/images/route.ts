import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'
import { serializeCompanyPresentationImage } from '@/lib/company-presentation'
import {
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  isCompanyPresentationBlobUrl,
  isCompanyPresentationVideoType,
} from '@/lib/company-presentation-images'
import { inspectCompanyPresentationMedia } from '@/lib/company-presentation-media-security'
import { badRequest, requireRole, serverError } from '@/lib/security'

const videoSchema = z.object({
  environmentName: z.string().trim().min(1, 'Informe o ambiente.').max(120),
  name: z.string().trim().min(1, 'Informe o nome do vídeo.').max(180),
  caption: z.string().trim().max(240).optional().default(''),
  type: z.string().trim().min(1).max(120),
  url: z.string().url().max(1200),
  size: z.number().int().min(0).max(COMPANY_PRESENTATION_VIDEO_MAX_SIZE).nullable().optional(),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = videoSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados do vídeo inválidos.')
  if (!isCompanyPresentationVideoType(parsed.data.type)) return badRequest('Escolha um vídeo MP4 ou WebM.')
  if (!isCompanyPresentationBlobUrl(parsed.data.url)) return badRequest('O arquivo não pertence à apresentação da empresa.')

  try {
    const inspection = await inspectCompanyPresentationMedia({
      url: parsed.data.url,
      expectedType: parsed.data.type,
      name: parsed.data.name,
    })
    if (inspection.status === 'REJECTED') {
      await del(parsed.data.url).catch(() => undefined)
      await prisma.companyPresentationImage.deleteMany({ where: { url: parsed.data.url } })
      return NextResponse.json({ error: inspection.details || 'O vídeo foi rejeitado pela verificação de segurança.' }, { status: 422 })
    }

    const video = await prisma.$transaction(async (tx) => {
      await tx.companyProfile.upsert({
        where: { id: COMPANY_PROFILE_ID },
        update: {},
        create: DEFAULT_COMPANY_PROFILE,
      })
      const currentCount = await tx.companyPresentationImage.count({
        where: { companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
      })
      const pendingVideo = await tx.companyPresentationImage.findUnique({
        where: { url: parsed.data.url },
        select: { id: true },
      })
      const data = {
        environmentName: parsed.data.environmentName,
        name: parsed.data.name,
        caption: parsed.data.caption || null,
        mediaKind: 'VIDEO',
        pairKey: null,
        type: parsed.data.type.toLowerCase(),
        url: parsed.data.url,
        size: inspection.size ?? parsed.data.size ?? null,
        securityStatus: inspection.status,
        securityDetails: inspection.details,
        securityCheckedAt: new Date(),
        position: Math.max(0, currentCount - (pendingVideo ? 1 : 0)),
      }
      if (pendingVideo) {
        return tx.companyPresentationImage.update({ where: { id: pendingVideo.id }, data })
      }
      return tx.companyPresentationImage.create({
        data: { ...data, companyId: COMPANY_PROFILE_ID },
      })
    })

    if (inspection.status === 'ERROR') {
      return NextResponse.json({
        ...serializeCompanyPresentationImage(video),
        error: 'O vídeo foi salvo, mas precisa ser verificado novamente.',
      }, { status: 503 })
    }
    return NextResponse.json(serializeCompanyPresentationImage(video), { status: 201 })
  } catch {
    return serverError()
  }
}
