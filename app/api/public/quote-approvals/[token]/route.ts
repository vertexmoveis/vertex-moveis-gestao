import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getClientIp } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const decisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']) }).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const limited = await rateLimit(`api:public:quote-approval:${token}:${getClientIp(req)}`, 10, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited || !limited.allowed) return NextResponse.json({ error: 'Tente novamente em alguns instantes.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }
  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Resposta inválida.' }, { status: 400 })

  const request = await prisma.quoteApprovalRequest.findUnique({
    where: { token },
    include: { quote: { select: { id: true, status: true, convertedProjectId: true } } },
  })
  if (!request) return NextResponse.json({ error: 'Este link não é válido.' }, { status: 404 })
  if (request.expiresAt && request.expiresAt < new Date()) return NextResponse.json({ error: 'Este link de aprovação expirou.' }, { status: 410 })
  if (request.approvedAt || request.rejectedAt || request.quote.convertedProjectId) {
    return NextResponse.json({ error: 'Este orçamento já recebeu uma resposta.' }, { status: 409 })
  }

  const now = new Date()
  const status = parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'LOST'
  await prisma.$transaction([
    prisma.quoteApprovalRequest.update({
      where: { id: request.id },
      data: parsed.data.decision === 'APPROVE' ? { approvedAt: now } : { rejectedAt: now },
    }),
    prisma.quote.update({
      where: { id: request.quote.id },
      data: parsed.data.decision === 'APPROVE' ? { status, approvedAt: now } : { status, lostAt: now, lossReason: 'Não aprovado pelo cliente' },
    }),
  ])

  return NextResponse.json({ success: true, status })
}
