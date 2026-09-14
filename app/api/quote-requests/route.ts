import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole, badRequest, forbidden, serverError, getClientIp, serviceUnavailable } from '@/lib/security'
import { quoteRequestSchema, requestProgressSchema, requestScope, REQUEST_STATUSES } from '@/lib/quote-requests'
import { clientWhereForUser } from '@/lib/client-access'
import { toDateOnlyUtc, dateOnlyKeyInTimeZone } from '@/lib/date-only'
import { rateLimit } from '@/lib/rate-limit'

async function limit(req: NextRequest, userId: string) {
  const result = await rateLimit(`requests:${userId}:${getClientIp(req)}`, 90, 60_000).catch(() => null)
  if (!result) return serviceUnavailable()
  if (!result.allowed) return NextResponse.json({ error: 'Aguarde um minuto e tente novamente.' }, { status: 429 })
  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const limited = await limit(req, auth.user.id)
  if (limited) return limited
  const query = req.nextUrl.searchParams
  const status = query.get('status')
  const page = Math.max(1, Number.parseInt(query.get('page') || '1') || 1)
  const search = (query.get('q') || '').trim().slice(0, 120)
  const where: Prisma.QuoteRequestWhereInput = {
    AND: [requestScope(auth.user), {
      ...(query.get('clientId') ? { clientId: query.get('clientId')! } : {}),
      ...(query.get('id') ? { id: query.get('id')! } : {}),
      ...(status && REQUEST_STATUSES.includes(status as never) ? { status } : {}),
      ...(query.get('overdue') === '1' ? { dueDate: { lt: toDateOnlyUtc(dateOnlyKeyInTimeZone(new Date()))! }, status: { notIn: ['READY', 'CANCELLED'] } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { client: { name: { contains: search, mode: 'insensitive' } } }] } : {}),
    }],
  }
  try {
    const [items, total, users, clients] = await Promise.all([
      prisma.quoteRequest.findMany({ where, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
        include: { client: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } },
          quoteGroup: { select: { quotes: { where: { archivedAt: null, ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }) }, orderBy: { variationOrder: 'asc' }, take: 1, select: { id: true } } } } },
      }),
      prisma.quoteRequest.count({ where }),
      prisma.user.findMany({ where: { active: true, role: { in: ['ADMIN', 'MANAGER'] }, ...(auth.user.role === 'ADMIN' ? {} : { id: auth.user.id }) }, select: { id: true, name: true } }),
      prisma.client.findMany({ where: clientWhereForUser(auth.user), orderBy: { name: 'asc' }, take: 500, select: { id: true, name: true } }),
    ])
    return NextResponse.json({ items, total, page, users, clients, canWrite: auth.user.role !== 'VIEWER' && ['ADMIN', 'MANAGER'].includes(auth.user.role) })
  } catch { return serverError() }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await limit(req, auth.user.id)
  if (limited) return limited
  const parsed = quoteRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message)
  const input = parsed.data
  if (auth.user.role !== 'ADMIN' && input.assignedToId !== auth.user.id) return forbidden()
  try {
    if (input.externalOpportunityId && await prisma.quoteRequest.findUnique({ where: { externalOpportunityId: input.externalOpportunityId }, select: { id: true } })) {
      return NextResponse.json({ error: 'Esta oportunidade já possui uma solicitação. Localize o registro existente.' }, { status: 409 })
    }
    const [client, owner] = await Promise.all([
      prisma.client.findFirst({ where: clientWhereForUser(auth.user, { id: input.clientId }), select: { id: true } }),
      prisma.user.findFirst({ where: { id: input.assignedToId, active: true, role: { in: ['ADMIN', 'MANAGER'] } }, select: { id: true } }),
    ])
    if (!client || !owner) return badRequest('Confira o cliente e o responsável selecionados.')
    const item = await prisma.quoteRequest.create({ data: { ...input, createdById: auth.user.id,
      dueDate: toDateOnlyUtc(input.dueDate)!, desiredDeliveryDate: input.desiredDeliveryDate ? toDateOnlyUtc(input.desiredDeliveryDate) : null,
    } })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Esta oportunidade já possui uma solicitação. Localize o registro existente.' }, { status: 409 })
    return serverError()
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await limit(req, auth.user.id)
  if (limited) return limited
  const id = req.nextUrl.searchParams.get('id') || ''
  const parsed = requestProgressSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message)
  try {
    const item = await prisma.quoteRequest.findFirst({ where: { id, ...requestScope(auth.user) }, include: { quoteGroup: { select: { id: true } } } })
    if (!item) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    if (parsed.data.status === 'READY' && !item.quoteGroup) return badRequest('Crie o orçamento antes de marcar a proposta como pronta.')
    const { updatedAt, dueDate, ...progress } = parsed.data
    const result = await prisma.quoteRequest.updateMany({ where: { id, updatedAt: new Date(updatedAt) }, data: {
      ...progress, ...(dueDate ? { dueDate: toDateOnlyUtc(dueDate)! } : {}),
      receivedAt: item.receivedAt || new Date(),
    } })
    if (!result.count) return NextResponse.json({ error: 'A solicitação mudou. Atualize a lista antes de salvar.' }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch { return serverError() }
}
