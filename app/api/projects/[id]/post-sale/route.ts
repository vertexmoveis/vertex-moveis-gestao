import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const postSaleSchema = z.object({ contacted: z.boolean() }).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:post-sale:${auth.user.id}:${id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos.')
  }
  const parsed = postSaleSchema.safeParse(body)
  if (!parsed.success) return badRequest('Dados inválidos.')

  try {
    const existing = await prisma.project.findFirst({
      where: { id, archivedAt: null },
      select: { managerId: true, name: true, stage: true },
    })
    if (!existing) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    if (!canAccessProject(auth.user, existing.managerId)) return forbidden()
    if (existing.stage !== 'COMPLETED') return badRequest('O pós-venda fica disponível após a conclusão do projeto.')

    const now = new Date()
    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: parsed.data.contacted
          ? { postSaleContactedAt: now }
          : { postSaleContactedAt: null, postSaleFollowUpAt: now },
        select: { postSaleFollowUpAt: true, postSaleContactedAt: true, warrantyEndsAt: true },
      })
      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: parsed.data.contacted ? 'Pós-venda realizado' : 'Pós-venda reaberto',
          description: parsed.data.contacted
            ? `Contato de pós-venda registrado para o projeto "${existing.name}".`
            : 'O acompanhamento de pós-venda voltou para a fila de pendências.',
        },
      })
      return updated
    })

    return NextResponse.json({
      postSaleFollowUpAt: project.postSaleFollowUpAt?.toISOString() || null,
      postSaleContactedAt: project.postSaleContactedAt?.toISOString() || null,
      warrantyEndsAt: project.warrantyEndsAt?.toISOString() || null,
    })
  } catch {
    return serverError()
  }
}
