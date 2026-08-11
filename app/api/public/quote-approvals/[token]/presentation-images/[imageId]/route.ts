import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID } from '@/lib/company-profile'
import { isDateOnlyExpired } from '@/lib/date-only'
import { isValidPublicToken } from '@/lib/public-access'

export async function GET(req: Request, { params }: { params: Promise<{ token: string; imageId: string }> }) {
  const { token, imageId } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Vídeo não encontrado.' }, { status: 404 })

  const [request, image] = await Promise.all([
    prisma.quoteApprovalRequest.findUnique({
      where: { token },
      select: { approvedAt: true, rejectedAt: true, expiresAt: true, invalidatedAt: true },
    }),
    prisma.companyPresentationImage.findFirst({
      where: {
        id: imageId,
        companyId: COMPANY_PROFILE_ID,
        mediaKind: 'VIDEO',
        active: true,
        securityStatus: { in: ['TYPE_CHECKED', 'CLEAN'] },
      },
    }),
  ])

  const unavailable = !request
    || request.invalidatedAt
    || request.rejectedAt
    || (isDateOnlyExpired(request.expiresAt) && !request.approvedAt)
  if (unavailable || !image) return NextResponse.json({ error: 'Vídeo não encontrado.' }, { status: 404 })

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
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Content-Type': image.type,
      'Content-Length': blob.headers.get('content-length') || String(blob.blob.size),
      'Accept-Ranges': blob.headers.get('accept-ranges') || 'bytes',
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      ...(blob.headers.get('etag') ? { ETag: blob.headers.get('etag')! } : {}),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
