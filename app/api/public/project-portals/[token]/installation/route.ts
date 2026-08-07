import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'

const responseSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CONFIRM') }).strict(),
  z.object({
    action: z.literal('REQUEST_CHANGE'),
    note: z.string().trim().min(5, 'Explique brevemente qual data funciona melhor.').max(500),
  }).strict(),
])

const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  }

  const limited = await rateLimit(
    publicRateLimitKey('project-portal:installation', getClientIp(req)),
    8,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) {
    return NextResponse.json({ error: 'Aguarde um minuto e tente novamente.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Resposta inválida.' }, { status: 400 })
  }

  const access = await prisma.projectPortalAccess.findFirst({
    where: {
      tokenHash: hashProjectPortalToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      project: { archivedAt: null },
    },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
          installationSchedules: {
            where: { status: { in: [...ACTIVE_STATUSES] } },
            orderBy: { scheduledStart: 'asc' },
            take: 1,
            select: { id: true, status: true, notes: true },
          },
        },
      },
    },
  })
  const project = access?.project
  const schedule = project?.installationSchedules[0]
  if (!project || !schedule) {
    return NextResponse.json({ error: 'Não há uma instalação aguardando confirmação.' }, { status: 404 })
  }

  if (parsed.data.action === 'CONFIRM') {
    if (schedule.status === 'CONFIRMED') {
      return NextResponse.json({ success: true, message: 'Esta data já estava confirmada.' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.installationSchedule.updateMany({
        where: { id: schedule.id, projectId: project.id, status: 'SCHEDULED' },
        data: { status: 'CONFIRMED' },
      })
      if (result.count === 0) return false

      await tx.timelineEvent.create({
        data: {
          projectId: project.id,
          event: 'Instalação confirmada pelo cliente',
          description: `${project.client.name} confirmou a data pelo portal de acompanhamento.`,
        },
      })
      return true
    })

    if (!updated) {
      return NextResponse.json({ error: 'A agenda foi atualizada. Recarregue a página para conferir.' }, { status: 409 })
    }
    return NextResponse.json({ success: true, message: 'Data confirmada. Obrigado!' })
  }

  const requestedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
  const requestNote = `[Pedido do cliente em ${requestedAt}] ${parsed.data.note}`
  const notes = [schedule.notes?.trim(), requestNote].filter(Boolean).join('\n').slice(-2500)

  await prisma.$transaction([
    prisma.installationSchedule.update({
      where: { id: schedule.id },
      data: { notes },
    }),
    prisma.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Cliente pediu alteração da instalação',
        description: `${project.client.name}: ${parsed.data.note}`,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    message: 'Pedido enviado. A Vertex entrará em contato para combinar a nova data.',
  })
}
