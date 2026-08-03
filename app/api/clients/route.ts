import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { clientCreateSchema } from '@/lib/schemas'
import { badRequest, getClientIp, requireAuth, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { clientWhereForUser } from '@/lib/client-access'
import {
  CLIENT_RELATIONSHIP_STAGES,
  clientAttentionLevel,
  clientIdentityData,
  findClientIdentityConflict,
} from '@/lib/client-relationship'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'

type ClientSegment = 'customers' | 'negotiating' | 'inactive' | 'all'

function segmentWhere(segment: ClientSegment): Prisma.ClientWhereInput {
  if (segment === 'customers') {
    return { relationshipStage: CLIENT_RELATIONSHIP_STAGES.CUSTOMER }
  }
  if (segment === 'negotiating') {
    return {
      relationshipStage: {
        in: [
          CLIENT_RELATIONSHIP_STAGES.CONTACT,
          CLIENT_RELATIONSHIP_STAGES.NEGOTIATING,
        ],
      },
    }
  }
  if (segment === 'inactive') {
    return { relationshipStage: CLIENT_RELATIONSHIP_STAGES.INACTIVE }
  }
  return {}
}

function parseSegment(value: string | null): ClientSegment {
  return value === 'negotiating' || value === 'inactive' || value === 'all'
    ? value
    : 'customers'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const optionsOnly = searchParams.get('options') === '1'
  const selectedId = (searchParams.get('selectedId') || '').trim().slice(0, 80)
  const legacyUnpaged = searchParams.get('paged') === '0'
  const paged = !legacyUnpaged
  const segment = parseSegment(searchParams.get('segment'))
  const page = Math.max(Number(searchParams.get('page') || 1), 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 24), 1), 100)
  const searchWhere: Prisma.ClientWhereInput = q
    ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { document: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { whatsapp: { contains: q, mode: 'insensitive' } },
        { street: { contains: q, mode: 'insensitive' } },
        { neighborhood: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { zipCode: { contains: q, mode: 'insensitive' } },
      ],
    }
    : {}

  if (optionsOnly) {
    const optionsWhere = clientWhereForUser(auth.user, searchWhere)
    const matches = await prisma.client.findMany({
      where: optionsWhere,
      orderBy: { name: 'asc' },
      take: 25,
      select: { id: true, name: true, relationshipStage: true },
    })
    const selected = selectedId && !matches.some((client) => client.id === selectedId)
      ? await prisma.client.findFirst({
        where: clientWhereForUser(auth.user, { id: selectedId }),
        select: { id: true, name: true, relationshipStage: true },
      })
      : null
    return NextResponse.json(selected ? [selected, ...matches] : matches, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    })
  }

  const where = clientWhereForUser(auth.user, {
    AND: [searchWhere, segmentWhere(segment)],
  })
  const managerQuoteWhere = {
    archivedAt: null,
    ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
  }

  const [clients, total, stageCounts, profile] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [
        { lastCommercialActivityAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      skip: paged ? (page - 1) * pageSize : undefined,
      take: paged ? pageSize : 100,
      select: {
        id: true,
        name: true,
        document: auth.user.role === 'ADMIN',
        phone: auth.user.role === 'ADMIN',
        whatsapp: auth.user.role === 'ADMIN',
        email: auth.user.role === 'ADMIN',
        address: auth.user.role === 'ADMIN',
        street: auth.user.role === 'ADMIN',
        number: auth.user.role === 'ADMIN',
        neighborhood: auth.user.role === 'ADMIN',
        city: auth.user.role === 'ADMIN',
        state: auth.user.role === 'ADMIN',
        zipCode: auth.user.role === 'ADMIN',
        latitude: auth.user.role === 'ADMIN',
        longitude: auth.user.role === 'ADMIN',
        geocodedAt: auth.user.role === 'ADMIN',
        notes: false,
        relationshipStage: true,
        relationshipStageChangedAt: true,
        lastCommercialActivityAt: true,
        inactivatedAt: true,
        inactiveReason: true,
        createdAt: true,
        updatedAt: true,
        quotes: {
          where: managerQuoteWhere,
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            status: true,
            number: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            projects: {
              where: {
                archivedAt: null,
                ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
              },
            },
            quotes: { where: managerQuoteWhere },
          },
        },
      },
    }),
    paged ? prisma.client.count({ where }) : Promise.resolve(0),
    prisma.client.groupBy({
      by: ['relationshipStage'],
      where: clientWhereForUser(auth.user),
      _count: { _all: true },
    }),
    prisma.companyProfile.findUnique({
      where: { id: COMPANY_PROFILE_ID },
      select: { leadNoResponseDays: true, leadCloseSuggestionDays: true },
    }),
  ])

  const noResponseDays = profile?.leadNoResponseDays ?? DEFAULT_COMPANY_PROFILE.leadNoResponseDays
  const closeSuggestionDays = profile?.leadCloseSuggestionDays ?? DEFAULT_COMPANY_PROFILE.leadCloseSuggestionDays
  const countByStage = Object.fromEntries(
    stageCounts.map((entry) => [entry.relationshipStage, entry._count._all]),
  )
  const customers = countByStage[CLIENT_RELATIONSHIP_STAGES.CUSTOMER] || 0
  const negotiating = (countByStage[CLIENT_RELATIONSHIP_STAGES.CONTACT] || 0)
    + (countByStage[CLIENT_RELATIONSHIP_STAGES.NEGOTIATING] || 0)
  const inactive = countByStage[CLIENT_RELATIONSHIP_STAGES.INACTIVE] || 0
  const all = stageCounts.reduce((sum, entry) => sum + entry._count._all, 0)
  const items = clients.map((client) => ({
    ...client,
    geocodedAt: client.geocodedAt?.toISOString() || null,
    relationshipStageChangedAt: client.relationshipStageChangedAt.toISOString(),
    lastCommercialActivityAt: client.lastCommercialActivityAt?.toISOString() || null,
    inactivatedAt: client.inactivatedAt?.toISOString() || null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    latestQuote: client.quotes[0]
      ? {
        ...client.quotes[0],
        updatedAt: client.quotes[0].updatedAt.toISOString(),
      }
      : null,
    quotes: undefined,
    attention: clientAttentionLevel(
      client.relationshipStage,
      client.lastCommercialActivityAt,
      { noResponseDays, closeSuggestionDays },
    ),
  }))

  if (paged) {
    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      counts: { customers, negotiating, inactive, all },
    })
  }

  return NextResponse.json(items, {
    headers: { 'X-Result-Limit': '100' },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest()
  const rawBody = body as Record<string, unknown>
  const allowPossibleDuplicate = rawBody.allowPossibleDuplicate === true
  const clientBody = { ...rawBody }
  delete clientBody.allowPossibleDuplicate
  const parsed = clientCreateSchema.safeParse(clientBody)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const conflict = await findClientIdentityConflict(prisma, parsed.data)
    if (conflict?.kind === 'DOCUMENT') {
      return NextResponse.json({
        error: 'Já existe um cadastro com este CPF/CNPJ.',
        code: 'DUPLICATE_DOCUMENT',
        existingClient: conflict.client,
      }, { status: 409 })
    }
    if (conflict && !allowPossibleDuplicate) {
      return NextResponse.json({
        error: `Já existe um cadastro com o mesmo telefone, WhatsApp ou e-mail: ${conflict.client.name}.`,
        code: 'POSSIBLE_DUPLICATE',
        existingClient: conflict.client,
      }, { status: 409 })
    }

    const now = new Date()
    const client = await prisma.client.create({
      data: {
        ...parsed.data,
        ...clientIdentityData(parsed.data),
        managerId: auth.user.role === 'MANAGER' ? auth.user.id : null,
        relationshipStage: CLIENT_RELATIONSHIP_STAGES.CONTACT,
        relationshipStageChangedAt: now,
        lastCommercialActivityAt: now,
      },
      select: {
        id: true,
        name: true,
        document: true,
        phone: true,
        whatsapp: true,
        email: true,
        address: true,
        street: true,
        number: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        notes: true,
        relationshipStage: true,
        relationshipStageChangedAt: true,
        lastCommercialActivityAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: 'Novo contato cadastrado',
        details: `${client.name} adicionado ao CRM`,
      },
    })

    return NextResponse.json({
      ...client,
      relationshipStageChangedAt: client.relationshipStageChangedAt.toISOString(),
      lastCommercialActivityAt: client.lastCommercialActivityAt?.toISOString() || null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    })
  } catch {
    return serverError()
  }
}
