import { del, get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProjectBlobUrl } from '@/lib/project-files'
import { canAccessProject, forbidden, requireAuth, serverError } from '@/lib/security'

async function getFileWithAccess(projectId: string, fileId: string) {
  return prisma.projectFile.findFirst({
    where: { id: fileId, projectId, project: { archivedAt: null } },
    include: { project: { select: { managerId: true } } },
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, fileId } = await params
  const file = await getFileWithAccess(id, fileId)
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  if (!canAccessProject(auth.user, file.project.managerId)) return forbidden()
  if (!isProjectBlobUrl(file.url, id)) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })

  try {
    const result = await get(file.url, {
      access: 'private',
      ifNoneMatch: req.headers.get('if-none-match') || undefined,
    })
    if (!result) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })

    const headers = new Headers({
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
    })
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers })

    headers.set('Content-Type', result.blob.contentType || file.type || 'application/octet-stream')
    headers.set('Content-Disposition', result.blob.contentDisposition || `inline; filename="${file.name}"`)
    return new NextResponse(result.stream, { status: 200, headers })
  } catch {
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, fileId } = await params
  const file = await getFileWithAccess(id, fileId)
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  if (!canAccessProject(auth.user, file.project.managerId)) return forbidden()

  try {
    if (isProjectBlobUrl(file.url, id)) await del(file.url)
    await prisma.$transaction(async (tx) => {
      await tx.projectFile.delete({ where: { id: file.id } })
      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Arquivo removido',
          description: file.name,
        },
      })
    })
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
