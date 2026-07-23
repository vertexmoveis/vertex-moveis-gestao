import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/security'

export async function GET() {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const [clients, projects, quotes] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        archivedAt: true,
        _count: { select: { projects: true, quotes: true } },
      },
    }),
    prisma.project.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        archivedAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.quote.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        archivedAt: true,
        client: { select: { name: true } },
      },
    }),
  ])

  const items = [
    ...clients.map((client) => ({
      id: client.id,
      type: 'client' as const,
      name: client.name,
      subtitle: `${client._count.projects} projeto(s) e ${client._count.quotes} orçamento(s)`,
      archivedAt: client.archivedAt!.toISOString(),
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: 'project' as const,
      name: project.name,
      subtitle: `Cliente: ${project.client.name}`,
      archivedAt: project.archivedAt!.toISOString(),
    })),
    ...quotes.map((quote) => ({
      id: quote.id,
      type: 'quote' as const,
      name: quote.title,
      subtitle: `Cliente: ${quote.client.name}`,
      archivedAt: quote.archivedAt!.toISOString(),
    })),
  ].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))

  return NextResponse.json({ items })
}
