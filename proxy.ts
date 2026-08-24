import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { randomUUID } from 'node:crypto'

function contentSecurityPolicy(nonce: string, allowSameOriginFraming = false) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${allowSameOriginFraming ? "'self'" : "'none'"}`,
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "worker-src 'self' blob:",
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com${isDevelopment ? ' ws: http:' : ''}`,
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

function withContentSecurityPolicy(response: NextResponse, policy: string) {
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString('base64')
  const { pathname } = request.nextUrl
  const allowSameOriginFraming = (
    /^\/api\/public\/quote-approvals\/[^/]+\/document$/.test(pathname)
    || /^\/api\/projects\/[^/]+\/files\/[^/]+$/.test(pathname)
  )
  const policy = contentSecurityPolicy(nonce, allowSameOriginFraming)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  let token: Awaited<ReturnType<typeof getToken>> = null
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  } catch {
    token = null
  }

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
    return withContentSecurityPolicy(NextResponse.json(
      { error: 'O perfil de consulta não pode alterar dados.' },
      { status: 403 },
    ), policy)
  }

  if (pathname.startsWith('/dashboard') && !validToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('motivo', 'sessao-expirada')
    return withContentSecurityPolicy(NextResponse.redirect(loginUrl), policy)
  }

  return withContentSecurityPolicy(NextResponse.next({
    request: { headers: requestHeaders },
  }), policy)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
