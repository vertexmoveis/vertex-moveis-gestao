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
  isCompanyPresentationHeicType,
  isCompanyPresentationImageType,
  isCompanyPresentationMediaType,
  isCompanyPresentationVideoType,
} from '@/lib/company-presentation-images'
import { convertPresentationHeicToJpeg } from '@/lib/company-presentation-heic'
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
  if (!isCompanyPresentationMediaType(parsed.data.type)) return badRequest('Envie uma imagem JPG, PNG, WebP, HEIC ou HEIF, ou um vídeo MP4 ou WebM.')
  if (!isCompanyPresentationImageBlobUrl(parsed.data.url)) return badRequest('O arquivo não pertence à apresentação da empresa.')
  if (parsed.data.mediaKind === 'VIDEO' && !isCompanyPresentationVideoType(parsed.data.type)) return badRequest('Escolha um vídeo MP4 ou WebM.')
  if (parsed.data.mediaKind !== 'VIDEO' && !isCompanyPresentationImageType(parsed.data.type)) return badRequest('Escolha uma imagem JPG, PNG, WebP, HEIC ou HEIF.')
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

    let finalMedia = {
      name: parsed.data.name,
      type: parsed.data.type.toLowerCase(),
      url: parsed.data.url,
      size: inspection.size ?? parsed.data.size ?? null,
      securityDetails: inspection.details,
    }
    let convertedUrl: string | null = null

    if (inspection.status === 'TYPE_CHECKED' && isCompanyPresentationHeicType(parsed.data.type)) {
      try {
        const converted = await convertPresentationHeicToJpeg({
          url: parsed.data.url,
          name: parsed.data.name,
        })
        convertedUrl = converted.url
        finalMedia = {
          ...converted,
          securityDetails: 'Foto HEIC verificada e convertida automaticamente para JPEG.',
        }
      } catch (error) {
        await del(parsed.data.url).catch(() => undefined)
        await prisma.companyPresentationImage.deleteMany({ where: { url: parsed.data.url } })
        return NextResponse.json({
          error: error instanceof Error
            ? error.message
            : 'Não foi possível converter a foto HEIC. Tente enviar novamente.',
        }, { status: 422 })
      }
    }

    const image = await prisma.$transaction(async (tx) => {
      await tx.companyProfile.upsert({
        where: { id: COMPANY_PROFILE_ID },
        update: {},
        create: DEFAULT_COMPANY_PROFILE,
      })
      const currentCount = await tx.companyPresentationImage.count({ where: { companyId: COMPANY_PROFILE_ID } })
      const pendingImage = await tx.companyPresentationImage.findUnique({
        where: { url: parsed.data.url },
        select: { id: true },
      })
      const data = {
          environmentName: parsed.data.environmentName,
          name: finalMedia.name,
          caption: parsed.data.caption || null,
          mediaKind: parsed.data.mediaKind,
          pairKey: parsed.data.pairKey || null,
          type: finalMedia.type,
          url: finalMedia.url,
          size: finalMedia.size,
          securityStatus: inspection.status,
          securityDetails: finalMedia.securityDetails,
          securityCheckedAt: new Date(),
          position: Math.max(0, currentCount - 1),
      }
      if (pendingImage) {
        return tx.companyPresentationImage.update({
          where: { id: pendingImage.id },
          data,
        })
      }
      return tx.companyPresentationImage.create({
        data: {
          ...data,
          companyId: COMPANY_PROFILE_ID,
          position: currentCount,
        },
      })
    }).catch(async (error) => {
      if (convertedUrl) await del(convertedUrl).catch(() => undefined)
      throw error
    })

    if (convertedUrl) await del(parsed.data.url).catch(() => undefined)

    if (inspection.status === 'ERROR') {
      return NextResponse.json({ ...serializeCompanyPresentationImage(image), error: 'A imagem foi salva, mas precisa ser verificada novamente.' }, { status: 503 })
    }
    return NextResponse.json(serializeCompanyPresentationImage(image), { status: 201 })
  } catch {
    return serverError()
  }
}
