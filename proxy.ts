import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  let token: Awaited<ReturnType<typeof getToken>> = null
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  } catch {
    token = null
  }

  const { pathname } = request.nextUrl

  const validToken = Boolean(
    token
    && !token.invalid
    && typeof token.id === 'string'
    && token.id.length > 0,
  )
  const isApiMutation = pathname.startsWith('/api/')
    && !pathname.startsWith('/api/auth/')
    && !pathname.startsWith('/api/public/')
    && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)

  if (isApiMutation && validToken && token?.role === 'VIEWER') {
    return NextResponse.json(
      { error: 'O perfil de consulta não pode alterar dados.' },
      { status: 403 },
    )
  }

  if (pathname.startsWith('/dashboard') && !validToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('motivo', 'sessao-expirada')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
