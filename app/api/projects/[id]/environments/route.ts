import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { serializeEnvironment } from '@/lib/project-environments'

const schema = z.object({ name: z.string().trim().min(1).max(120).transform(value => value.replace(/\s+/g, ' ')) }).strict()
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const limited = await rateLimit(`api:environment:create:${auth.user.id}:${id}:${getClientIp(req)}`, 30, 60000).catch(error => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Informe o nome do ambiente.')
  const project = await prisma.project.findFirst({ where: { id, archivedAt: null }, select: { managerId: true } })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  if (!canAccessProject(auth.user, project.managerId)) return forbidden()
  try {
    const environment = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${id} FOR UPDATE`
      const existing = await tx.projectEnvironment.findMany({ where: { projectId: id }, select: { name: true, position: true } })
      if (existing.length >= 60) throw new Error('ENV_LIMIT')
      if (existing.some(row => row.name.toLocaleLowerCase('pt-BR') === parsed.data.name.toLocaleLowerCase('pt-BR'))) throw new Error('ENV_DUPLICATE')
      const created = await tx.projectEnvironment.create({ data: { projectId: id, name: parsed.data.name, position: Math.max(0, ...existing.map(row => row.position)) + 1 } })
      await tx.activityLog.create({ data: { userId: auth.user.id, projectId: id, action: 'Ambiente adicionado ao acompanhamento', details: created.name } })
      await tx.timelineEvent.create({ data: { projectId: id, event: 'Ambiente adicionado', description: created.name } })
      return created
    })
    return NextResponse.json(serializeEnvironment(environment), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'ENV_LIMIT') return badRequest('O projeto permite até 60 ambientes.')
    if (error instanceof Error && error.message === 'ENV_DUPLICATE') return NextResponse.json({ error: 'Já existe um ambiente com esse nome.' }, { status: 409 })
    return serverError()
  }
}
