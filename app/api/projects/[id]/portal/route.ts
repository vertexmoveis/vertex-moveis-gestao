import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { canAccessProject, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { createProjectPortalToken, decryptProjectPortalToken } from '@/lib/project-portal'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

async function getProjectWithAccess(id: string, user: { id: string; role: string }) {
  const project = await prisma.project.findFirst({
    where: { id, archivedAt: null },
    select: { id: true, managerId: true },
  })
  return project && canAccessProject(user as Parameters<typeof canAccessProject>[0], project.managerId) ? project : null
}

async function limit(req: NextRequest, userId: string, id: string) {
  return rateLimit(`api:projects:portal:${userId}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

function portalUrl(req: NextRequest, token: string) {
  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || req.nextUrl.origin
  return `${origin}/acompanhar/${token}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await getProjectWithAccess(id, auth.user)) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const access = await prisma.projectPortalAccess.findFirst({
    where: {
      projectId: id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!access) return NextResponse.json({ active: false, url: null })

  try {
    return NextResponse.json({
      active: true,
      url: portalUrl(req, decryptProjectPortalToken(access.tokenEncrypted)),
      createdAt: access.createdAt.toISOString(),
      lastViewedAt: access.lastViewedAt?.toISOString() || null,
    })
  } catch {
    return NextResponse.json({ active: false, url: null })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await getProjectWithAccess(id, auth.user)) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  const limited = await limit(req, auth.user.id, id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const portal = createProjectPortalToken()
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  await prisma.$transaction([
    prisma.projectPortalAccess.updateMany({
      where: { projectId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.projectPortalAccess.create({
      data: { projectId: id, ...portal, expiresAt },
    }),
    prisma.activityLog.create({
      data: { userId: auth.user.id, projectId: id, action: 'Link de acompanhamento criado' },
    }),
  ])

  return NextResponse.json({ active: true, url: portalUrl(req, portal.token) }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await getProjectWithAccess(id, auth.user)) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  const limited = await limit(req, auth.user.id, id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  await prisma.projectPortalAccess.updateMany({
    where: { projectId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return NextResponse.json({ success: true })
}
