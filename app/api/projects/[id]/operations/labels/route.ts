import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { renderProjectLabelsPdf } from '@/lib/project-labels-pdf'
import { canAccessProject, requireAuth } from '@/lib/security'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      name: true,
      managerId: true,
      cutPieces: { orderBy: { createdAt: 'asc' }, take: 300 },
    },
  })

  if (!project || !canAccessProject(auth.user, project.managerId)) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }
  if (project.cutPieces.length === 0) {
    return NextResponse.json({ error: 'Cadastre ao menos uma peça antes de gerar as etiquetas.' }, { status: 400 })
  }

  const projectUrl = new URL(`/dashboard/projects/${project.id}#operacao`, req.url).toString()
  const pieces = await Promise.all(project.cutPieces.map(async (piece) => ({
    ...piece,
    qrCode: await QRCode.toDataURL(`${projectUrl}?piece=${encodeURIComponent(piece.id)}`, { width: 180, margin: 1 }),
  })))
  const pdf = await renderProjectLabelsPdf({ projectName: project.name, pieces })
  const filename = `etiquetas-${project.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || project.id}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
