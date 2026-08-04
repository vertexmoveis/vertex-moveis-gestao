import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { isIP } from 'node:net'
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
    return { ok: false, response: NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 }) }
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
    return { ok: false, response: NextResponse.json({ error: 'Você não tem permissão para realizar esta ação.' }, { status: 403 }) }
  }

  return auth
}

export function forbidden() {
  return NextResponse.json({ error: 'Você não tem permissão para realizar esta ação.' }, { status: 403 })
}

export function badRequest(message = 'Confira os dados enviados e tente novamente.') {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function serverError() {
  return NextResponse.json({ error: 'Ocorreu um erro interno. Tente novamente em alguns instantes.' }, { status: 500 })
}

export function serviceUnavailable() {
  return NextResponse.json({ error: 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.' }, { status: 503 })
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = (
    forwardedFor ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  ).trim().slice(0, 64)

  if (isIP(candidate)) return candidate
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)?.[1]
  return ipv4WithPort && isIP(ipv4WithPort) ? ipv4WithPort : 'unknown'
}

export function canAccessProject(user: AuthenticatedUser, managerId: string | null) {
  return user.role === 'ADMIN' || managerId === user.id
}
