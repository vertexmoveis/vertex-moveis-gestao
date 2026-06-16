import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from './auth'
import type { Role } from '@/types'

export type AuthenticatedUser = {
  id: string
  name?: string | null
  email?: string | null
  role: Role
}

export type AuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  const user = session?.user as Partial<AuthenticatedUser> | undefined

  if (!user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'MANAGER',
    },
  }
}

export async function requireRole(roles: Role[]): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  if (!roles.includes(auth.user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return auth
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function badRequest(message = 'Invalid payload') {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function serverError() {
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export function serviceUnavailable() {
  return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    forwardedFor ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export function canAccessProject(user: AuthenticatedUser, managerId: string | null) {
  return user.role === 'ADMIN' || managerId === user.id
}
