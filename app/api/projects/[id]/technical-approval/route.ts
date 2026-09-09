import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole, canAccessProject, badRequest, serverError, getClientIp, serviceUnavailable } from '@/lib/security'
import { technicalFileSnapshot, technicalApprovalReady } from '@/lib/technical-approval'
import { dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  customer: z.string().trim().min(3, 'Identifique quem aprovou.').max(160),
  approvedAt: z.string().date(),
  evidence: z.string().trim().min(15, 'Descreva onde está o aceite do cliente e a versão aprovada.').max(3000),
  snapshot: z.string().max(20000),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`technical:${auth.user.id}:${getClientIp(req)}`, 30, 60_000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Aguarde um minuto e tente novamente.' }, { status: 429 })
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message)
  if (parsed.data.approvedAt > dateOnlyKeyInTimeZone(new Date())) return badRequest('A aprovação não pode ter data futura.')
  try {
    await prisma.$transaction(async tx => {
      const project = await tx.project.findFirst({ where: { id, archivedAt: null }, include: { files: true } })
      if (!project || !canAccessProject(auth.user, project.managerId)) throw new Error('NOT_FOUND')
      const snapshot = technicalFileSnapshot(project.files)
      if (snapshot !== parsed.data.snapshot) throw new Error('STALE')
      const approvedAt = toDateOnlyUtc(parsed.data.approvedAt)!
      if (!technicalApprovalReady({ workflowVersion: 2, technicalApprovedAt: approvedAt, technicalApprovalSnapshot: snapshot, files: project.files })) throw new Error('FILES')
      await tx.project.update({ where: { id }, data: {
        workflowVersion: 2, technicalApprovedAt: approvedAt, technicalApprovalSnapshot: snapshot,
        technicalApprovalCustomer: parsed.data.customer, technicalApprovalEvidence: parsed.data.evidence,
        technicalApprovalRecordedBy: auth.user.id,
      } })
      await tx.timelineEvent.create({ data: { projectId: id, event: 'Aprovação técnica registrada',
        description: `${parsed.data.customer} aprovou os arquivos ${snapshot} em ${parsed.data.approvedAt}. Registrado por ${auth.user.name || auth.user.id}. Evidência: ${parsed.data.evidence}`,
      } })
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    if (error instanceof Error && error.message === 'FILES') return badRequest('Anexe os arquivos técnicos e aguarde a verificação antes de registrar o aceite.')
    if ((error instanceof Error && error.message === 'STALE') || (typeof error === 'object' && error && 'code' in error && error.code === 'P2034')) return NextResponse.json({ error: 'Os arquivos mudaram. Atualize o projeto e confira a versão antes de registrar o aceite.' }, { status: 409 })
    return serverError()
  }
}
