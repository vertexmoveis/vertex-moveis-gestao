import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { formatClientAddress } from '@/lib/address'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:map:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const clients = await prisma.client.findMany({
    where: {
      archivedAt: null,
      ...(auth.user.role === 'ADMIN'
        ? {}
        : { projects: { some: { managerId: auth.user.id, archivedAt: null } } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      name: true,
      address: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      _count: { select: { projects: { where: { archivedAt: null } } } },
    },
  })

  return NextResponse.json({
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      address: formatClientAddress(client),
      latitude: client.latitude,
      longitude: client.longitude,
      projectsCount: client._count.projects,
    })),
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
