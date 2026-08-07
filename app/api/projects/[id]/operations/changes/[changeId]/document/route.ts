import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { renderProjectChangePdf } from '@/lib/project-change-pdf'
import { canAccessProject, requireAuth, serverError } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; changeId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id, changeId } = await params
  const change = await prisma.projectChangeOrder.findFirst({
    where: { id: changeId, projectId: id },
    include: { project: { select: { name: true, managerId: true, client: { select: { name: true } } } } },
  })
  if (!change || !canAccessProject(auth.user, change.project.managerId)) return NextResponse.json({ error: 'Alteração não encontrada.' }, { status: 404 })
  if (!change.clientRespondedAt) return NextResponse.json({ error: 'O comprovante fica disponível após a resposta do cliente.' }, { status: 409 })
  try {
    const buffer = await renderProjectChangePdf({
      id: change.id,
      projectName: change.project.name,
      clientName: change.project.client.name,
      title: change.title,
      description: change.description,
      amountDelta: Number(change.amountDelta),
      daysDelta: change.daysDelta,
      status: change.status,
      respondentName: change.clientRespondentName,
      responseNote: change.clientResponseNote,
      respondedAt: change.clientRespondedAt,
      ipHash: change.clientResponseIpHash,
      createdAt: change.createdAt,
    })
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="alteracao-${change.id.slice(-8)}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('Erro ao gerar comprovante da alteração.', error)
    return serverError()
  }
}
