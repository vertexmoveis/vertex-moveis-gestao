import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID } from '@/lib/company-profile'
import { isDateOnlyExpired } from '@/lib/date-only'
import { isValidPublicToken } from '@/lib/public-access'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; imageId: string }> }) {
  const { token, imageId } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })

  const [request, image] = await Promise.all([
    prisma.quoteApprovalRequest.findUnique({
      where: { token },
      select: { approvedAt: true, rejectedAt: true, expiresAt: true, invalidatedAt: true },
    }),
    prisma.companyPresentationImage.findFirst({
      where: {
        id: imageId,
        companyId: COMPANY_PROFILE_ID,
        active: true,
        securityStatus: { in: ['TYPE_CHECKED', 'CLEAN'] },
      },
    }),
  ])

  const unavailable = !request
    || request.invalidatedAt
    || request.rejectedAt
    || (isDateOnlyExpired(request.expiresAt) && !request.approvedAt)
  if (unavailable || !image) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 })

  const blob = await get(image.url, { access: 'private', useCache: true })
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: 'Imagem indisponível.' }, { status: 404 })
  return new NextResponse(blob.stream, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Content-Type': image.type,
      'Content-Length': String(blob.blob.size),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
