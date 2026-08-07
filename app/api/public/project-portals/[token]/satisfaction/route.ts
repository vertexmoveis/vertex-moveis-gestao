import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'

const schema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  const limited = await rateLimit(publicRateLimitKey('project-portal:satisfaction', getClientIp(req)), 5, 10 * 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) return NextResponse.json({ error: 'Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Escolha uma nota de 1 a 5.' }, { status: 400 })

  const access = await prisma.projectPortalAccess.findFirst({
    where: {
      tokenHash: hashProjectPortalToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      project: { archivedAt: null, actualEndDate: { not: null } },
    },
    select: { projectId: true },
  })
  if (!access) return NextResponse.json({ error: 'A avaliação ainda não está disponível.' }, { status: 409 })

  const now = new Date()
  await prisma.$transaction([
    prisma.project.update({
      where: { id: access.projectId },
      data: {
        satisfactionRating: parsed.data.rating,
        satisfactionComment: parsed.data.comment || null,
        satisfactionRespondedAt: now,
      },
    }),
    prisma.timelineEvent.create({
      data: {
        projectId: access.projectId,
        event: 'Avaliação recebida',
        description: `Cliente avaliou o atendimento com nota ${parsed.data.rating} de 5.${parsed.data.comment ? ` Comentário: ${parsed.data.comment}` : ''}`,
      },
    }),
  ])
  return NextResponse.json({ success: true, message: 'Obrigado. Sua avaliação foi enviada para a Vertex.' })
}
