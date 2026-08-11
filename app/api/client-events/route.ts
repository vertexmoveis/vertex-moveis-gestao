import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { recordSystemEvent } from '@/lib/system-events'

const eventSchema = z.object({
  type: z.enum(['CLIENT_ERROR', 'PERFORMANCE_WARNING']),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(300).regex(/^\//),
  metric: z.object({
    name: z.string().trim().max(30),
    value: z.number().finite(),
    rating: z.string().trim().max(30).optional(),
  }).strict().optional(),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`client-events:${auth.user.id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações.' }, { status: 429 })
  const parsed = eventSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })

  await recordSystemEvent({
    type: parsed.data.type,
    severity: parsed.data.type === 'CLIENT_ERROR' ? 'ERROR' : 'WARNING',
    source: 'dashboard-browser',
    message: parsed.data.message,
    details: {
      path: parsed.data.path,
      userId: auth.user.id,
      ...(parsed.data.metric ? { metric: parsed.data.metric } : {}),
    },
  })
  return new NextResponse(null, { status: 204 })
}
