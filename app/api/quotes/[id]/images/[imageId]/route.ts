import { del, get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateQuoteGroupApprovals } from '@/lib/quote-image-records'
import { isQuoteImageBlobUrl } from '@/lib/quote-images'
import { forbidden, requireAuth, serverError } from '@/lib/security'

async function findImage(quoteId: string, imageId: string, user: { id: string; role: string }) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, archivedAt: null }, select: { groupId: true, createdById: true } })
  if (!quote) return { status: 404 as const, quote: null, image: null }
  if (user.role !== 'ADMIN' && quote.createdById !== user.id) return { status: 403 as const, quote: null, image: null }
  const image = await prisma.quoteEnvironmentImage.findFirst({ where: { id: imageId, groupId: quote.groupId } })
  return { status: image ? 200 as const : 404 as const, quote, image }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id, imageId } = await params
  const result = await findImage(id, imageId, auth.user)
  if (result.status === 403) return forbidden()
  if (!result.quote || !result.image || !['TYPE_CHECKED', 'CLEAN'].includes(result.image.securityStatus)) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })
  const blob = await get(result.image.url, { access: 'private', useCache: true })
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: 'Imagem indisponível.' }, { status: 404 })
  return new NextResponse(blob.stream, { headers: { 'Cache-Control': 'private, max-age=300', 'Content-Type': result.image.type, 'X-Content-Type-Options': 'nosniff' } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id, imageId } = await params
  const result = await findImage(id, imageId, auth.user)
  if (result.status === 403) return forbidden()
  if (!result.quote || !result.image) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })
  try {
    await prisma.$transaction(async (tx) => {
      await tx.quoteEnvironmentImage.delete({ where: { id: imageId } })
      await invalidateQuoteGroupApprovals(tx, result.quote!.groupId)
    })
    if (isQuoteImageBlobUrl(result.image.url, result.quote.groupId)) await del(result.image.url).catch(() => undefined)
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
