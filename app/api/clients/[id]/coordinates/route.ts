import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { badRequest, forbidden, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

function validCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:clients:coords:${auth.user.id}:${id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  const lat = typeof body === 'object' && body !== null && 'lat' in body ? Number(body.lat) : Number.NaN
  const lon = typeof body === 'object' && body !== null && 'lon' in body ? Number(body.lon) : Number.NaN
  if (!validCoordinate(lat, lon)) return badRequest()

  if (auth.user.role !== 'ADMIN') {
    const hasAccess = await prisma.project.count({
      where: { clientId: id, managerId: auth.user.id },
    })
    if (hasAccess === 0) return forbidden()
  }

  const client = await prisma.client.update({
    where: { id },
    data: { latitude: lat, longitude: lon, geocodedAt: new Date() },
    select: { id: true, latitude: true, longitude: true, geocodedAt: true },
  })

  return NextResponse.json({
    ...client,
    geocodedAt: client.geocodedAt?.toISOString() || null,
  })
}
