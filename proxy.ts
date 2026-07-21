import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const { pathname } = request.nextUrl

  const validToken = token && !token.invalid
  const isApiMutation = pathname.startsWith('/api/')
    && !pathname.startsWith('/api/auth/')
    && !pathname.startsWith('/api/public/')
    && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)

  if (isApiMutation && validToken && token.role === 'VIEWER') {
    return NextResponse.json(
      { error: 'O perfil de consulta não pode alterar dados.' },
      { status: 403 },
    )
  }

  if (pathname.startsWith('/dashboard') && !validToken) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login' && validToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/:path*'],
}
