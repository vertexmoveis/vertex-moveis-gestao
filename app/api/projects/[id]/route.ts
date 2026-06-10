import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      files: { orderBy: { createdAt: 'desc' } },
      timeline: { orderBy: { date: 'asc' } },
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
    files: project.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    timeline: project.timeline.map((t) => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const existing = await prisma.project.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const project = await prisma.project.update({
    where: { id },
    data: {
      clientId: data.clientId,
      name: data.name,
      room: data.room || null,
      status: data.status,
      stage: data.stage,
      startDate: data.startDate ? new Date(data.startDate) : null,
      estimatedEndDate: data.estimatedEndDate ? new Date(data.estimatedEndDate) : null,
      value: data.value ? parseFloat(data.value) : null,
      managerId: data.managerId || null,
      internalNotes: data.internalNotes || null,
    },
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
      manager: { select: { id: true, name: true } },
    },
  })

  if (existing.status !== project.status || existing.stage !== project.stage) {
    await prisma.activityLog.create({
      data: {
        userId: (session.user as { id?: string }).id,
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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const project = await prisma.project.update({
    where: { id },
    data,
  })

  return NextResponse.json({ success: true, stage: project.stage })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
