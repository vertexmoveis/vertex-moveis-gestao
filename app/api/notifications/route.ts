import { NextRequest, NextResponse } from 'next/server'
import { getAppAlerts } from '@/lib/alerts'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:notifications:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const alerts = await getAppAlerts(auth.user)
  return NextResponse.json(alerts)
}
