import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { noteCreateSchema } from '@/lib/schemas'
import { badRequest, canAccessProject, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:notes:post:${auth.user.id}:${id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = noteCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const project = await prisma.project.findUnique({ where: { id }, select: { managerId: true } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessProject(auth.user, project.managerId)) return forbidden()

    const note = await prisma.note.create({
      data: {
        projectId: id,
        authorId: auth.user.id,
        content: parsed.data.content,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ ...note, createdAt: note.createdAt.toISOString() })
  } catch {
    return serverError()
  }
}
