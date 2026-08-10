import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getClientIp, serviceUnavailable } from '@/lib/security'
import { isValidPublicToken } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { PUBLIC_QUOTE_VIEW_INTERVAL_MS } from '@/lib/public-quote-engagement'

const engagementSchema = z.object({
  event: z.enum(['PAGE_VIEWED', 'PDF_OPENED']),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })
  const body = await req.json().catch(() => null)
  const parsed = engagementSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })

  const isPageView = parsed.data.event === 'PAGE_VIEWED'
  const limited = await rateLimit(
    `public:quote-engagement:${parsed.data.event}:${token}:${getClientIp(req)}`,
    isPageView ? 1 : 10,
    isPageView ? PUBLIC_QUOTE_VIEW_INTERVAL_MS : 60 * 60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return new NextResponse(null, { status: 204 })

  const approvalRequest = await prisma.quoteApprovalRequest.findFirst({
    where: { token, invalidatedAt: null, rejectedAt: null },
    select: {
      id: true,
      quoteId: true,
      comparisonQuoteId: true,
      options: { select: { quoteId: true } },
    },
  })
  if (!approvalRequest) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })

  const viewedAt = new Date()
  if (isPageView) {
    const quoteIds = approvalRequest.options.length
      ? approvalRequest.options.map((option) => option.quoteId)
      : [approvalRequest.quoteId, approvalRequest.comparisonQuoteId]
          .filter((quoteId): quoteId is string => Boolean(quoteId))
    await prisma.$transaction([
      prisma.quoteApprovalRequest.update({
        where: { id: approvalRequest.id },
        data: { viewedAt, viewCount: { increment: 1 } },
      }),
      prisma.quote.updateMany({
        where: { id: { in: quoteIds } },
        data: { viewedAt, viewCount: { increment: 1 } },
      }),
    ])
  } else {
    await prisma.quoteApprovalRequest.update({
      where: { id: approvalRequest.id },
      data: { pdfViewedAt: viewedAt, pdfViewCount: { increment: 1 } },
    })
  }
  return new NextResponse(null, { status: 204 })
}
