import { del, get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID } from '@/lib/company-profile'
import {
  COMPANY_PRESENTATION_POSTER_MAX_SIZE,
  isCompanyPresentationBlobUrl,
  isCompanyPresentationPosterType,
} from '@/lib/company-presentation-images'
import { requireRole, serverError } from '@/lib/security'

export async function GET(req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { imageId } = await params
  const image = await prisma.companyPresentationImage.findFirst({
    where: { id: imageId, companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
  })
  if (!image || !['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus)) {
    return NextResponse.json({ error: 'Vídeo não encontrado.' }, { status: 404 })
  }
  const posterRequested = new URL(req.url).searchParams.get('asset') === 'poster'
  const assetUrl = posterRequested ? image.posterUrl : image.url
  const assetType = posterRequested ? image.posterType : image.type
  if (!assetUrl || !assetType) return NextResponse.json({ error: 'Conteúdo não encontrado.' }, { status: 404 })
  const range = posterRequested ? null : req.headers.get('range')
  const blob = await get(assetUrl, {
    access: 'private',
    useCache: true,
    headers: range ? { Range: range } : undefined,
  })
  if (!blob || ![200, 206].includes(blob.statusCode)) return NextResponse.json({ error: 'Vídeo indisponível.' }, { status: 404 })
  const contentRange = blob.headers.get('content-range')
  return new NextResponse(blob.stream, {
    status: contentRange ? 206 : 200,
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': assetType,
      'Content-Length': blob.headers.get('content-length') || String(blob.blob.size),
      'Accept-Ranges': blob.headers.get('accept-ranges') || 'bytes',
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      ...(blob.headers.get('etag') ? { ETag: blob.headers.get('etag')! } : {}),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { imageId } = await params
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (body?.asset === 'poster') {
    const parsed = z.object({
      asset: z.literal('poster'),
      url: z.string().url().max(1200),
      type: z.string().trim().min(1).max(120),
      size: z.number().int().min(0).max(COMPANY_PRESENTATION_POSTER_MAX_SIZE),
    }).strict().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Capa do vídeo inválida.' }, { status: 400 })
    }
    const poster = parsed.data
    if (!isCompanyPresentationBlobUrl(poster.url) || !isCompanyPresentationPosterType(poster.type)) {
      return NextResponse.json({ error: 'Capa do vídeo inválida.' }, { status: 400 })
    }
    const current = await prisma.companyPresentationImage.findFirst({
      where: { id: imageId, companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
      select: { id: true, posterUrl: true },
    })
    if (!current) return NextResponse.json({ error: 'Vídeo não encontrado.' }, { status: 404 })
    const updated = await prisma.companyPresentationImage.update({
      where: { id: current.id },
      data: { posterUrl: poster.url, posterType: poster.type.toLowerCase(), posterSize: poster.size },
    })
    if (current.posterUrl && current.posterUrl !== poster.url) await del(current.posterUrl).catch(() => undefined)
    return NextResponse.json({ success: true, hasPoster: Boolean(updated.posterUrl) })
  }
  if (body?.direction !== 'up' && body?.direction !== 'down') {
    return NextResponse.json({ error: 'Direção inválida.' }, { status: 400 })
  }

  const image = await prisma.companyPresentationImage.findFirst({
    where: { id: imageId, companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
  })
  if (!image) return NextResponse.json({ error: 'Conteúdo não encontrado.' }, { status: 404 })

  const ordered = await prisma.companyPresentationImage.findMany({
    where: { companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  const currentIndex = ordered.findIndex((item) => item.id === image.id)
  const targetIndex = currentIndex + (body.direction === 'up' ? -1 : 1)
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    return NextResponse.json({ success: true })
  }

  const reordered = [...ordered]
  const [moved] = reordered.splice(currentIndex, 1)
  reordered.splice(targetIndex, 0, moved)

  try {
    await prisma.$transaction(
      reordered.map((item, position) => prisma.companyPresentationImage.update({
        where: { id: item.id },
        data: { position },
      })),
    )
    return NextResponse.json({ success: true, orderedIds: reordered.map((item) => item.id) })
  } catch {
    return serverError()
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { imageId } = await params
  const image = await prisma.companyPresentationImage.findFirst({
    where: { id: imageId, companyId: COMPANY_PROFILE_ID, mediaKind: 'VIDEO' },
  })
  if (!image) return NextResponse.json({ error: 'Vídeo não encontrado.' }, { status: 404 })

  try {
    await prisma.companyPresentationImage.delete({ where: { id: image.id } })
    if (isCompanyPresentationBlobUrl(image.url)) await del(image.url).catch(() => undefined)
    if (image.posterUrl && isCompanyPresentationBlobUrl(image.posterUrl)) await del(image.posterUrl).catch(() => undefined)
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
