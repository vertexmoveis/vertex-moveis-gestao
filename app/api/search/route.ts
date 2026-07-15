import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { formatClientAddress } from '@/lib/address'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { QUOTE_STATUS_LABELS, safeQuoteStatus } from '@/lib/quotes'
import { PROJECT_STATUS_LABELS, PRODUCTION_STAGE_LABELS, type ProjectStatus, type ProductionStage } from '@/types'

type SearchResult = {
  id: string
  type: 'client' | 'project' | 'quote'
  title: string
  subtitle: string
  href: string
}

function buildWhere(access: Record<string, unknown> | null, search: Record<string, unknown>) {
  const filters = [access, search].filter(Boolean)
  return filters.length > 1 ? { AND: filters } : filters[0] || search
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:search:${auth.user.id}:${getClientIp(req)}`, 90, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const isAdmin = auth.user.role === 'ADMIN'
  const projectAccess = isAdmin ? null : { managerId: auth.user.id }
  const quoteAccess = isAdmin ? null : { createdById: auth.user.id }
  const clientAccess = isAdmin
    ? null
    : {
        OR: [
          { projects: { some: { managerId: auth.user.id } } },
          { quotes: { some: { createdById: auth.user.id } } },
        ],
      }

  const [clients, projects, quotes] = await Promise.all([
    prisma.client.findMany({
      where: buildWhere(clientAccess, {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { whatsapp: { contains: q } },
          { address: { contains: q } },
          { street: { contains: q } },
          { neighborhood: { contains: q } },
          { city: { contains: q } },
          { zipCode: { contains: q } },
        ],
      }),
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsapp: true,
        address: true,
        street: true,
        number: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
      },
    }),
    prisma.project.findMany({
      where: buildWhere(projectAccess, {
        OR: [
          { name: { contains: q } },
          { room: { contains: q } },
          { client: { name: { contains: q } } },
        ],
      }),
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        room: true,
        status: true,
        stage: true,
        client: { select: { name: true } },
      },
    }),
    prisma.quote.findMany({
      where: buildWhere(quoteAccess, {
        OR: [
          { title: { contains: q } },
          { client: { name: { contains: q } } },
        ],
      }),
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
  ])

  const results: SearchResult[] = [
    ...clients.map((client) => ({
      id: client.id,
      type: 'client' as const,
      title: client.name,
      subtitle: formatClientAddress(client) || client.whatsapp || client.phone || 'Cliente cadastrado',
      href: `/dashboard/clients/${client.id}`,
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: 'project' as const,
      title: project.name,
      subtitle: `${project.client.name} | ${PROJECT_STATUS_LABELS[project.status as ProjectStatus] || project.status} | ${PRODUCTION_STAGE_LABELS[project.stage as ProductionStage] || project.stage}`,
      href: `/dashboard/projects/${project.id}`,
    })),
    ...quotes.map((quote) => {
      const status = safeQuoteStatus(quote.status)
      return {
        id: quote.id,
        type: 'quote' as const,
        title: quote.title,
        subtitle: `${quote.client.name} | ${QUOTE_STATUS_LABELS[status]}`,
        href: `/dashboard/quotes/${quote.id}`,
      }
    }),
  ]

  return NextResponse.json({ results })
}
