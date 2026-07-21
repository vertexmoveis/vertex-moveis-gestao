import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { clientCreateSchema } from '@/lib/schemas'
import { badRequest, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const optionsOnly = searchParams.get('options') === '1'
  const selectedId = (searchParams.get('selectedId') || '').trim().slice(0, 80)
  const paged = searchParams.get('paged') === '1'
  const page = Math.max(Number(searchParams.get('page') || 1), 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 24), 1), 100)

  const where: Prisma.ClientWhereInput | undefined = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { document: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { street: { contains: q, mode: 'insensitive' } },
          { neighborhood: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { zipCode: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined

  if (optionsOnly) {
    const matches = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 25,
      select: { id: true, name: true },
    })
    const selected = selectedId && !matches.some((client) => client.id === selectedId)
      ? await prisma.client.findUnique({ where: { id: selectedId }, select: { id: true, name: true } })
      : null
    return NextResponse.json(selected ? [selected, ...matches] : matches, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    })
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
    where: q
      ? where
      : undefined,
    orderBy: { createdAt: 'desc' },
    skip: paged ? (page - 1) * pageSize : undefined,
    take: paged ? pageSize : undefined,
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
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true } },
    },
    }),
    paged ? prisma.client.count({ where }) : Promise.resolve(0),
  ])

  const items = clients.map((c) => ({
      ...c,
      geocodedAt: 'geocodedAt' in c && c.geocodedAt ? c.geocodedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))

  if (paged) {
    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    })
  }

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:clients:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = clientCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const client = await prisma.client.create({
      data: parsed.data,
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
        createdAt: true,
        updatedAt: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: 'Novo cliente cadastrado',
        details: `${client.name} adicionado ao sistema`,
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
