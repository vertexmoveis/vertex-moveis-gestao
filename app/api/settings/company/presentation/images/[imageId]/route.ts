import { del, get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID } from '@/lib/company-profile'
import { isCompanyPresentationImageBlobUrl } from '@/lib/company-presentation-images'
import { requireRole, serverError } from '@/lib/security'

export async function GET(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { imageId } = await params
  const image = await prisma.companyPresentationImage.findFirst({
    where: { id: imageId, companyId: COMPANY_PROFILE_ID },
  })
  if (!image || !['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus)) {
    return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })
  }
  const blob = await get(image.url, { access: 'private', useCache: true })
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: 'Imagem indisponível.' }, { status: 404 })
  return new NextResponse(blob.stream, {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': image.type,
      'Content-Length': String(blob.blob.size),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { imageId } = await params
  const image = await prisma.companyPresentationImage.findFirst({
    where: { id: imageId, companyId: COMPANY_PROFILE_ID },
  })
  if (!image) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })

  try {
    await prisma.companyPresentationImage.delete({ where: { id: image.id } })
    if (isCompanyPresentationImageBlobUrl(image.url)) await del(image.url).catch(() => undefined)
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
