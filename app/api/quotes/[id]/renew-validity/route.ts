import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const VALIDITY_DAYS = 7

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:renew-validity:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  try {
    const quote = await prisma.quote.findFirst({
      where: { id, archivedAt: null },
      select: { groupId: true, createdById: true, convertedProjectId: true, status: true },
    })
    if (!quote) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })
    if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) return forbidden()
    if (quote.convertedProjectId || quote.status === 'SOLD') {
      return NextResponse.json({ error: 'Este orçamento já foi transformado em projeto.' }, { status: 409 })
    }

    const todayKey = dateOnlyKeyInTimeZone(new Date())
    const [year, month, day] = todayKey.split('-').map(Number)
    const validUntil = toDateOnlyUtc(new Date(Date.UTC(year, month - 1, day + VALIDITY_DAYS, 12)))!

    const updated = await prisma.$transaction(async (tx) => {
      const groupQuotes = await tx.quote.findMany({
        where: { groupId: quote.groupId, archivedAt: null },
        select: { id: true, convertedProjectId: true, status: true },
      })
      if (groupQuotes.some((item) => item.convertedProjectId || item.status === 'SOLD')) {
        throw new Error('GROUP_LOCKED')
      }

      const quoteIds = groupQuotes.map((item) => item.id)
      await tx.quote.updateMany({ where: { id: { in: quoteIds } }, data: { validUntil } })
      await tx.quoteApprovalRequest.updateMany({
        where: {
          invalidatedAt: null,
          OR: [
            { quoteId: { in: quoteIds } },
            { comparisonQuoteId: { in: quoteIds } },
            { options: { some: { quoteId: { in: quoteIds } } } },
          ],
        },
        data: { invalidatedAt: new Date() },
      })
      return quoteIds.length
    })

    return NextResponse.json({ success: true, validUntil: validUntil.toISOString(), updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'GROUP_LOCKED') {
      return NextResponse.json({ error: 'Uma das opções já foi vendida e não pode ser renovada.' }, { status: 409 })
    }
    console.error('Falha ao renovar a validade do orçamento:', error)
    return serverError()
  }
}
