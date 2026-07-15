import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, requireAuth } from '@/lib/security'

const scheduleSchema = z.object({
  projectId: z.string().trim().min(1),
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true }),
  teamId: z.string().trim().nullable().optional(),
  vehicleId: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(800).nullable().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
}).strict()

function serializeSchedule(schedule: {
  id: string
  projectId: string
  scheduledStart: Date
  scheduledEnd: Date
  teamId: string | null
  vehicleId: string | null
  status: string
  notes: string | null
  project: { id: string; name: string; client: { name: string } }
  team: { id: string; name: string } | null
  vehicle: { id: string; name: string } | null
}) {
  return { ...schedule, scheduledStart: schedule.scheduledStart.toISOString(), scheduledEnd: schedule.scheduledEnd.toISOString() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const existing = await prisma.installationSchedule.findUnique({ where: { id }, include: { project: { select: { managerId: true } } } })
  if (!existing) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  if (!canAccessProject(auth.user, existing.project.managerId)) return forbidden()

  const targetProject = await prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { managerId: true } })
  if (!targetProject) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!canAccessProject(auth.user, targetProject.managerId)) return forbidden()

  const scheduledStart = new Date(parsed.data.scheduledStart)
  const scheduledEnd = new Date(parsed.data.scheduledEnd)
  if (scheduledEnd <= scheduledStart) return badRequest('O fim da instalação deve ser posterior ao início')

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
          id: { not: id },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
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

  const schedule = await prisma.installationSchedule.update({
    where: { id },
    data: { ...parsed.data, scheduledStart, scheduledEnd },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      team: { select: { id: true, name: true } },
      vehicle: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(serializeSchedule(schedule))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await prisma.installationSchedule.findUnique({ where: { id }, include: { project: { select: { managerId: true } } } })
  if (!existing) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  if (!canAccessProject(auth.user, existing.project.managerId)) return forbidden()

  await prisma.installationSchedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
