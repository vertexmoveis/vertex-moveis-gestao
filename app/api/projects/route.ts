import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const stage = searchParams.get('stage') || ''

  const where: Record<string, unknown> = {}

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
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const project = await prisma.project.create({
    data: {
      clientId: data.clientId,
      name: data.name,
      room: data.room || null,
      status: data.status || 'APPROVED',
      stage: data.stage || 'PENDING_START',
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

  await prisma.timelineEvent.create({
    data: {
      projectId: project.id,
      event: 'Projeto Criado',
      description: `Projeto "${project.name}" criado no sistema`,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: (session.user as { id?: string }).id,
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
}
