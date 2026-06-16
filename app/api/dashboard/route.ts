import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from '@/types'
import { requireAuth } from '@/lib/security'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const projectScope = auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }

  const [
    totalClients,
    allProjects,
    todayDeliveries,
    recentActivities,
    upcomingDeliveries,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.findMany({
      where: projectScope,
      select: { status: true, stage: true },
    }),
    prisma.project.count({
      where: {
        ...projectScope,
        estimatedEndDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        stage: { not: 'COMPLETED' },
      },
    }),
    prisma.activityLog.findMany({
      take: 7,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        project: {
          select: {
            name: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        ...projectScope,
        estimatedEndDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 86400000),
        },
        stage: { not: 'COMPLETED' },
      },
      take: 5,
      orderBy: { estimatedEndDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, phone: auth.user.role === 'ADMIN', whatsapp: auth.user.role === 'ADMIN' } },
        manager: { select: { id: true, name: true } },
      },
    }),
  ])

  const activeProjects = allProjects.filter((p) => p.stage !== 'COMPLETED').length
  const inProduction = allProjects.filter((p) =>
    ['CUTTING', 'MANUFACTURING', 'FINISHING', 'QUALITY_CONTROL'].includes(p.stage)
  ).length
  const completed = allProjects.filter((p) => p.stage === 'COMPLETED').length
  const delayed = allProjects.filter((p) => p.status === 'DELAYED').length

  const statusCounts = allProjects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
    status: status as ProjectStatus,
    count,
    label: PROJECT_STATUS_LABELS[status as ProjectStatus],
    color: PROJECT_STATUS_COLORS[status as ProjectStatus],
  }))

  return NextResponse.json({
    totalClients,
    activeProjects,
    inProduction,
    completed,
    delayed,
    todayDeliveries,
    statusDistribution,
    recentActivities: recentActivities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    upcomingDeliveries: upcomingDeliveries.map((p) => ({
      ...p,
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  })
}
