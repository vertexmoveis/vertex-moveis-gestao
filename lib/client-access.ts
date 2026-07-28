import type { Prisma } from '@prisma/client'
import type { AuthenticatedUser } from '@/lib/security'

export function clientAccessScope(user: Pick<AuthenticatedUser, 'id' | 'role'>): Prisma.ClientWhereInput {
  if (user.role === 'ADMIN') return {}

  return {
    OR: [
      { managerId: user.id },
      { projects: { some: { managerId: user.id, archivedAt: null } } },
      { quotes: { some: { createdById: user.id, archivedAt: null } } },
    ],
  }
}

export function clientWhereForUser(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  where: Prisma.ClientWhereInput = {},
): Prisma.ClientWhereInput {
  return {
    AND: [
      { archivedAt: null },
      clientAccessScope(user),
      where,
    ],
  }
}
