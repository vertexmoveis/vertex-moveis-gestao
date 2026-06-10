import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content } = await req.json()

  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 400 })

  const note = await prisma.note.create({
    data: {
      projectId: id,
      authorId: userId,
      content,
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ ...note, createdAt: note.createdAt.toISOString() })
}
