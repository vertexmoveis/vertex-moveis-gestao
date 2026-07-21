import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { rateLimit, RateLimitUnavailableError } from './rate-limit'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const ip =
          (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
          (req.headers?.['x-real-ip'] as string | undefined) ||
          'unknown'
        try {
          const limited = await rateLimit(`login:${ip}:${email}`, 5, 15 * 60 * 1000)
          if (!limited.allowed) return null
        } catch (error) {
          if (error instanceof RateLimitUnavailableError) return null
          throw error
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.active) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

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
