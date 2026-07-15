import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id, itemId } = await params
  const limited = await rateLimit(`api:checklist:${auth.user.id}:${itemId}:${getClientIp(req)}`, 90, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }

  const completed = typeof body === 'object' && body !== null && 'completed' in body ? Boolean(body.completed) : null
  if (completed === null) return badRequest()

  const project = await prisma.project.findUnique({
    where: { id },
    select: { managerId: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessProject(auth.user, project.managerId)) return forbidden()

  const item = await prisma.projectChecklistItem.findFirst({
    where: { id: itemId, projectId: id },
    select: { id: true, label: true },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.projectChecklistItem.update({
    where: { id: itemId },
    data: { completedAt: completed ? new Date() : null },
    select: { id: true, label: true, position: true, completedAt: true, createdAt: true, updatedAt: true },
  })

  await prisma.activityLog.create({
    data: {
      userId: auth.user.id,
      projectId: id,
      action: completed ? 'Checklist concluido' : 'Checklist reaberto',
      details: item.label,
    },
  })

  return NextResponse.json({
    ...updated,
    completedAt: updated.completedAt?.toISOString() || null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}
