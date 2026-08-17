import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isEnvironmentCompleted, PROJECT_ENVIRONMENT_STATUSES, serializeEnvironment } from '@/lib/project-environments'
import { badRequest, canAccessProject, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { PROJECT_ENVIRONMENT_STATUS_LABELS, type ProjectEnvironmentStatus } from '@/types'

const environmentPatchSchema = z.object({
  status: z.enum(PROJECT_ENVIRONMENT_STATUSES).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  mdfSpecifications: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    application: z.string().trim().min(1).max(120),
    side: z.enum(['EXTERNAL', 'INTERNAL']),
    mdf: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(240).nullable(),
  }).strict()).max(30).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; environmentId: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, environmentId } = await params
  const limited = await rateLimit(`api:projects:environment:patch:${auth.user.id}:${id}:${getClientIp(req)}`, 80, 60 * 1000).catch((error) => {
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

  const parsed = environmentPatchSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const environment = await prisma.projectEnvironment.findFirst({
      where: { id: environmentId, project: { archivedAt: null } },
      include: { project: { select: { id: true, managerId: true, name: true } } },
    })
    if (!environment || environment.project.id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessProject(auth.user, environment.project.managerId)) return forbidden()

    const nextStatus = (parsed.data.status || environment.status) as ProjectEnvironmentStatus
    const completed = isEnvironmentCompleted(nextStatus)
    const updated = await prisma.projectEnvironment.update({
      where: { id: environmentId },
      data: {
        status: nextStatus,
        notes: parsed.data.notes === undefined ? environment.notes : parsed.data.notes,
        ...(parsed.data.mdfSpecifications === undefined
          ? {}
          : { mdfSpecifications: parsed.data.mdfSpecifications as Prisma.InputJsonValue }),
        startedAt: parsed.data.status !== undefined && nextStatus !== 'PENDING' && !environment.startedAt ? new Date() : environment.startedAt,
        completedAt: parsed.data.status === undefined
          ? environment.completedAt
          : completed ? environment.completedAt || new Date() : null,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: id,
        action: parsed.data.mdfSpecifications !== undefined ? 'MDF do ambiente atualizado' : 'Ambiente atualizado',
        details: parsed.data.mdfSpecifications !== undefined
          ? `${updated.name}: ${parsed.data.mdfSpecifications.length} especificação(ões) de MDF`
          : `${updated.name}: ${PROJECT_ENVIRONMENT_STATUS_LABELS[nextStatus]}`,
      },
    })

    return NextResponse.json(serializeEnvironment(updated))
  } catch {
    return serverError()
  }
}
