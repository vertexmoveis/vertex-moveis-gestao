import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clientUpdateSchema } from '@/lib/schemas'
import { badRequest, getClientIp, requireAuth, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { optionalMoneyValue } from '@/lib/money'
import { clientWhereForUser } from '@/lib/client-access'
import {
  clientIdentityData,
  findClientIdentityConflict,
} from '@/lib/client-relationship'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:clients:id:get:${auth.user.id}:${id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const client = await prisma.client.findFirst({
    where: clientWhereForUser(auth.user, { id }),
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
      notes: auth.user.role === 'ADMIN',
      relationshipStage: true,
      relationshipStageChangedAt: true,
      lastCommercialActivityAt: true,
      commercialSource: true,
      nextCommercialAction: true,
      nextCommercialActionAt: true,
      inactivatedAt: true,
      inactiveReason: true,
      createdAt: true,
      updatedAt: true,
      projects: {
        where: {
          archivedAt: null,
          ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
        },
        select: {
          id: true,
          name: true,
          room: true,
          status: true,
          stage: true,
          startDate: true,
          estimatedEndDate: true,
          actualEndDate: true,
          value: auth.user.role === 'ADMIN',
          createdAt: true,
          updatedAt: true,
          manager: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      quotes: {
        where: {
          archivedAt: null,
          ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
        },
        select: {
          id: true,
          number: true,
          title: true,
          variationName: true,
          status: true,
          total: auth.user.role === 'ADMIN',
          validUntil: true,
          sentAt: true,
          approvedAt: true,
          soldAt: true,
          lostAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    relationshipStageChangedAt: client.relationshipStageChangedAt.toISOString(),
    lastCommercialActivityAt: client.lastCommercialActivityAt?.toISOString() || null,
    nextCommercialActionAt: client.nextCommercialActionAt?.toISOString() || null,
    inactivatedAt: client.inactivatedAt?.toISOString() || null,
    projects: client.projects.map((p) => ({
      ...p,
      value: optionalMoneyValue(p.value),
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    quotes: client.quotes.map((quote) => ({
      ...quote,
      total: optionalMoneyValue(quote.total),
      validUntil: quote.validUntil?.toISOString() || null,
      sentAt: quote.sentAt?.toISOString() || null,
      approvedAt: quote.approvedAt?.toISOString() || null,
      soldAt: quote.soldAt?.toISOString() || null,
      lostAt: quote.lostAt?.toISOString() || null,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:clients:id:put:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest()
  const rawBody = body as Record<string, unknown>
  const allowPossibleDuplicate = rawBody.allowPossibleDuplicate === true
  const clientBody = { ...rawBody }
  delete clientBody.allowPossibleDuplicate
  const parsed = clientUpdateSchema.safeParse(clientBody)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const existing = await prisma.client.findFirst({
      where: clientWhereForUser(auth.user, { id }),
      select: {
        id: true,
        documentNormalized: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

    const normalizedIdentity = clientIdentityData(parsed.data)
    const conflict = await findClientIdentityConflict(prisma, {
      ...parsed.data,
      document: normalizedIdentity.documentNormalized === existing.documentNormalized
        ? null
        : parsed.data.document,
    }, id)
    if (conflict?.kind === 'DOCUMENT') {
      return NextResponse.json({
        error: 'Já existe outro cadastro com este CPF/CNPJ.',
        code: 'DUPLICATE_DOCUMENT',
        existingClient: conflict.client,
      }, { status: 409 })
    }
    if (conflict && !allowPossibleDuplicate) {
      return NextResponse.json({
        error: `Já existe outro cadastro com o mesmo telefone, WhatsApp ou e-mail: ${conflict.client.name}.`,
        code: 'POSSIBLE_DUPLICATE',
        existingClient: conflict.client,
      }, { status: 409 })
    }

    const managerSafeData = { ...parsed.data, notes: undefined }
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(auth.user.role === 'ADMIN' ? parsed.data : managerSafeData),
        ...normalizedIdentity,
      },
    })

    return NextResponse.json({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    })
  } catch {
    return serverError()
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PUT(req, context)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:clients:id:delete:${auth.user.id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        name: true,
        archivedAt: true,
        _count: { select: { projects: true, quotes: true } },
      },
    })
    if (!client || client.archivedAt) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }
    if (client._count.projects > 0 || client._count.quotes > 0) {
      return NextResponse.json({
        error: 'Este cadastro possui histórico de orçamento ou projeto e não pode ir para a lixeira. Use “Inativar” para preservá-lo.',
        code: 'CLIENT_HAS_HISTORY',
      }, { status: 409 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: { archivedAt: new Date() } })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          action: 'Contato movido para a lixeira',
          details: client.name,
        },
      })
    })
  } catch {
    return serverError()
  }

  return NextResponse.json({ success: true, archived: true })
}
