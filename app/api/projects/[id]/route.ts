import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { projectPatchSchema, projectUpdateSchema } from '@/lib/schemas'
import { PRODUCTION_STAGE_STATUS, type ProductionStage } from '@/types'
import {
  badRequest,
  canAccessProject,
  forbidden,
  getClientIp,
  requireAuth,
  requireRole,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:get:${auth.user.id}:${id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await prisma.project.findUnique({ where: { id }, select: { managerId: true } })
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessProject(auth.user, access.managerId)) return forbidden()

  const project = await prisma.project.findUnique({
    where: { id },
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
      internalNotes: auth.user.role === 'ADMIN',
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          whatsapp: true,
          email: auth.user.role === 'ADMIN',
          address: auth.user.role === 'ADMIN',
          createdAt: true,
          updatedAt: true,
        },
      },
      manager: { select: { id: true, name: true, email: auth.user.role === 'ADMIN' } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      files: auth.user.role === 'ADMIN' ? { orderBy: { createdAt: 'desc' } } : false,
      timeline: { select: { id: true, event: true, description: true, date: true, createdAt: true }, orderBy: { date: 'asc' } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...project,
    startDate: project.startDate?.toISOString() || null,
    estimatedEndDate: project.estimatedEndDate?.toISOString() || null,
    actualEndDate: project.actualEndDate?.toISOString() || null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    client: {
      ...project.client,
      createdAt: project.client.createdAt.toISOString(),
      updatedAt: project.client.updatedAt.toISOString(),
    },
    notes: project.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    files: 'files' in project && Array.isArray(project.files) ? project.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })) : [],
    timeline: project.timeline.map((t) => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:put:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = projectUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const input = parsed.data
    const project = await prisma.project.update({
      where: { id },
      data: {
        clientId: input.clientId,
        name: input.name,
        room: input.room,
        status: input.status,
        stage: input.stage,
        startDate: input.startDate,
        estimatedEndDate: input.estimatedEndDate,
        value: input.value,
        managerId: input.managerId,
        internalNotes: input.internalNotes,
      },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true } },
        manager: { select: { id: true, name: true } },
      },
    })

    if (existing.status !== project.status || existing.stage !== project.stage) {
      await prisma.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Projeto atualizado',
          details: `Status: ${project.status} | Etapa: ${project.stage}`,
        },
      })
    }

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:patch:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
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

  const parsed = projectPatchSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const existing = await prisma.project.findUnique({ where: { id }, select: { managerId: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessProject(auth.user, existing.managerId)) return forbidden()

    const data = {
      ...parsed.data,
      status:
        parsed.data.stage && !parsed.data.status
          ? PRODUCTION_STAGE_STATUS[parsed.data.stage as ProductionStage]
          : parsed.data.status,
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      select: { stage: true, status: true, actualEndDate: true },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: id,
        action: 'Projeto atualizado',
        details: `Status: ${project.status} | Etapa: ${project.stage}`,
      },
    })

    return NextResponse.json({ success: true, stage: project.stage, status: project.status })
  } catch {
    return serverError()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:delete:${auth.user.id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    await prisma.project.delete({ where: { id } })
  } catch {
    return serverError()
  }

  return NextResponse.json({ success: true })
}
