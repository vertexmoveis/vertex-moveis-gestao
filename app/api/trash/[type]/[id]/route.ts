import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProjectBlobUrl } from '@/lib/project-files'
import { badRequest, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { syncClientRelationshipStage } from '@/lib/client-relationship'

type TrashType = 'client' | 'project' | 'quote'

function isTrashType(value: string): value is TrashType {
  return value === 'client' || value === 'project' || value === 'quote'
}

async function limitTrashAction(req: NextRequest, userId: string, action: string) {
  return rateLimit(`api:trash:${action}:${userId}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { type, id } = await params
  if (!isTrashType(type)) return badRequest('Tipo de registro inválido.')
  const limited = await limitTrashAction(req, auth.user.id, 'restore')
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    if (type === 'client') {
      await prisma.$transaction(async (tx) => {
        await tx.client.update({ where: { id }, data: { archivedAt: null } })
        await tx.project.updateMany({ where: { clientId: id }, data: { archivedAt: null } })
        await tx.quote.updateMany({ where: { clientId: id }, data: { archivedAt: null } })
        await syncClientRelationshipStage(tx, id, { activityAt: new Date() })
      })
    } else if (type === 'project') {
      const project = await prisma.project.findUnique({ where: { id }, select: { clientId: true } })
      if (!project) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
      await prisma.$transaction(async (tx) => {
        await tx.client.update({ where: { id: project.clientId }, data: { archivedAt: null } })
        await tx.project.update({ where: { id }, data: { archivedAt: null } })
        await syncClientRelationshipStage(tx, project.clientId, { activityAt: new Date() })
      })
    } else {
      const quote = await prisma.quote.findUnique({ where: { id }, select: { clientId: true } })
      if (!quote) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
      await prisma.$transaction(async (tx) => {
        await tx.client.update({ where: { id: quote.clientId }, data: { archivedAt: null } })
        await tx.quote.update({ where: { id }, data: { archivedAt: null } })
        await syncClientRelationshipStage(tx, quote.clientId, { activityAt: new Date() })
      })
    }
    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { type, id } = await params
  if (!isTrashType(type)) return badRequest('Tipo de registro inválido.')
  const limited = await limitTrashAction(req, auth.user.id, 'purge')
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    if (type === 'quote') {
      const quote = await prisma.quote.findFirst({ where: { id, archivedAt: { not: null } }, select: { id: true } })
      if (!quote) return NextResponse.json({ error: 'Registro não encontrado na lixeira.' }, { status: 404 })
      await prisma.quote.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    if (type === 'client') {
      const client = await prisma.client.findFirst({
        where: { id, archivedAt: { not: null } },
        select: { _count: { select: { projects: true, quotes: true } } },
      })
      if (!client) return NextResponse.json({ error: 'Registro não encontrado na lixeira.' }, { status: 404 })
      if (client._count.projects > 0 || client._count.quotes > 0) {
        return NextResponse.json({
          error: 'Este cliente possui histórico e não pode ser apagado definitivamente. Restaure o cadastro e use a classificação comercial.',
        }, { status: 409 })
      }
    }

    const projects = type === 'project'
      ? await prisma.project.findMany({
          where: { id, archivedAt: { not: null } },
          select: { id: true, files: { select: { url: true } } },
        })
      : await prisma.project.findMany({
          where: { clientId: id },
          select: { id: true, files: { select: { url: true } } },
        })

    const blobUrls = projects.flatMap((project) => (
      project.files
        .map((file) => file.url)
        .filter((url) => isProjectBlobUrl(url, project.id))
    ))
    if (blobUrls.length > 0) await del(blobUrls)

    if (type === 'project') {
      const deleted = await prisma.project.deleteMany({ where: { id, archivedAt: { not: null } } })
      if (deleted.count === 0) return NextResponse.json({ error: 'Registro não encontrado na lixeira.' }, { status: 404 })
    } else {
      const deleted = await prisma.client.deleteMany({ where: { id, archivedAt: { not: null } } })
      if (deleted.count === 0) return NextResponse.json({ error: 'Registro não encontrado na lixeira.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return serverError()
  }
}
