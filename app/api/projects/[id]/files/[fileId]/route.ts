import { del, get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  isProjectBlobUrl,
  normalizeProjectFileDisplayName,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_CATEGORY_LABELS,
  type ProjectFileCategory,
} from '@/lib/project-files'
import { badRequest, canAccessProject, forbidden, requireAuth, serverError } from '@/lib/security'
import { canDownloadProjectFile } from '@/lib/project-file-security'

const fileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do arquivo.').max(180).optional(),
  category: z.enum(PROJECT_FILE_CATEGORIES).optional(),
}).strict().refine((value) => value.name !== undefined || value.category !== undefined, {
  message: 'Informe o que deseja alterar.',
})

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
  if (!canDownloadProjectFile(file.type, file.securityStatus)) {
    return NextResponse.json({ error: 'O arquivo ainda não foi liberado pela verificação de segurança.' }, { status: 423 })
  }
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

    const contentType = result.blob.contentType || file.type || 'application/octet-stream'
    const safeName = file.name.replace(/["\\\r\n]/g, '_')
    headers.set('Content-Type', contentType)
    headers.set(
      'Content-Disposition',
      contentType === 'application/pdf'
        ? `attachment; filename="${safeName}"`
        : result.blob.contentDisposition || `inline; filename="${safeName}"`,
    )
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, fileId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados do arquivo inválidos.')
  }

  const parsed = fileUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados do arquivo inválidos.')

  const file = await getFileWithAccess(id, fileId)
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 })
  if (!canAccessProject(auth.user, file.project.managerId)) return forbidden()

  const name = parsed.data.name === undefined
    ? file.name
    : normalizeProjectFileDisplayName(parsed.data.name, file.name)
  if (!name) return badRequest('Informe um nome válido para o arquivo.')

  const category = parsed.data.category ?? file.category
  if (name === file.name && category === file.category) return NextResponse.json(file)
  const categoryLabel = PROJECT_FILE_CATEGORY_LABELS[category as ProjectFileCategory] || 'Outros arquivos'

  const historyDescription = name !== file.name && category !== file.category
    ? `${file.name} foi renomeado para ${name} e movido para ${categoryLabel}.`
    : name !== file.name
      ? `${file.name} foi renomeado para ${name}.`
      : `${file.name} foi movido para ${categoryLabel}.`

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const nextFile = await tx.projectFile.update({
        where: { id: file.id },
        data: { name, category },
      })
      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Arquivo organizado',
          description: historyDescription,
        },
      })
      return nextFile
    })
    return NextResponse.json(updated)
  } catch {
    return serverError()
  }
}
