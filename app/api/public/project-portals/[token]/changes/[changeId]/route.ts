import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { publicChangeCanReceiveDecision } from '@/lib/project-portal-support'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  respondentName: z.string().trim().min(2, 'Informe seu nome.').max(120),
  note: z.string().trim().max(700).optional(),
  acceptedTerms: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.decision === 'APPROVE' && !value.acceptedTerms) {
    context.addIssue({ code: 'custom', path: ['acceptedTerms'], message: 'Confirme que leu a alteração.' })
  }
  if (value.decision === 'REJECT' && (!value.note || value.note.length < 5)) {
    context.addIssue({ code: 'custom', path: ['note'], message: 'Explique brevemente o motivo da recusa.' })
  }
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; changeId: string }> },
) {
  const { token, changeId } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  }

  const ip = getClientIp(req)
  const limited = await rateLimit(
    publicRateLimitKey('project-portal:change', ip),
    8,
    10 * 60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) {
    return NextResponse.json({ error: 'Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  const parsed = decisionSchema.safeParse(await req.json().catch(() => null))
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
    select: { projectId: true },
  })
  if (!access) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const change = await prisma.projectChangeOrder.findFirst({
    where: { id: changeId, projectId: access.projectId },
    select: { id: true, title: true, status: true },
  })
  if (!change) return NextResponse.json({ error: 'Alteração não encontrada.' }, { status: 404 })
  if (!publicChangeCanReceiveDecision(change.status)) {
    return NextResponse.json({ error: 'Esta alteração já recebeu uma resposta ou não está disponível.' }, { status: 409 })
  }

  const status = parsed.data.decision === 'APPROVE' ? 'CLIENT_APPROVED' : 'CLIENT_REJECTED'
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const evidence = [
    `${parsed.data.respondentName} ${parsed.data.decision === 'APPROVE' ? 'aceitou' : 'recusou'} a alteração pelo portal.`,
    parsed.data.note ? `Observação: ${parsed.data.note}` : null,
    `Registro: ${new Date().toISOString()} · IP ${ipHash}`,
  ].filter(Boolean).join(' ')

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.projectChangeOrder.updateMany({
      where: { id: change.id, projectId: access.projectId, status: 'SENT' },
      data: {
        status,
        clientRespondedAt: new Date(),
        clientRespondentName: parsed.data.respondentName,
        clientResponseNote: parsed.data.note || null,
        clientResponseIpHash: ipHash,
      },
    })
    if (result.count === 0) return false
    await tx.timelineEvent.create({
      data: {
        projectId: access.projectId,
        event: parsed.data.decision === 'APPROVE'
          ? 'Alteração aceita pelo cliente'
          : 'Alteração recusada pelo cliente',
        description: `${change.title}. ${evidence}`,
      },
    })
    return true
  })
  if (!updated) {
    return NextResponse.json({ error: 'A alteração foi atualizada. Recarregue a página para conferir.' }, { status: 409 })
  }

  return NextResponse.json({
    success: true,
    message: parsed.data.decision === 'APPROVE'
      ? 'Aceite registrado. A Vertex fará a conferência interna antes de aplicar valor e prazo.'
      : 'Resposta registrada. A Vertex entrará em contato para revisar a alteração.',
  })
}
