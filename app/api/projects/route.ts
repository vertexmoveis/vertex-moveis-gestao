import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { projectCreateSchema } from '@/lib/schemas'
import { badRequest, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:projects:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const status = (searchParams.get('status') || '').trim()
  const stage = (searchParams.get('stage') || '').trim()

  const where: Record<string, unknown> = auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { client: { name: { contains: q } } },
    ]
  }
  if (status) where.status = status
  if (stage) where.stage = stage

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
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
      internalNotes: false,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true, phone: auth.user.role === 'ADMIN', whatsapp: auth.user.role === 'ADMIN' } },
      manager: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    projects.map((p) => ({
      ...p,
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:projects:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = projectCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const input = parsed.data
    const project = await prisma.project.create({
      data: {
        clientId: input.clientId,
        name: input.name,
        room: input.room,
        status: input.status,
        stage: input.stage,
        startDate: input.startDate,
        estimatedEndDate: input.estimatedEndDate,
        value: auth.user.role === 'ADMIN' ? input.value : null,
        managerId: auth.user.role === 'ADMIN' ? input.managerId : auth.user.id,
        internalNotes: auth.user.role === 'ADMIN' ? input.internalNotes : null,
      },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true } },
        manager: { select: { id: true, name: true } },
      },
    })

    await prisma.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Projeto Criado',
        description: `Projeto "${project.name}" criado no sistema`,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: project.id,
        action: 'Projeto criado',
        details: `Novo projeto: ${project.name}`,
      },
    })

    return NextResponse.json({
      ...project,
      startDate: project.startDate?.toISOString() || null,
      estimatedEndDate: project.estimatedEndDate?.toISOString() || null,
      actualEndDate: project.actualEndDate?.toISOString() || null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })
  } catch {
    return serverError()
  }
}
