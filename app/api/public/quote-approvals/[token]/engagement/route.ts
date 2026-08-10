import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getClientIp, serviceUnavailable } from '@/lib/security'
import { isValidPublicToken } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const engagementSchema = z.object({ event: z.literal('PDF_OPENED') }).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })
  const body = await req.json().catch(() => null)
  if (!engagementSchema.safeParse(body).success) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })

  const limited = await rateLimit(`public:quote-engagement:${token}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return new NextResponse(null, { status: 204 })

  const result = await prisma.quoteApprovalRequest.updateMany({
    where: { token, invalidatedAt: null, rejectedAt: null },
    data: { pdfViewedAt: new Date(), pdfViewCount: { increment: 1 } },
  })
  if (!result.count) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
