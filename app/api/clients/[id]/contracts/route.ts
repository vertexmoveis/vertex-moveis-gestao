import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clientWhereForUser } from '@/lib/client-access'
import { requireAuth, getClientIp, serviceUnavailable, serverError } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const limited = await rateLimit(`api:client:contracts:${auth.user.id}:${getClientIp(req)}`, 90, 60000).catch(error => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Aguarde um instante e tente novamente.' }, { status: 429 })
  try {
    const client = await prisma.client.findFirst({ where: clientWhereForUser(auth.user, { id }), select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    const page = Math.min(100000, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1') || 1))
    const where = { clientId: id, standaloneTitle: { not: null }, ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }) }
    const [contracts, total] = await Promise.all([
      prisma.projectContract.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 10, take: 10,
        select: { id: true, standaloneTitle: true, status: true, signedAt: true, viewedAt: true, voidedAt: true, expiresAt: true, createdAt: true, project: { select: { id: true, managerId: true, archivedAt: true } } },
      }),
      prisma.projectContract.count({ where }),
    ])
    return NextResponse.json({ total, page, items: contracts.map(c => ({
      id: c.id, title: c.standaloneTitle, createdAt: c.createdAt,
      status: c.voidedAt || c.status === 'VOID' ? 'Cancelado' : c.signedAt || c.status === 'SIGNED' ? 'Assinado' : c.expiresAt && c.expiresAt < new Date() ? 'Expirado' : c.viewedAt ? 'Visualizado' : 'Enviado',
      converted: Boolean(c.project),
      href: c.project ? !c.project.archivedAt && (auth.user.role === 'ADMIN' || c.project.managerId === auth.user.id) ? `/dashboard/projects/${c.project.id}` : null : c.voidedAt || c.status === 'VOID' ? null : `/dashboard/sales?clientId=${encodeURIComponent(id)}`,
    })) })
  } catch { return serverError() }
}
