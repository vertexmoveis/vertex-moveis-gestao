import { prisma } from '@/lib/db'
import { addBusinessDays } from '@/lib/business-days'
import { unstable_cache } from 'next/cache'
import { dateOnlyKeyInTimeZone, endOfDateInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'

export type AlertTone = 'danger' | 'warning' | 'info'

export type AppAlert = {
  id: string
  title: string
  body: string
  href: string
  count: number
  tone: AlertTone
}

type AlertUser = {
  id?: string | null
  role?: string | null
}

function plural(value: number, singular: string, pluralLabel: string) {
  return value === 1 ? singular : pluralLabel
}

function startOfDay(date = new Date()) {
  return startOfDateInTimeZone(dateOnlyKeyInTimeZone(date)) || new Date(date)
}

function endOfDay(date = new Date()) {
  return endOfDateInTimeZone(dateOnlyKeyInTimeZone(date)) || new Date(date)
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

async function getAppAlertsUncached(user: AlertUser): Promise<AppAlert[]> {
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
  const todayStart = startOfDay()
  const todayEnd = endOfDay()
  const nextWeek = addDays(todayStart, 7)
  const nextSevenBusinessDays = addBusinessDays(todayStart, 7) || nextWeek
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

  const [
    overduePayments,
    dueSoonPayments,
    delayedProjects,
    startReminders,
    deliverySoon,
    quotesWaitingApproval,
    approvalFollowUpDue,
    expiredQuotes,
    negotiationsWithoutResponse,
    negotiationsToClose,
    postSaleDue,
    openWarrantyTickets,
    answeredChanges,
    lowSatisfaction,
  ] = await Promise.all([
    isAdmin
      ? prisma.projectPayment.count({
          where: { paidAt: null, dueDate: { lt: todayStart }, project: { archivedAt: null } },
        })
      : Promise.resolve(0),
    isAdmin
      ? prisma.projectPayment.count({
          where: { paidAt: null, dueDate: { gte: todayStart, lte: nextWeek }, project: { archivedAt: null } },
        })
      : Promise.resolve(0),
    prisma.project.count({
      where: {
        ...projectScope,
        status: 'DELAYED',
      },
    }),
    prisma.project.count({
      where: {
        ...projectScope,
        stage: 'PENDING_START',
        approvalDate: { not: null },
        productionStartReminderDate: { lte: todayEnd },
      },
    }),
    prisma.project.count({
      where: {
        ...projectScope,
        stage: { not: 'COMPLETED' },
        deliveryDeadlineDate: { gte: todayStart, lte: nextSevenBusinessDays },
      },
    }),
    prisma.quote.count({
      where: {
        ...quoteScope,
        status: { in: ['SENT', 'WAITING_APPROVAL'] },
      },
    }),
    prisma.quote.count({
      where: {
        ...quoteScope,
        status: 'WAITING_APPROVAL',
        approvalRequests: {
          some: {
            approvedAt: null,
            rejectedAt: null,
            sentAt: { lte: addDays(todayStart, -quoteReminderDays) },
            OR: [{ expiresAt: null }, { expiresAt: { gte: todayStart } }],
          },
        },
      },
    }),
    prisma.quote.count({
      where: {
        ...quoteScope,
        status: { in: ['DRAFT', 'SENT', 'WAITING_APPROVAL', 'APPROVED'] },
        validUntil: { lt: todayStart },
      },
    }),
    prisma.client.count({
      where: {
        ...clientScope,
        relationshipStage: { in: ['CONTACT', 'NEGOTIATING'] },
        lastCommercialActivityAt: {
          lte: addDays(todayStart, -noResponseDays),
          gt: addDays(todayStart, -closeSuggestionDays),
        },
      },
    }),
    prisma.client.count({
      where: {
        ...clientScope,
        relationshipStage: { in: ['CONTACT', 'NEGOTIATING'] },
        lastCommercialActivityAt: { lte: addDays(todayStart, -closeSuggestionDays) },
      },
    }),
    prisma.project.count({
      where: {
        ...projectScope,
        stage: 'COMPLETED',
        postSaleFollowUpAt: { lte: todayEnd },
        postSaleContactedAt: null,
      },
    }),
    prisma.warrantyTicket.count({
      where: {
        status: { notIn: ['RESOLVED', 'CANCELED'] },
        project: projectScope,
      },
    }),
    prisma.projectChangeOrder.count({
      where: { status: { in: ['CLIENT_APPROVED', 'CLIENT_REJECTED'] }, project: projectScope },
    }),
    prisma.project.count({
      where: { ...projectScope, satisfactionRating: { lte: 2 } },
    }),
  ])

  return ([
    {
      id: 'overdue-payments',
      title: 'Parcelas atrasadas',
      body: `${overduePayments} ${plural(overduePayments, 'lançamento vencido', 'lançamentos vencidos')} em aberto.`,
      href: '/dashboard/financeiro?status=ATRASADO',
      count: overduePayments,
      tone: 'danger',
    },
    {
      id: 'due-soon-payments',
      title: 'Recebimentos próximos',
      body: `${dueSoonPayments} ${plural(dueSoonPayments, 'parcela vence', 'parcelas vencem')} nos próximos 7 dias.`,
      href: '/dashboard/financeiro?status=PENDENTE',
      count: dueSoonPayments,
      tone: 'warning',
    },
    {
      id: 'delayed-projects',
      title: 'Projetos atrasados',
      body: `${delayedProjects} ${plural(delayedProjects, 'projeto precisa', 'projetos precisam')} de revisão.`,
      href: '/dashboard/projects?status=DELAYED',
      count: delayedProjects,
      tone: 'danger',
    },
    {
      id: 'start-reminders',
      title: 'Começar produção',
      body: `${startReminders} ${plural(startReminders, 'projeto aprovado passou', 'projetos aprovados passaram')} de 7 dias úteis sem iniciar.`,
      href: '/dashboard/production',
      count: startReminders,
      tone: 'warning',
    },
    {
      id: 'delivery-soon',
      title: 'Entregas próximas',
      body: `${deliverySoon} ${plural(deliverySoon, 'projeto está', 'projetos estão')} dentro da janela de 7 dias úteis.`,
      href: '/dashboard/calendar',
      count: deliverySoon,
      tone: 'info',
    },
    {
      id: 'quotes-waiting',
      title: 'Orçamentos aguardando aprovação',
      body: `${quotesWaitingApproval} ${plural(quotesWaitingApproval, 'orçamento precisa', 'orçamentos precisam')} de retorno do cliente.`,
      href: '/dashboard/quotes?status=WAITING_APPROVAL',
      count: quotesWaitingApproval,
      tone: 'warning',
    },
    {
      id: 'approval-follow-up',
      title: 'Lembretes de aprovação',
      body: `${approvalFollowUpDue} ${plural(approvalFollowUpDue, 'orçamento está', 'orçamentos estão')} há mais de ${quoteReminderDays} dias sem resposta.`,
      href: '/dashboard/quotes?status=WAITING_APPROVAL',
      count: approvalFollowUpDue,
      tone: 'warning',
    },
    {
      id: 'expired-quotes',
      title: 'Orçamentos vencidos',
      body: `${expiredQuotes} ${plural(expiredQuotes, 'orçamento passou', 'orçamentos passaram')} da validade.`,
      href: '/dashboard/quotes?expired=1',
      count: expiredQuotes,
      tone: 'danger',
    },
    {
      id: 'negotiations-without-response',
      title: 'Negociações sem retorno',
      body: `${negotiationsWithoutResponse} ${plural(negotiationsWithoutResponse, 'contato está', 'contatos estão')} há mais de ${noResponseDays} dias sem andamento.`,
      href: '/dashboard/clients?segment=negotiating',
      count: negotiationsWithoutResponse,
      tone: 'warning',
    },
    {
      id: 'negotiations-to-close',
      title: 'Revisar negociações antigas',
      body: `${negotiationsToClose} ${plural(negotiationsToClose, 'negociação passou', 'negociações passaram')} de ${closeSuggestionDays} dias sem retorno.`,
      href: '/dashboard/clients?segment=negotiating',
      count: negotiationsToClose,
      tone: 'danger',
    },
    {
      id: 'post-sale-due',
      title: 'Pós-venda pendente',
      body: `${postSaleDue} ${plural(postSaleDue, 'cliente precisa', 'clientes precisam')} de acompanhamento após a entrega.`,
      href: '/dashboard/projects?stage=COMPLETED',
      count: postSaleDue,
      tone: 'info',
    },
    {
      id: 'warranty-open',
      title: 'Garantias em atendimento',
      body: `${openWarrantyTickets} ${plural(openWarrantyTickets, 'chamado precisa', 'chamados precisam')} de acompanhamento.`,
      href: '/dashboard/projects?warranty=open',
      count: openWarrantyTickets,
      tone: 'warning',
    },
    {
      id: 'change-answers',
      title: 'Alterações respondidas',
      body: `${answeredChanges} ${plural(answeredChanges, 'resposta aguarda', 'respostas aguardam')} conferência da Vertex.`,
      href: '/dashboard/projects?changes=answered',
      count: answeredChanges,
      tone: 'warning',
    },
    {
      id: 'low-satisfaction',
      title: 'Avaliações que precisam de atenção',
      body: `${lowSatisfaction} ${plural(lowSatisfaction, 'cliente deu nota baixa', 'clientes deram nota baixa')}.`,
      href: '/dashboard/post-sale?filter=attention',
      count: lowSatisfaction,
      tone: 'danger',
    },
  ] satisfies AppAlert[]).filter((item) => item.count > 0)
}

const getCachedAppAlerts = unstable_cache(
  async (id: string, role: string) => getAppAlertsUncached({ id, role }),
  ['app-alerts-v4'],
  { revalidate: 30 },
)

export function getAppAlerts(user: AlertUser): Promise<AppAlert[]> {
  return getCachedAppAlerts(user.id || '__sem_usuario__', user.role || 'MANAGER')
}
