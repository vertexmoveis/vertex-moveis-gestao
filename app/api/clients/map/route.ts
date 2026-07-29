import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { formatClientAddress } from '@/lib/address'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { clientWhereForUser } from '@/lib/client-access'
import { CLIENT_RELATIONSHIP_STAGES } from '@/lib/client-relationship'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:map:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const query = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  const requestedScope = req.nextUrl.searchParams.get('scope')
  const scope = requestedScope === 'negotiating' || requestedScope === 'all'
    ? requestedScope
    : 'customers'
  const requestedLimit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '200', 10)
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 50), 500)
  const relationshipWhere: Prisma.ClientWhereInput = scope === 'customers'
    ? { relationshipStage: CLIENT_RELATIONSHIP_STAGES.CUSTOMER }
    : scope === 'negotiating'
      ? {
        relationshipStage: {
          in: [
            CLIENT_RELATIONSHIP_STAGES.CONTACT,
            CLIENT_RELATIONSHIP_STAGES.NEGOTIATING,
          ],
        },
      }
      : {}
  const where = clientWhereForUser(auth.user, {
    ...relationshipWhere,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { street: { contains: query, mode: 'insensitive' } },
            { neighborhood: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { zipCode: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  })

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
    where,
    orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    take: limit,
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
      relationshipStage: true,
      _count: {
        select: {
          projects: {
            where: {
              archivedAt: null,
              ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
            },
          },
        },
      },
    },
    }),
    prisma.client.count({ where }),
  ])

  return NextResponse.json({
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      address: formatClientAddress(client),
      latitude: client.latitude,
      longitude: client.longitude,
      relationshipStage: client.relationshipStage,
      projectsCount: client._count.projects,
    })),
    meta: {
      scope,
      query,
      total,
      returned: clients.length,
      limit,
      truncated: total > clients.length,
    },
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
