import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createHmac } from 'node:crypto'
import { prisma } from './db'
import { rateLimit, RateLimitUnavailableError } from './rate-limit'
import { verifyTwoFactorCode } from './two-factor'

const DUMMY_PASSWORD_HASH = '$2b$12$a.TBsPT3MHSpJq1fFNafPe0kZJjtjxg/LtDLueb8yIVXHDHt0RvVq'
const LOGIN_WINDOW_MS = 15 * 60 * 1000
let nextLoginEventCleanupAt = 0

function hashLoginIp(ip: string) {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET || 'vertex-login-audit')
    .update(ip)
    .digest('hex')
}

function loginEventRetentionDays() {
  const configured = Number.parseInt(process.env.LOGIN_EVENT_RETENTION_DAYS || '90', 10)
  if (!Number.isFinite(configured)) return 90
  return Math.min(Math.max(configured, 30), 365)
}

async function cleanOldLoginEvents(now = Date.now()) {
  if (nextLoginEventCleanupAt > now) return

  nextLoginEventCleanupAt = now + 24 * 60 * 60 * 1000
  const cutoff = new Date(now - loginEventRetentionDays() * 24 * 60 * 60 * 1000)
  await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {
    nextLoginEventCleanupAt = now + 60 * 60 * 1000
  })
}

async function recordLoginEvent(input: {
  userId?: string
  email: string
  success: boolean
  reason?: string
  ip: string
  userAgent?: string
}) {
  await prisma.loginEvent.create({
    data: {
      userId: input.userId,
      email: input.email.slice(0, 160),
      success: input.success,
      reason: input.reason,
      ipHash: hashLoginIp(input.ip),
      userAgent: input.userAgent?.slice(0, 500),
    },
  }).catch(() => undefined)
  await cleanOldLoginEvents()
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        otp: { label: 'Código do autenticador', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password
        if (email.length > 160 || password.length > 200) return null

        const ip =
          (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
          (req.headers?.['x-real-ip'] as string | undefined) ||
          'unknown'
        const userAgent = req.headers?.['user-agent'] as string | undefined
        try {
          const limited = await rateLimit(`login:ip:${ip}`, 20, LOGIN_WINDOW_MS)
          if (!limited.allowed) {
            return null
          }
        } catch (error) {
          if (error instanceof RateLimitUnavailableError) {
            return null
          }
          throw error
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
          await recordLoginEvent({
            email,
            success: false,
            reason: 'INVALID_CREDENTIALS',
            ip,
            userAgent,
          })
          return null
        }

        try {
          const limited = await rateLimit(`login:user:${user.id}`, 5, LOGIN_WINDOW_MS)
          if (!limited.allowed) return null
        } catch (error) {
          if (error instanceof RateLimitUnavailableError) return null
          throw error
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid || !user.active) {
          await recordLoginEvent({ userId: user.id, email, success: false, reason: 'INVALID_CREDENTIALS', ip, userAgent })
          return null
        }

        if (user.twoFactorEnabled) {
          const otpValid = Boolean(
            user.twoFactorSecret &&
            credentials.otp &&
            await verifyTwoFactorCode(user.twoFactorSecret, credentials.otp),
          )
          if (!otpValid) {
            await recordLoginEvent({
              userId: user.id,
              email,
              success: false,
              reason: credentials.otp ? 'INVALID_OTP' : 'OTP_REQUIRED',
              ip,
              userAgent,
            })
            return null
          }
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        await recordLoginEvent({ userId: user.id, email, success: true, reason: 'LOGIN_SUCCESS', ip, userAgent })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sessionVersion: user.sessionVersion,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion || 1
        token.invalid = false
      } else if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true, name: true, email: true, role: true, active: true, sessionVersion: true },
        })
        if (!current || !current.active || current.sessionVersion !== Number(token.sessionVersion || 1)) {
          token.invalid = true
          token.id = undefined
          token.role = undefined
        } else {
          token.name = current.name
          token.email = current.email
          token.role = current.role
          token.invalid = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && !token.invalid && token.id) {
        (session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
      }
      if (token.invalid || !token.id) session.user = undefined
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
