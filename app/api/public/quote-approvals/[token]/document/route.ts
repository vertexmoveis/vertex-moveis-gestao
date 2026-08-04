import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import {
  COMPANY_PROFILE_ID,
  serializeCompanyProfile,
} from '@/lib/company-profile'
import { isDateOnlyExpired } from '@/lib/date-only'
import { prisma } from '@/lib/db'
import { parseQuoteApprovalQuotes } from '@/lib/quote-approval'
import {
  renderSimpleQuotePdf,
  simpleQuotePdfFileName,
} from '@/lib/quote-simple-pdf'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { readQuoteImageDataUrl } from '@/lib/quote-images'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }

  const limited = await rateLimit(
    publicRateLimitKey('quote-document', getClientIp(req)),
    30,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) {
    return NextResponse.json(
      { error: 'Tente novamente em alguns instantes.' },
      { status: 429 },
    )
  }

  const [request, storedCompanyProfile] = await Promise.all([
    prisma.quoteApprovalRequest.findUnique({
      where: { token },
      select: {
        snapshot: true,
        approvedAt: true,
        rejectedAt: true,
        expiresAt: true,
        invalidatedAt: true,
      },
    }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
  ])

  if (!request) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }
  if (request.invalidatedAt || request.rejectedAt) {
    return NextResponse.json(
      { error: 'Este orçamento foi substituído por uma versão mais recente.' },
      { status: 409 },
    )
  }
  if (isDateOnlyExpired(request.expiresAt) && !request.approvedAt) {
    return NextResponse.json({ error: 'Este orçamento expirou.' }, { status: 410 })
  }

  const quotes = parseQuoteApprovalQuotes(request.snapshot)
  const requestedQuoteId = req.nextUrl.searchParams.get('quoteId')
  const quote = requestedQuoteId
    ? quotes?.find((option) => option.id === requestedQuoteId)
    : quotes?.[0]

  if (!quote) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }

  const storedImages = await prisma.quoteEnvironmentImage.findMany({
    where: {
      securityStatus: { in: ['TYPE_CHECKED', 'CLEAN'] },
      group: { quotes: { some: { id: quote.id } } },
    },
    orderBy: [{ environmentName: 'asc' }, { position: 'asc' }],
    take: 6,
  })

  const logoUrl = await readFile(path.join(process.cwd(), 'public', 'vertex-symbol.png'))
    .then((file) => `data:image/png;base64,${file.toString('base64')}`)
    .catch(() => undefined)
  const environmentImages = (await Promise.all(storedImages.map(async (image) => {
    const src = await readQuoteImageDataUrl(image.url).catch(() => null)
    return src ? { environmentName: image.environmentName, caption: image.caption, src } : null
  }))).filter((image): image is { environmentName: string; caption: string | null; src: string } => Boolean(image))
  const pdf = await renderSimpleQuotePdf({
    quote,
    company: serializeCompanyProfile(storedCompanyProfile),
    logoUrl,
    environmentImages,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${simpleQuotePdfFileName(quote)}"`,
      'Content-Length': String(pdf.byteLength),
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
