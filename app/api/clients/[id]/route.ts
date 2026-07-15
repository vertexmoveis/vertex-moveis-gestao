import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clientUpdateSchema } from '@/lib/schemas'
import { badRequest, forbidden, getClientIp, requireAuth, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

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

  if (auth.user.role !== 'ADMIN') {
    const allowed = await prisma.client.findFirst({
      where: { id, projects: { some: { managerId: auth.user.id } } },
      select: { id: true },
    })
    if (!allowed) return forbidden()
  }

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
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
      createdAt: true,
      updatedAt: true,
      projects: {
        where: auth.user.role === 'ADMIN' ? undefined : { managerId: auth.user.id },
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
    },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    projects: client.projects.map((p) => ({
      ...p,
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
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

  const parsed = clientUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const client = await prisma.client.update({
      where: { id },
      data: parsed.data,
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
    await prisma.client.delete({ where: { id } })
  } catch {
    return serverError()
  }

  return NextResponse.json({ success: true })
}
