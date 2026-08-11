import { del, get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID } from '@/lib/company-profile'
import { isCompanyPresentationBlobUrl } from '@/lib/company-presentation-images'
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
  const range = req.headers.get('range')
  const blob = await get(image.url, {
    access: 'private',
    useCache: true,
    headers: range ? { Range: range } : undefined,
  })
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: 'Vídeo indisponível.' }, { status: 404 })
  const contentRange = blob.headers.get('content-range')
  return new NextResponse(blob.stream, {
    status: contentRange ? 206 : 200,
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': image.type,
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
  const body = await req.json().catch(() => null) as { direction?: unknown } | null
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
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
