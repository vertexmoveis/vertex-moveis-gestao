import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { clientWhereForUser } from '@/lib/client-access'
import { badRequest, requireAuth, requireRole } from '@/lib/security'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const client = await prisma.client.findFirst({
    where: clientWhereForUser(auth.user, { id }),
    include: req.nextUrl.searchParams.get('export') === '1' ? {
      projects: { where: { archivedAt: null }, include: { payments: true, environments: true } },
      quotes: { where: { archivedAt: null }, include: { items: true } },
    } : undefined,
  })
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  if (req.nextUrl.searchParams.get('export') === '1') {
    return new NextResponse(JSON.stringify(client, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dados-cliente-${id}.json"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }
  const requests = await prisma.privacyRequest.findMany({
    where: { clientId: id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = z.object({
    type: z.enum(['EXPORT', 'CORRECTION', 'ANONYMIZE', 'DELETE']),
    notes: z.string().trim().min(3).max(1000),
  }).strict().safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Solicitação inválida.')
  const client = await prisma.client.findFirst({ where: clientWhereForUser(auth.user, { id }), select: { id: true } })
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  const request = await prisma.privacyRequest.create({ data: { clientId: id, createdById: auth.user.id, ...parsed.data }, include: { createdBy: { select: { id: true, name: true } } } })
  return NextResponse.json(request, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = z.object({ requestId: z.string().min(1), status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']) }).strict().safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest()
  const result = await prisma.privacyRequest.updateMany({
    where: { id: parsed.data.requestId, clientId: id },
    data: { status: parsed.data.status, completedAt: parsed.data.status === 'COMPLETED' ? new Date() : null },
  })
  return NextResponse.json({ updated: result.count })
}
