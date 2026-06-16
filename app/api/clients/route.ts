import { NextRequest, NextResponse } from 'next/server'
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

  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: auth.user.role === 'ADMIN',
      whatsapp: auth.user.role === 'ADMIN',
      email: auth.user.role === 'ADMIN',
      address: auth.user.role === 'ADMIN',
      notes: false,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true } },
    },
  })

  return NextResponse.json(
    clients.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  )
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
        phone: true,
        whatsapp: true,
        email: true,
        address: true,
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
