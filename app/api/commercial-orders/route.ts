import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, getClientIp, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { commercialOrdersQuery } from '@/lib/commercial-orders'
import type { CommercialResult } from '@/lib/commercial-order-types'
import { dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`commercial-orders:${auth.user.id}:${getClientIp(req)}`, 120, 60_000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Aguarde um minuto.' }, { status: 429 })
  const params = req.nextUrl.searchParams
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.get('page') || '1') || 1))
  try {
    const rows = await prisma.$queryRaw<{ result: CommercialResult }[]>(commercialOrdersQuery({
      userId: auth.user.id, isAdmin: auth.user.role === 'ADMIN', page, pageSize: 20,
      query: (params.get('q') || '').trim().slice(0,120), clientId: params.get('clientId') || '',
      ownerId: params.get('ownerId') || '', status: params.get('status') || '',
      view: params.get('view') || 'active', attention: params.get('attention') || '',
      archived: params.get('archived') === '1', today: toDateOnlyUtc(dateOnlyKeyInTimeZone(new Date()))!,
    }))
    return NextResponse.json({ ...rows[0].result, page, pageSize: 20, canWrite: ['ADMIN','MANAGER'].includes(auth.user.role) })
  } catch { return serverError() }
}
