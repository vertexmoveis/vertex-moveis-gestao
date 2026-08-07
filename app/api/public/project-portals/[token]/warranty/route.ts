import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import {
  canOpenPublicWarranty,
  PUBLIC_WARRANTY_CATEGORIES,
  PUBLIC_WARRANTY_CATEGORY_LABELS,
} from '@/lib/project-portal-support'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'

const requestSchema = z.object({
  category: z.enum(PUBLIC_WARRANTY_CATEGORIES),
  description: z.string().trim().min(10, 'Conte um pouco mais sobre o que aconteceu.').max(1500),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  }

  const limited = await rateLimit(
    publicRateLimitKey('project-portal:warranty', getClientIp(req)),
    5,
    10 * 60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) {
    return NextResponse.json({ error: 'Aguarde alguns minutos antes de enviar outro pedido.' }, { status: 429 })
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Pedido inválido.' }, { status: 400 })
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
          actualEndDate: true,
          warrantyEndsAt: true,
          client: { select: { name: true } },
        },
      },
    },
  })
  const project = access?.project
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  if (!canOpenPublicWarranty(project)) {
    return NextResponse.json({ error: 'A abertura de assistência não está disponível para este projeto.' }, { status: 409 })
  }

  const label = PUBLIC_WARRANTY_CATEGORY_LABELS[parsed.data.category]
  const duplicate = await prisma.warrantyTicket.findFirst({
    where: {
      projectId: project.id,
      title: label,
      description: parsed.data.description,
      status: { notIn: ['RESOLVED', 'CANCELED'] },
      openedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { id: true },
  })
  if (duplicate) {
    return NextResponse.json({ success: true, message: 'Este pedido já foi recebido pela Vertex.' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.warrantyTicket.create({
      data: {
        projectId: project.id,
        title: label,
        description: parsed.data.description,
        priority: 'NORMAL',
        status: 'OPEN',
      },
    })
    await tx.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Assistência solicitada pelo cliente',
        description: `${project.client.name} abriu um pedido pelo portal: ${label}.`,
      },
    })
  })

  return NextResponse.json({
    success: true,
    message: 'Pedido recebido. A equipe da Vertex entrará em contato para continuar o atendimento.',
  }, { status: 201 })
}
