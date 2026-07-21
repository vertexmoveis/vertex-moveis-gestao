import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const createUserSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(10).max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`api:settings:users:post:${auth.user.id}:${getClientIp(req)}`, 15, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
  const email = parsed.data.email.toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) return NextResponse.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 })

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      password: await bcrypt.hash(parsed.data.password, 12),
      passwordChangedAt: new Date(),
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
  })
  await prisma.activityLog.create({
    data: { userId: auth.user.id, action: 'Usuário criado', details: `${user.name} (${user.role})` },
  })
  return NextResponse.json({
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
  }, { status: 201 })
}
