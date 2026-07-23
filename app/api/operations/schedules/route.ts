import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, requireAuth } from '@/lib/security'
import { ACTIVE_INSTALLATION_SCHEDULE_STATUSES, INSTALLATION_SCHEDULE_STATUSES } from '@/lib/installation-schedule'

const scheduleSchema = z.object({
  projectId: z.string().trim().min(1),
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true }),
  teamId: z.string().trim().nullable().optional(),
  vehicleId: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(800).nullable().optional(),
  clientConfirmation: z.string().trim().max(120).nullable().optional(),
  completionNotes: z.string().trim().max(1200).nullable().optional(),
  status: z.enum(INSTALLATION_SCHEDULE_STATUSES).default('SCHEDULED'),
}).strict()

function parseRange(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function serializeSchedule(schedule: {
  id: string
  projectId: string
  scheduledStart: Date
  scheduledEnd: Date
  teamId: string | null
  vehicleId: string | null
  status: string
  notes: string | null
  departureAt: Date | null
  arrivalAt: Date | null
  completedAt: Date | null
  clientConfirmation: string | null
  completionNotes: string | null
  project: { id: string; name: string; client: { name: string } }
  team: { id: string; name: string } | null
  vehicle: { id: string; name: string } | null
}) {
  return {
    ...schedule,
    scheduledStart: schedule.scheduledStart.toISOString(),
    scheduledEnd: schedule.scheduledEnd.toISOString(),
    departureAt: schedule.departureAt?.toISOString() || null,
    arrivalAt: schedule.arrivalAt?.toISOString() || null,
    completedAt: schedule.completedAt?.toISOString() || null,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const from = parseRange(searchParams.get('from'), new Date(now.getFullYear(), now.getMonth(), 1))
  const to = parseRange(searchParams.get('to'), new Date(now.getFullYear(), now.getMonth() + 1, 1))
  const projectWhere = auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }

  const [schedules, projects, resources] = await Promise.all([
    prisma.installationSchedule.findMany({
      where: { scheduledStart: { gte: from, lt: to }, project: projectWhere },
      include: {
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
        team: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    }),
    prisma.project.findMany({
      where: { ...projectWhere, stage: { not: 'COMPLETED' } },
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 250,
    }),
    prisma.operationalResource.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
  ])

  return NextResponse.json({ schedules: schedules.map(serializeSchedule), projects, resources })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  const scheduledStart = new Date(parsed.data.scheduledStart)
  const scheduledEnd = new Date(parsed.data.scheduledEnd)
  if (scheduledEnd <= scheduledStart) return badRequest('O fim da instalação deve ser posterior ao início')

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, archivedAt: null },
    select: { managerId: true },
  })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!canAccessProject(auth.user, project.managerId)) return forbidden()

  const resourceIds = [parsed.data.teamId, parsed.data.vehicleId].filter((value): value is string => Boolean(value))
  if (resourceIds.length > 0) {
    const resources = await prisma.operationalResource.findMany({
      where: { id: { in: resourceIds }, active: true },
      select: { id: true, type: true },
    })
    const resourceTypes = new Map(resources.map((resource) => [resource.id, resource.type]))
    if (
      resources.length !== resourceIds.length ||
      (parsed.data.teamId && resourceTypes.get(parsed.data.teamId) !== 'TEAM') ||
      (parsed.data.vehicleId && resourceTypes.get(parsed.data.vehicleId) !== 'VEHICLE')
    ) {
      return badRequest('Equipe ou veículo inválido.')
    }
  }

  const resourceFilters = [
    ...(parsed.data.teamId ? [{ teamId: parsed.data.teamId }] : []),
    ...(parsed.data.vehicleId ? [{ vehicleId: parsed.data.vehicleId }] : []),
  ]
  const conflict = resourceFilters.length > 0
    ? await prisma.installationSchedule.findFirst({
        where: {
          status: { in: ACTIVE_INSTALLATION_SCHEDULE_STATUSES },
          scheduledStart: { lt: scheduledEnd },
          scheduledEnd: { gt: scheduledStart },
          OR: resourceFilters,
        },
        include: { project: { select: { name: true } }, team: { select: { name: true } }, vehicle: { select: { name: true } } },
      })
    : null
  if (conflict) {
    const resourceName = conflict.team?.name || conflict.vehicle?.name || 'recurso'
    return NextResponse.json({ error: `${resourceName} já está reservado para ${conflict.project.name} nesse horário.` }, { status: 409 })
  }

  const schedule = await prisma.$transaction(async (tx) => {
    const created = await tx.installationSchedule.create({
      data: {
        projectId: parsed.data.projectId,
        scheduledStart,
        scheduledEnd,
        teamId: parsed.data.teamId || null,
        vehicleId: parsed.data.vehicleId || null,
        notes: parsed.data.notes || null,
        clientConfirmation: parsed.data.clientConfirmation || null,
        completionNotes: parsed.data.completionNotes || null,
        status: 'SCHEDULED',
      },
      include: {
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
        team: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true } },
      },
    })
    await tx.timelineEvent.create({
      data: {
        projectId: created.projectId,
        event: 'Instalação agendada',
        description: `Instalação reservada para ${created.scheduledStart.toLocaleDateString('pt-BR')}.`,
      },
    })
    return created
  })
  return NextResponse.json(serializeSchedule(schedule), { status: 201 })
}
