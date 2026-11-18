import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isEnvironmentCompleted, PROJECT_ENVIRONMENT_STATUSES, serializeEnvironment } from '@/lib/project-environments'
import { badRequest, canAccessProject, forbidden, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { PRODUCTION_STAGE_FLOW, type ProductionStage, type ProjectEnvironmentStatus } from '@/types'
import { environmentStatusForStage, environmentWorkflowLabel, getEnvironmentWorkflowStage } from '@/lib/environment-workflow'

const environmentPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).transform(value => value.replace(/\s+/g, ' ')).optional(),
  status: z.enum(PROJECT_ENVIRONMENT_STATUSES).optional(),
  workflowStage: z.enum(PRODUCTION_STAGE_FLOW as [ProductionStage, ...ProductionStage[]]).nullable().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  mdfSpecifications: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    application: z.string().trim().min(1).max(120),
    side: z.enum(['EXTERNAL', 'INTERNAL']),
    mdf: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(240).nullable(),
  }).strict()).max(30).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update')
  .refine((value) => value.workflowStage === undefined || value.status === undefined, 'Update the environment stage or its progress separately')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; environmentId: string }> }
) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
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

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.name !== undefined) await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${id} FOR UPDATE`
      await tx.$queryRaw`SELECT "id" FROM "ProjectEnvironment" WHERE "id" = ${environmentId} FOR UPDATE`
      const current = await tx.projectEnvironment.findUniqueOrThrow({ where: { id: environmentId } })
      if (parsed.data.name !== undefined) {
        const siblings = await tx.projectEnvironment.findMany({ where: { projectId: id, id: { not: environmentId } }, select: { name: true } })
        if (siblings.some(row => row.name.toLocaleLowerCase('pt-BR') === parsed.data.name!.toLocaleLowerCase('pt-BR'))) throw new Error('ENV_DUPLICATE')
      }
      const stageProvided = parsed.data.workflowStage !== undefined
      const stageStatus = parsed.data.workflowStage ? environmentStatusForStage(parsed.data.workflowStage) : null
      const nextStatus = (stageStatus || parsed.data.status || current.status) as ProjectEnvironmentStatus
      const statusChanged = nextStatus !== current.status
      const nextStage = stageProvided
        ? parsed.data.workflowStage
        : statusChanged ? getEnvironmentWorkflowStage({ status: nextStatus }) : current.workflowStage
      const stageChanged = nextStage !== current.workflowStage
      const now = new Date()
      const saved = await tx.projectEnvironment.update({
        where: { id: environmentId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(stageProvided || statusChanged ? { workflowStage: nextStage } : {}),
          ...(stageStatus || parsed.data.status !== undefined ? {
            status: nextStatus,
            startedAt: nextStatus !== 'PENDING' && !current.startedAt ? now : current.startedAt,
            completedAt: isEnvironmentCompleted(nextStatus) ? current.completedAt || now : null,
          } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.mdfSpecifications === undefined ? {} : { mdfSpecifications: parsed.data.mdfSpecifications as Prisma.InputJsonValue }),
        },
      })
      await tx.activityLog.create({ data: {
        userId: auth.user.id, projectId: id,
        action: parsed.data.mdfSpecifications !== undefined ? 'MDF do ambiente atualizado' : stageChanged ? 'Etapa do ambiente atualizada' : 'Ambiente atualizado',
        details: parsed.data.mdfSpecifications !== undefined
          ? `${saved.name}: ${parsed.data.mdfSpecifications.length} especificações de MDF`
          : `${saved.name}: ${environmentWorkflowLabel(saved)}`,
      } })
      if (stageChanged) await tx.timelineEvent.create({ data: {
        projectId: id, event: 'Etapa do ambiente atualizada', description: `${saved.name}: ${environmentWorkflowLabel(saved)}.`,
      } })
      return saved
    })

    return NextResponse.json(serializeEnvironment(updated))
  } catch (error) {
    if (error instanceof Error && error.message === 'ENV_DUPLICATE') return NextResponse.json({ error: 'Já existe um ambiente com esse nome.' }, { status: 409 })
    return serverError()
  }
}
