import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import {
  badRequest,
  canAccessProject,
  getClientIp,
  requireAuth,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { WARRANTY_PRIORITIES } from '@/lib/warranty'
import { toDateOnlyUtc } from '@/lib/date-only'

const createSchema = z.object({
  title: z.string().trim().min(3, 'Informe o assunto do chamado.').max(120),
  description: z.string().trim().min(3, 'Descreva o que aconteceu.').max(2000),
  priority: z.enum(WARRANTY_PRIORITIES).default('NORMAL'),
  scheduledAt: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().optional(),
  ),
}).strict()

async function projectWithAccess(projectId: string, user: Parameters<typeof canAccessProject>[0]) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, archivedAt: null },
    select: { id: true, name: true, managerId: true },
  })
  return project && canAccessProject(user, project.managerId) ? project : null
}

async function limit(req: NextRequest, userId: string, projectId: string) {
  return rateLimit(
    `api:projects:warranty:${userId}:${projectId}:${getClientIp(req)}`,
    30,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

function serializeTicket(ticket: {
  id: string
  title: string
  description: string
  priority: string
  status: string
  openedAt: Date
  scheduledAt: Date | null
  resolvedAt: Date | null
  resolution: string | null
  createdAt: Date
  updatedAt: Date
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}) {
  return {
    ...ticket,
    openedAt: ticket.openedAt.toISOString(),
    scheduledAt: ticket.scheduledAt?.toISOString() || null,
    resolvedAt: ticket.resolvedAt?.toISOString() || null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await projectWithAccess(id, auth.user)) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const tickets = await prisma.warrantyTicket.findMany({
    where: { projectId: id },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: [
      { resolvedAt: 'asc' },
      { priority: 'desc' },
      { openedAt: 'desc' },
    ],
    take: 50,
  })
  return NextResponse.json(tickets.map(serializeTicket))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const project = await projectWithAccess(id, auth.user)
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const limited = await limit(req, auth.user.id, id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
  }
  const scheduledAt = parsed.data.scheduledAt
    ? toDateOnlyUtc(parsed.data.scheduledAt)
    : null
  if (parsed.data.scheduledAt && !scheduledAt) return badRequest('Informe uma data válida.')

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.warrantyTicket.create({
        data: {
          projectId: id,
          createdById: auth.user.id,
          assignedToId: auth.user.id,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: parsed.data.priority,
          status: scheduledAt ? 'SCHEDULED' : 'OPEN',
          scheduledAt,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Chamado de garantia aberto',
          description: parsed.data.title,
        },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Chamado de garantia aberto',
          details: parsed.data.title,
        },
      })
      return created
    })
    return NextResponse.json(serializeTicket(ticket), { status: 201 })
  } catch (error) {
    console.error('Erro ao abrir chamado de garantia.', error)
    return serverError()
  }
}
