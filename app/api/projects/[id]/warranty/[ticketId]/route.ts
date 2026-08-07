import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { toDateOnlyUtc } from '@/lib/date-only'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import {
  badRequest,
  canAccessProject,
  getClientIp,
  requireAuth,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { WARRANTY_PRIORITIES, WARRANTY_STATUSES, warrantyDueAt } from '@/lib/warranty'

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(3).max(2000).optional(),
  priority: z.enum(WARRANTY_PRIORITIES).optional(),
  status: z.enum(WARRANTY_STATUSES).optional(),
  scheduledAt: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().nullable().optional(),
  ),
  resolution: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().max(2000).nullable().optional(),
  ),
  assignedToId: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().nullable().optional(),
  ),
}).strict().refine((value) => Object.keys(value).length > 0, 'Nenhuma alteração informada.')

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id, ticketId } = await params

  const limited = await rateLimit(
    `api:projects:warranty:update:${auth.user.id}:${ticketId}:${getClientIp(req)}`,
    40,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const existing = await prisma.warrantyTicket.findFirst({
    where: { id: ticketId, projectId: id },
    include: { project: { select: { managerId: true } } },
  })
  if (!existing || !canAccessProject(auth.user, existing.project.managerId)) {
    return NextResponse.json({ error: 'Chamado não encontrado.' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')

  const status = parsed.data.status || existing.status
  const resolution = parsed.data.resolution === undefined
    ? existing.resolution
    : parsed.data.resolution
  if (status === 'RESOLVED' && (!resolution || resolution.trim().length < 3)) {
    return badRequest('Informe como o chamado foi resolvido.')
  }

  const scheduledAt = parsed.data.scheduledAt === undefined
    ? existing.scheduledAt
    : parsed.data.scheduledAt
      ? toDateOnlyUtc(parsed.data.scheduledAt)
      : null
  if (parsed.data.scheduledAt && !scheduledAt) return badRequest('Informe uma data válida.')

  if (parsed.data.assignedToId) {
    const user = await prisma.user.findFirst({
      where: { id: parsed.data.assignedToId, active: true },
      select: { id: true },
    })
    if (!user) return badRequest('Responsável inválido.')
  }

  try {
    const now = new Date()
    const dueAt = parsed.data.priority && parsed.data.priority !== existing.priority
      ? warrantyDueAt(parsed.data.priority, existing.openedAt)
      : existing.dueAt
    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.warrantyTicket.update({
        where: { id: ticketId },
        data: {
          ...parsed.data,
          scheduledAt,
          resolution,
          dueAt,
          resolvedAt: status === 'RESOLVED' ? existing.resolvedAt || now : null,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })

      if (status !== existing.status) {
        await tx.timelineEvent.create({
          data: {
            projectId: id,
            event: status === 'RESOLVED' ? 'Garantia resolvida' : 'Garantia atualizada',
            description: `${existing.title}: ${status}`,
          },
        })
      }
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Chamado de garantia atualizado',
          details: existing.title,
        },
      })
      return updated
    })

    return NextResponse.json({
      ...ticket,
      openedAt: ticket.openedAt.toISOString(),
      dueAt: ticket.dueAt?.toISOString() || null,
      scheduledAt: ticket.scheduledAt?.toISOString() || null,
      resolvedAt: ticket.resolvedAt?.toISOString() || null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Erro ao atualizar chamado de garantia.', error)
    return serverError()
  }
}
