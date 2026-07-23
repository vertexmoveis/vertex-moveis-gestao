import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createTwoFactorSetup, verifyTwoFactorCode } from '@/lib/two-factor'
import { badRequest, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), password: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal('enable'), code: z.string().min(6).max(12) }).strict(),
  z.object({ action: z.literal('disable'), password: z.string().min(1).max(100), code: z.string().min(6).max(12) }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
])

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const [user, loginEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    }),
    prisma.loginEvent.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, success: true, reason: true, userAgent: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    enabled: user?.twoFactorEnabled === true,
    setupPending: user?.twoFactorEnabled !== true && Boolean(user?.twoFactorSecret),
    loginEvents: loginEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:settings:two-factor:${auth.user.id}:${getClientIp(req)}`, 12, 15 * 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })

  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Dados inválidos.')

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, email: true, password: true, twoFactorEnabled: true, twoFactorSecret: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  if (parsed.data.action === 'start') {
    if (user.twoFactorEnabled) return badRequest('A autenticação em dois fatores já está ativa.')
    if (!await bcrypt.compare(parsed.data.password, user.password)) return badRequest('Senha incorreta.')

    const setup = createTwoFactorSetup(user.email)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: setup.encryptedSecret, twoFactorEnabled: false },
    })
    const qrCode = await QRCode.toDataURL(setup.uri, { width: 220, margin: 1 })
    return NextResponse.json({ secret: setup.secret, qrCode })
  }

  if (parsed.data.action === 'enable') {
    if (!user.twoFactorSecret) return badRequest('Inicie a configuração antes de confirmar o código.')
    if (!await verifyTwoFactorCode(user.twoFactorSecret, parsed.data.code)) return badRequest('Código inválido ou expirado.')
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } })
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'Autenticação em dois fatores ativada' },
    })
    return NextResponse.json({ success: true, enabled: true })
  }

  if (parsed.data.action === 'disable') {
    if (!await bcrypt.compare(parsed.data.password, user.password)) return badRequest('Senha incorreta.')
    if (!user.twoFactorSecret || !await verifyTwoFactorCode(user.twoFactorSecret, parsed.data.code)) {
      return badRequest('Código inválido ou expirado.')
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, sessionVersion: { increment: 1 } },
    })
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'Autenticação em dois fatores desativada' },
    })
    return NextResponse.json({ success: true, enabled: false, sessionInvalidated: true })
  }

  if (!user.twoFactorEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: null } })
  }
  return NextResponse.json({ success: true })
}
