import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { recordProjectFile } from '@/lib/project-file-records'
import {
  isAllowedProjectFileType,
  isProjectBlobUrl,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_MAX_SIZE,
} from '@/lib/project-files'
import { badRequest, canAccessProject, forbidden, requireAuth, serverError } from '@/lib/security'

const fileRecordSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do arquivo.').max(180),
  type: z.string().trim().min(1).max(120),
  category: z.enum(PROJECT_FILE_CATEGORIES),
  url: z.string().url().max(1200),
  size: z.number().int().min(0).max(PROJECT_FILE_MAX_SIZE).nullable().optional(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados do arquivo inválidos.')
  }

  const parsed = fileRecordSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados do arquivo inválidos.')
  if (!isAllowedProjectFileType(parsed.data.type)) return badRequest('Envie apenas imagens ou arquivos PDF.')
  if (!isProjectBlobUrl(parsed.data.url, id)) return badRequest('O arquivo não pertence a este projeto.')

  try {
    const project = await prisma.project.findUnique({ where: { id }, select: { managerId: true } })
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    if (!canAccessProject(auth.user, project.managerId)) return forbidden()

    const file = await recordProjectFile({ projectId: id, ...parsed.data, size: parsed.data.size ?? null })
    return NextResponse.json(file, { status: 201 })
  } catch {
    return serverError()
  }
}
