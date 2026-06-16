import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/security'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: auth.user.role === 'ADMIN', role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
