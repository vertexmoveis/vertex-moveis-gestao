import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const updateUserSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
  active: z.boolean(),
  password: z.string().min(10).max(100).optional(),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const limited = await rateLimit(`api:settings:users:patch:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  const parsed = updateUserSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
  const current = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } })
  if (!current) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  if (id === auth.user.id && !parsed.data.active) return badRequest('Você não pode desativar o próprio acesso.')

  const removesActiveAdmin = current.role === 'ADMIN' && current.active && (!parsed.data.active || parsed.data.role !== 'ADMIN')
  if (removesActiveAdmin) {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', active: true } })
    if (activeAdmins <= 1) return badRequest('O sistema precisa manter pelo menos um administrador ativo.')
  }

  const email = parsed.data.email.toLowerCase()
  const duplicate = await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } })
  if (duplicate) return NextResponse.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 })

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      active: parsed.data.active,
      sessionVersion: { increment: 1 },
      ...(parsed.data.password
        ? { password: await bcrypt.hash(parsed.data.password, 12), passwordChangedAt: new Date() }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
  })
  await prisma.activityLog.create({
    data: { userId: auth.user.id, action: 'Acesso de usuário atualizado', details: `${user.name} (${user.role}) - ${user.active ? 'ativo' : 'inativo'}` },
  })
  return NextResponse.json({
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
  })
}
