import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { recordProjectFile } from '@/lib/project-file-records'
import { sanitizeProjectFileName } from '@/lib/project-files'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const payloadSchema = z.object({
  ticketId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
}).strict()

function payload(value?: string | null) {
  const parsed = payloadSchema.safeParse(JSON.parse(value || '{}'))
  if (!parsed.success) throw new Error('Dados da foto inválidos.')
  return parsed.data
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'O armazenamento de fotos não está disponível.' }, { status: 503 })
  }
  const { token } = await params
  let body: HandleUploadBody
  try { body = await req.json() as HandleUploadBody } catch {
    return NextResponse.json({ error: 'Dados do envio inválidos.' }, { status: 400 })
  }

  try {
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const data = payload(clientPayload)
        const access = await prisma.projectPortalAccess.findFirst({
          where: {
            tokenHash: hashProjectPortalToken(token),
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            project: { archivedAt: null, warrantyTickets: { some: { id: data.ticketId } } },
          },
          select: { projectId: true },
        })
        if (!access || !pathname.startsWith(`projects/${access.projectId}/warranty/${data.ticketId}/`)) {
          throw new Error('Chamado não encontrado.')
        }
        return {
          allowedContentTypes: [...IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ ...data, projectId: access.projectId }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const data = z.object({ ...payloadSchema.shape, projectId: z.string().min(1) }).parse(JSON.parse(tokenPayload || '{}'))
        await recordProjectFile({
          projectId: data.projectId,
          warrantyTicketId: data.ticketId,
          category: 'WARRANTY',
          name: sanitizeProjectFileName(data.name),
          type: blob.contentType || 'application/octet-stream',
          url: blob.url,
          securityStatus: 'PENDING',
        })
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a foto.' }, { status: 400 })
  }
}
