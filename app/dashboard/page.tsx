import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { StatsCard } from '@/components/dashboard/stats-card'
import { LazyStatusChart } from '@/components/dashboard/lazy-status-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { ClientMapPanel } from '@/components/dashboard/client-map-panel'
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
  Wallet,
  Calculator,
} from 'lucide-react'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { businessDaysBetween } from '@/lib/business-days'
import { getAppAlerts, type AlertTone } from '@/lib/alerts'
import Link from 'next/link'

type DashboardUser = { id?: string; role?: string }

async function getDashboardData(user: DashboardUser) {
  const isAdmin = user.role === 'ADMIN'
  const projectScope = isAdmin ? {} : { managerId: user.id }
  const clientScope = isAdmin ? {} : { projects: { some: { managerId: user.id } } }
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const [
    totalClients,
    projectGroups,
    todayDeliveries,
    recentActivities,
    upcomingDeliveries,
    startReminderProjects,
    attentionItems,
  ] =
    await Promise.all([
      prisma.client.count({ where: clientScope }),
      prisma.project.groupBy({
        by: ['status', 'stage'],
        where: projectScope,
        _count: { _all: true },
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
      prisma.project.findMany({
        where: {
          ...projectScope,
          stage: 'PENDING_START',
          approvalDate: { not: null },
          productionStartReminderDate: { lte: today },
        },
        take: 6,
        orderBy: { productionStartReminderDate: 'asc' },
        include: {
          client: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
        },
      }),
      getAppAlerts(user),
    ])

  const activeProjects = projectGroups.reduce((total, group) => total + (group.stage !== 'COMPLETED' ? group._count._all : 0), 0)
  const inProduction = projectGroups.reduce((total, group) => total + (group.stage === 'PRODUCTION' ? group._count._all : 0), 0)
  const completed = projectGroups.reduce((total, group) => total + (group.stage === 'COMPLETED' ? group._count._all : 0), 0)
  const delayed = projectGroups.reduce((total, group) => total + (group.status === 'DELAYED' ? group._count._all : 0), 0)

  const statusCounts = projectGroups.reduce<Record<string, number>>((acc, group) => {
    acc[group.status] = (acc[group.status] || 0) + group._count._all
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
    attentionItems,
    recentActivities: recentActivities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    upcomingDeliveries: upcomingDeliveries.map((p) => ({
      ...p,
      approvalDate: p.approvalDate?.toISOString() || null,
      deliveryDeadlineDate: p.deliveryDeadlineDate?.toISOString() || null,
      productionStartReminderDate: p.productionStartReminderDate?.toISOString() || null,
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    startReminderProjects: startReminderProjects.map((p) => ({
      ...p,
      approvalDate: p.approvalDate?.toISOString() || null,
      deliveryDeadlineDate: p.deliveryDeadlineDate?.toISOString() || null,
      productionStartReminderDate: p.productionStartReminderDate?.toISOString() || null,
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
  const isAdmin = user?.role === 'ADMIN'
  const data = await getDashboardData(user || {})
  const nowTime = new Date().getTime()
  const quickAccessItems = [
    { href: '/dashboard/clients', icon: Users, label: 'Clientes', sub: `${data.totalClients} cadastrados`, color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/projects', icon: FolderOpen, label: 'Projetos', sub: `${data.activeProjects} ativos`, color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/production', icon: Package, label: 'Produção', sub: 'Kanban board', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/calendar', icon: Calendar, label: 'Calendário', sub: 'Agenda e prazos', color: 'bg-green-50 text-green-600' },
    ...(isAdmin
      ? [{ href: '/dashboard/financeiro', icon: Wallet, label: 'Financeiro', sub: 'Recebimentos', color: 'bg-emerald-50 text-emerald-600' }]
      : []),
  ]

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#121212]">Precisa de atenção</h2>
                <p className="text-xs text-[#9E9E9E]">Pendências principais para resolver primeiro</p>
              </div>
              <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-xs font-semibold text-[#6B7280]">
                {data.attentionItems.length} alerta{data.attentionItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {data.attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <CheckCircle size={18} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Tudo em dia</p>
                  <p className="text-xs text-emerald-700">Nenhuma pendência crítica encontrada agora.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.attentionItems.map((item) => {
                  const config = attentionToneConfig(item.tone)
                  const Icon = item.id.includes('quote') ? Calculator : item.id.includes('payment') ? Wallet : item.id.includes('delivery') ? Truck : AlertTriangle

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`group rounded-lg border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${config.card}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${config.icon}`}>
                          <Icon size={17} />
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.badge}`}>{item.count}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#121212] group-hover:text-[#FF6B00]">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6B7280]">{item.body}</p>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

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
              <LazyStatusChart data={data.statusDistribution} />
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

        {data.startReminderProjects.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#121212]">Projetos para começar</h2>
                  <p className="text-xs text-[#9E9E9E]">Aprovação passou de 7 dias úteis e ainda está aguardando início</p>
                </div>
                <Link href="/dashboard/production" className="text-xs text-[#FF6B00] hover:underline flex items-center gap-1">
                  Produção <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[#F5F5F5]">
                {data.startReminderProjects.map((project) => {
                  const approvedBusinessDays = businessDaysBetween(project.approvalDate, new Date())
                  const overdueBusinessDays = businessDaysBetween(project.productionStartReminderDate, new Date())

                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#121212] truncate">{project.name}</p>
                        <p className="mt-0.5 text-xs text-[#9E9E9E] truncate">{project.client.name}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-xs font-semibold text-orange-600">
                          {approvedBusinessDays ?? 0} dias úteis aprovado
                        </p>
                        <p className="text-[10px] text-[#9E9E9E]">
                          {overdueBusinessDays && overdueBusinessDays > 0 ? `${overdueBusinessDays} úteis após cobrança` : 'Começar agora'}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#121212]">Mapa de Clientes</h2>
                <p className="text-xs text-[#9E9E9E]">Abra quando precisar ver ruas, distâncias e rotas</p>
              </div>
              <span className="hidden text-xs text-[#9E9E9E] sm:inline">Carregado quando abrir</span>
            </div>
          </CardHeader>
          <CardBody>
            <ClientMapPanel />
          </CardBody>
        </Card>

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
                {quickAccessItems.map((item) => (
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

function attentionToneConfig(tone: AlertTone) {
  const tones = {
    danger: {
      card: 'border-red-100 bg-red-50/60 hover:border-red-200',
      icon: 'bg-white text-red-600',
      badge: 'bg-red-600 text-white',
    },
    warning: {
      card: 'border-orange-100 bg-orange-50/60 hover:border-orange-200',
      icon: 'bg-white text-[#FF6B00]',
      badge: 'bg-[#FF6B00] text-white',
    },
    info: {
      card: 'border-blue-100 bg-blue-50/60 hover:border-blue-200',
      icon: 'bg-white text-blue-600',
      badge: 'bg-blue-600 text-white',
    },
  }

  return tones[tone]
}
