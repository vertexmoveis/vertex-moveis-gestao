import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { canAccessProject, forbidden, requireAuth } from '@/lib/security'
import { inspectProjectBlob } from '@/lib/project-file-security'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, fileId } = await params
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id, project: { archivedAt: null } },
    include: { project: { select: { managerId: true } } },
  })
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  if (!canAccessProject(auth.user, file.project.managerId)) return forbidden()

  const inspection = await inspectProjectBlob({
    url: file.url,
    expectedType: file.type,
    name: file.name,
  })
  if (inspection.status === 'REJECTED') {
    await del(file.url).catch(() => undefined)
    await prisma.$transaction([
      prisma.projectFile.delete({ where: { id: file.id } }),
      prisma.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Arquivo rejeitado',
          description: `${file.name}: ${inspection.details || 'Falha na verificação de segurança.'}`,
        },
      }),
    ])
    return NextResponse.json({
      id: file.id,
      securityStatus: 'REJECTED',
      securityDetails: inspection.details,
      removed: true,
    })
  }

  const updated = await prisma.projectFile.update({
    where: { id: file.id },
    data: {
      size: inspection.size ?? file.size,
      securityStatus: inspection.status,
      securityDetails: inspection.details,
      securityCheckedAt: new Date(),
    },
  })

  return NextResponse.json({
    ...updated,
    securityCheckedAt: updated.securityCheckedAt?.toISOString() || null,
    expiresAt: updated.expiresAt?.toISOString() || null,
    createdAt: updated.createdAt.toISOString(),
  }, { status: inspection.status === 'ERROR' ? 503 : 200 })
}
