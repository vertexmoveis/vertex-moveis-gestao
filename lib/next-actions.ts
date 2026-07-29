import { prisma } from '@/lib/db'
import { ACTIVE_INSTALLATION_SCHEDULE_STATUSES } from '@/lib/installation-schedule'
import { unstable_cache } from 'next/cache'
import { dateOnlyKeyInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'

export type NextActionKind = 'client' | 'quote' | 'production' | 'delivery' | 'installation' | 'purchase' | 'post_sale'

export type DashboardNextAction = {
  id: string
  kind: NextActionKind
  title: string
  detail: string
  href: string
  dueAt: string
  priority: number
}

type NextActionUser = { id?: string | null; role?: string | null }

function startOfDay(date = new Date()) {
  return startOfDateInTimeZone(dateOnlyKeyInTimeZone(date)) || new Date(date)
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function monthKey(date: Date) {
  return dateOnlyKeyInTimeZone(date).slice(0, 7)
}

async function getDashboardNextActionsUncached(user: NextActionUser, limit = 8): Promise<DashboardNextAction[]> {
  const isAdmin = user.role === 'ADMIN'
  const projectScope = { archivedAt: null, ...(isAdmin ? {} : { managerId: user.id || '__sem_usuario__' }) }
  const quoteScope = { archivedAt: null, ...(isAdmin ? {} : { createdById: user.id || '__sem_usuario__' }) }
  const clientScope = {
    archivedAt: null,
    ...(isAdmin
      ? {}
      : {
        OR: [
          { managerId: user.id || '__sem_usuario__' },
          { projects: { some: { managerId: user.id || '__sem_usuario__', archivedAt: null } } },
          { quotes: { some: { createdById: user.id || '__sem_usuario__', archivedAt: null } } },
        ],
      }),
  }
  const today = startOfDay()
  const nextWeek = addDays(today, 7)
  const profile = await prisma.companyProfile.findUnique({
    where: { id: COMPANY_PROFILE_ID },
    select: {
      quoteReminderDays: true,
      leadNoResponseDays: true,
      leadCloseSuggestionDays: true,
    },
  })
  const quoteReminderDays = profile?.quoteReminderDays ?? DEFAULT_COMPANY_PROFILE.quoteReminderDays
  const noResponseDays = profile?.leadNoResponseDays ?? DEFAULT_COMPANY_PROFILE.leadNoResponseDays
  const closeSuggestionDays = profile?.leadCloseSuggestionDays ?? DEFAULT_COMPANY_PROFILE.leadCloseSuggestionDays
  const reminderCutoff = addDays(today, -quoteReminderDays)
  const noResponseCutoff = addDays(today, -noResponseDays)
  const closeCutoff = addDays(today, -closeSuggestionDays)

  const [staleClients, quoteFollowUps, projectsToStart, deliveries, installations, materials, postSales] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...clientScope,
        relationshipStage: { in: ['CONTACT', 'NEGOTIATING'] },
        lastCommercialActivityAt: { lte: noResponseCutoff },
      },
      select: {
        id: true,
        name: true,
        lastCommercialActivityAt: true,
        quotes: {
          where: { archivedAt: null, ...(isAdmin ? {} : { createdById: user.id || '__sem_usuario__' }) },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, title: true },
        },
      },
      orderBy: { lastCommercialActivityAt: 'asc' },
      take: 4,
    }),
    prisma.quote.findMany({
      where: {
        ...quoteScope,
        status: 'WAITING_APPROVAL',
        approvalRequests: {
          some: {
            approvedAt: null,
            rejectedAt: null,
            sentAt: { lte: reminderCutoff },
            OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
          },
        },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        client: { select: { name: true } },
        approvalRequests: {
          where: { approvedAt: null, rejectedAt: null },
          orderBy: { sentAt: 'asc' },
          take: 1,
          select: { sentAt: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 4,
    }),
    prisma.project.findMany({
      where: {
        ...projectScope,
        stage: 'PENDING_START',
        approvalDate: { not: null },
        productionStartReminderDate: { lte: today },
      },
      select: { id: true, name: true, productionStartReminderDate: true, client: { select: { name: true } } },
      orderBy: { productionStartReminderDate: 'asc' },
      take: 4,
    }),
    prisma.project.findMany({
      where: {
        ...projectScope,
        stage: { not: 'COMPLETED' },
        deliveryDeadlineDate: { gte: today, lte: nextWeek },
      },
      select: { id: true, name: true, deliveryDeadlineDate: true, client: { select: { name: true } } },
      orderBy: { deliveryDeadlineDate: 'asc' },
      take: 4,
    }),
    prisma.installationSchedule.findMany({
      where: {
        status: { in: ACTIVE_INSTALLATION_SCHEDULE_STATUSES },
        scheduledStart: { gte: today, lte: nextWeek },
        project: projectScope,
      },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 4,
    }),
    isAdmin
      ? prisma.projectMaterial.findMany({
          where: {
            status: { in: ['PENDING', 'ORDERED'] },
            project: { archivedAt: null, stage: { not: 'COMPLETED' } },
          },
          select: {
            id: true,
            materialName: true,
            status: true,
            updatedAt: true,
            project: { select: { id: true, name: true, client: { select: { name: true } } } },
          },
          orderBy: { updatedAt: 'asc' },
          take: 4,
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: {
        ...projectScope,
        stage: 'COMPLETED',
        postSaleFollowUpAt: { lte: today },
        postSaleContactedAt: null,
      },
      select: { id: true, name: true, postSaleFollowUpAt: true, client: { select: { name: true } } },
      orderBy: { postSaleFollowUpAt: 'asc' },
      take: 4,
    }),
  ])

  const actions: DashboardNextAction[] = [
    ...staleClients.map((client) => {
      const shouldClose = Boolean(
        client.lastCommercialActivityAt
        && client.lastCommercialActivityAt.getTime() <= closeCutoff.getTime(),
      )
      return {
        id: `client-${client.id}`,
        kind: 'client' as const,
        title: shouldClose ? 'Revisar negociação antiga' : 'Retomar contato',
        detail: `${client.name}${client.quotes[0] ? ` · ${client.quotes[0].title}` : ''}`,
        href: client.quotes[0]
          ? `/dashboard/quotes/${client.quotes[0].id}`
          : `/dashboard/clients/${client.id}`,
        dueAt: client.lastCommercialActivityAt?.toISOString() || today.toISOString(),
        priority: shouldClose ? 0 : 1,
      }
    }),
    ...quoteFollowUps.map((quote) => ({
      id: `quote-${quote.id}`,
      kind: 'quote' as const,
      title: 'Pedir retorno do orçamento',
      detail: `${quote.client.name} · ${quote.title}`,
      href: `/dashboard/quotes/${quote.id}`,
      dueAt: (quote.approvalRequests[0]?.sentAt || quote.updatedAt).toISOString(),
      priority: 0,
    })),
    ...projectsToStart.map((project) => ({
      id: `production-${project.id}`,
      kind: 'production' as const,
      title: 'Iniciar produção',
      detail: `${project.client.name} · ${project.name}`,
      href: `/dashboard/projects/${project.id}`,
      dueAt: project.productionStartReminderDate?.toISOString() || today.toISOString(),
      priority: 1,
    })),
    ...deliveries.map((project) => ({
      id: `delivery-${project.id}`,
      kind: 'delivery' as const,
      title: 'Revisar prazo de entrega',
      detail: `${project.client.name} · ${project.name}`,
      href: `/dashboard/projects/${project.id}`,
      dueAt: project.deliveryDeadlineDate?.toISOString() || today.toISOString(),
      priority: 2,
    })),
    ...installations.map((schedule) => ({
      id: `installation-${schedule.id}`,
      kind: 'installation' as const,
      title: schedule.status === 'SCHEDULED' ? 'Confirmar instalação' : schedule.status === 'CONFIRMED' ? 'Preparar saída da equipe' : 'Acompanhar instalação',
      detail: `${schedule.project.client.name} · ${schedule.project.name}`,
      href: `/dashboard/calendar?month=${monthKey(schedule.scheduledStart)}`,
      dueAt: schedule.scheduledStart.toISOString(),
      priority: 2,
    })),
    ...materials.map((material) => ({
      id: `purchase-${material.id}`,
      kind: 'purchase' as const,
      title: material.status === 'ORDERED' ? 'Confirmar recebimento do material' : 'Comprar material',
      detail: `${material.project.name} · ${material.materialName}`,
      href: '/dashboard/purchases',
      dueAt: material.updatedAt.toISOString(),
      priority: 3,
    })),
    ...postSales.map((project) => ({
      id: `post-sale-${project.id}`,
      kind: 'post_sale' as const,
      title: 'Fazer pós-venda',
      detail: `${project.client.name} · ${project.name}`,
      href: `/dashboard/projects/${project.id}#pos-venda`,
      dueAt: project.postSaleFollowUpAt?.toISOString() || today.toISOString(),
      priority: 4,
    })),
  ]

  return actions
    .sort((a, b) => a.priority - b.priority || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, limit)
}

const getCachedDashboardNextActions = unstable_cache(
  async (id: string, role: string, limit: number) => getDashboardNextActionsUncached({ id, role }, limit),
  ['dashboard-next-actions-v3'],
  { revalidate: 30 },
)

export function getDashboardNextActions(user: NextActionUser, limit = 8): Promise<DashboardNextAction[]> {
  return getCachedDashboardNextActions(
    user.id || '__sem_usuario__',
    user.role || 'MANAGER',
    Math.max(limit, 1),
  )
}
