import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { recordProjectFile } from '@/lib/project-file-records'
import { isProjectBlobUrl } from '@/lib/project-files'
import { inspectProjectBlob, projectFileExpiryDate } from '@/lib/project-file-security'

const schema = z.object({
  ticketId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  url: z.string().url().max(1200),
  size: z.number().int().min(0).max(8 * 1024 * 1024),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados da foto inválidos.' }, { status: 400 })
  const access = await prisma.projectPortalAccess.findFirst({
    where: {
      tokenHash: hashProjectPortalToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      project: { archivedAt: null, warrantyTickets: { some: { id: parsed.data.ticketId } } },
    },
    select: { projectId: true },
  })
  if (!access || !isProjectBlobUrl(parsed.data.url, access.projectId)) {
    return NextResponse.json({ error: 'Chamado não encontrado.' }, { status: 404 })
  }
  const inspection = await inspectProjectBlob({
    url: parsed.data.url,
    expectedType: parsed.data.type,
    name: parsed.data.name,
  })
  if (inspection.status === 'REJECTED') {
    await del(parsed.data.url).catch(() => undefined)
    await prisma.projectFile.deleteMany({ where: { projectId: access.projectId, url: parsed.data.url } })
    return NextResponse.json({ error: inspection.details || 'A foto foi rejeitada.' }, { status: 422 })
  }
  const file = await recordProjectFile({
    projectId: access.projectId,
    warrantyTicketId: parsed.data.ticketId,
    category: 'WARRANTY',
    name: parsed.data.name,
    type: parsed.data.type,
    url: parsed.data.url,
    size: inspection.size ?? parsed.data.size,
    securityStatus: inspection.status,
    securityDetails: inspection.details,
    securityCheckedAt: new Date(),
    expiresAt: projectFileExpiryDate(),
  })
  return NextResponse.json(file, { status: inspection.status === 'ERROR' ? 503 : 201 })
}
