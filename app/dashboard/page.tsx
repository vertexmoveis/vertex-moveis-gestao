import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { StatsCard } from '@/components/dashboard/stats-card'
import { StatusChart } from '@/components/dashboard/status-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import {
  Users,
  FolderOpen,
  Package,
  CheckCircle,
  AlertTriangle,
  Truck,
  Calendar,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

type DashboardUser = { id?: string; role?: string }

async function getDashboardData(user: DashboardUser) {
  const isAdmin = user.role === 'ADMIN'
  const projectScope = isAdmin ? {} : { managerId: user.id }
  const clientScope = isAdmin ? {} : { projects: { some: { managerId: user.id } } }

  const [totalClients, allProjects, todayDeliveries, recentActivities, upcomingDeliveries] =
    await Promise.all([
      prisma.client.count({ where: clientScope }),
      prisma.project.findMany({ where: projectScope, select: { status: true, stage: true } }),
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
        where: isAdmin ? undefined : { project: { managerId: user.id } },
        take: 7,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true } },
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      }),
      prisma.project.findMany({
        where: {
          ...projectScope,
          estimatedEndDate: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
          stage: { not: 'COMPLETED' },
        },
        take: 6,
        orderBy: { estimatedEndDate: 'asc' },
        include: {
          client: { select: { id: true, name: true, phone: true, whatsapp: true } },
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

  return {
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
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as DashboardUser | undefined
  const data = await getDashboardData(user || {})
  const nowTime = new Date().getTime()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = session?.user?.name?.split(' ')[0] || 'usuário'

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${greeting}, ${firstName}!`}
        subtitle={`${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        userName={session?.user?.name || ''}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard title="Clientes" value={data.totalClients} icon={Users} color="blue" delay={0} />
          <StatsCard title="Projetos Ativos" value={data.activeProjects} icon={FolderOpen} color="orange" delay={50} />
          <StatsCard title="Em Produção" value={data.inProduction} icon={Package} color="purple" delay={100} />
          <StatsCard title="Concluídos" value={data.completed} icon={CheckCircle} color="green" delay={150} />
          <StatsCard title="Atrasados" value={data.delayed} icon={AlertTriangle} color="red" delay={200} />
          <StatsCard title="Entregas Hoje" value={data.todayDeliveries} icon={Truck} color="cyan" delay={250} />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Chart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#121212]">Distribuição por Status</h2>
                <span className="text-xs text-[#9E9E9E]">{allProjectsCount(data.statusDistribution)} projetos</span>
              </div>
            </CardHeader>
            <CardBody>
              <StatusChart data={data.statusDistribution} />
            </CardBody>
          </Card>

          {/* Upcoming Deliveries */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#121212]">Próximas Entregas</h2>
                <Link href="/dashboard/projects" className="text-xs text-[#FF6B00] hover:underline flex items-center gap-1">
                  Ver todos <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {data.upcomingDeliveries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[#9E9E9E]">
                  <Calendar size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma entrega nos próximos 14 dias</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F5F5F5]">
                  {data.upcomingDeliveries.map((project) => {
                    const daysLeft = project.estimatedEndDate
                      ? Math.ceil((new Date(project.estimatedEndDate).getTime() - nowTime) / 86400000)
                      : null
                    const isUrgent = daysLeft !== null && daysLeft <= 3

                    return (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#121212] truncate">{project.name}</p>
                            <StatusBadge status={project.status as ProjectStatus} />
                          </div>
                          <p className="text-xs text-[#9E9E9E] mt-0.5 truncate">{project.client.name}</p>
                        </div>
                        <div className="flex flex-col items-end ml-4 flex-shrink-0">
                          {project.estimatedEndDate && (
                            <p className={`text-xs font-medium ${isUrgent ? 'text-red-500' : 'text-[#9E9E9E]'}`}>
                              {formatDate(project.estimatedEndDate)}
                            </p>
                          )}
                          {daysLeft !== null && (
                            <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${isUrgent ? 'text-red-500 font-semibold' : 'text-[#BDBDBD]'}`}>
                              <Clock size={10} />
                              {daysLeft === 0 ? 'Hoje!' : daysLeft === 1 ? 'Amanhã' : `${daysLeft} dias`}
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#121212]">Atividade Recente</h2>
              </div>
            </CardHeader>
            <CardBody>
              <ActivityFeed activities={data.recentActivities} />
            </CardBody>
          </Card>

          {/* Quick Access */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[#121212]">Acesso Rápido</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/dashboard/clients', icon: Users, label: 'Clientes', sub: `${data.totalClients} cadastrados`, color: 'bg-blue-50 text-blue-600' },
                  { href: '/dashboard/projects', icon: FolderOpen, label: 'Projetos', sub: `${data.activeProjects} ativos`, color: 'bg-orange-50 text-orange-600' },
                  { href: '/dashboard/production', icon: Package, label: 'Produção', sub: 'Kanban board', color: 'bg-purple-50 text-purple-600' },
                  { href: '/dashboard/calendar', icon: Calendar, label: 'Calendário', sub: 'Agenda e prazos', color: 'bg-green-50 text-green-600' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col gap-3 p-4 rounded-xl border border-[#E8E8E8] hover:border-[#FF6B00]/30 hover:bg-orange-50/30 transition-all duration-150"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}>
                      <item.icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#121212] group-hover:text-[#FF6B00] transition-colors">{item.label}</p>
                      <p className="text-xs text-[#9E9E9E]">{item.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function allProjectsCount(distribution: { count: number }[]) {
  return distribution.reduce((sum, d) => sum + d.count, 0)
}
