import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { recordProjectFile } from '@/lib/project-file-records'
import {
  ALLOWED_PROJECT_FILE_TYPES,
  isProjectFileCategory,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_MAX_SIZE,
} from '@/lib/project-files'
import { canAccessProject, requireAuth } from '@/lib/security'

const clientPayloadSchema = z.object({
  projectId: z.string().trim().min(1),
  category: z.enum(PROJECT_FILE_CATEGORIES),
  name: z.string().trim().min(1).max(180),
}).strict()

function parsePayload(value: string | null | undefined) {
  let payload: unknown
  try {
    payload = JSON.parse(value || '{}')
  } catch {
    throw new Error('Dados do arquivo inválidos.')
  }
  const parsed = clientPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Dados do arquivo inválidos.')
  return parsed.data
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'O armazenamento de arquivos não está disponível neste ambiente.' }, { status: 503 })
  }

  const { id } = await params
  let body: HandleUploadBody
  try {
    body = await req.json() as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Dados do envio inválidos.' }, { status: 400 })
  }

  try {
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const auth = await requireAuth()
        if (!auth.ok) throw new Error('Faça login para enviar arquivos.')

        const payload = parsePayload(clientPayload)
        if (payload.projectId !== id || !isProjectFileCategory(payload.category)) {
          throw new Error('Dados do arquivo inválidos.')
        }
        if (!pathname.startsWith(`projects/${id}/`)) {
          throw new Error('Destino de arquivo inválido.')
        }

        const project = await prisma.project.findUnique({ where: { id }, select: { managerId: true } })
        if (!project) throw new Error('Projeto não encontrado.')
        if (!canAccessProject(auth.user, project.managerId)) throw new Error('Você não tem acesso a este projeto.')

        return {
          allowedContentTypes: [...ALLOWED_PROJECT_FILE_TYPES],
          maximumSizeInBytes: PROJECT_FILE_MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload)
        await recordProjectFile({
          projectId: payload.projectId,
          category: payload.category,
          name: payload.name,
          type: blob.contentType || 'application/octet-stream',
          url: blob.url,
          size: null,
        })
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.',
    }, { status: 400 })
  }
}
