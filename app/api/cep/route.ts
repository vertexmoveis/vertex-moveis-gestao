import { NextRequest, NextResponse } from 'next/server'
import { badRequest, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  cep?: string
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:cep:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const cep = new URL(req.url).searchParams.get('cep')?.replace(/\D/g, '').slice(0, 8)
  if (!cep || cep.length !== 8) return badRequest()

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
  })
  if (!response.ok) return serviceUnavailable()

  const data = (await response.json()) as ViaCepResponse
  if (data.erro) return NextResponse.json({ error: 'CEP not found' }, { status: 404 })

  return NextResponse.json({
    zipCode: data.cep || cep,
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
  })
}
