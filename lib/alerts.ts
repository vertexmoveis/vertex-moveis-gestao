import { prisma } from '@/lib/db'
import { addBusinessDays } from '@/lib/business-days'

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
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date = new Date()) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export async function getAppAlerts(user: AlertUser): Promise<AppAlert[]> {
  const isAdmin = user.role === 'ADMIN'
  const projectScope = isAdmin ? {} : { managerId: user.id || '__sem_usuario__' }
  const quoteScope = isAdmin ? {} : { createdById: user.id || '__sem_usuario__' }
  const todayStart = startOfDay()
  const todayEnd = endOfDay()
  const nextWeek = addDays(todayStart, 7)
  const nextSevenBusinessDays = addBusinessDays(todayStart, 7) || nextWeek

  const [
    overduePayments,
    dueSoonPayments,
    delayedProjects,
    startReminders,
    deliverySoon,
    quotesWaitingApproval,
    approvalFollowUpDue,
    expiredQuotes,
    postSaleDue,
  ] = await Promise.all([
    isAdmin
      ? prisma.projectPayment.count({
          where: { paidAt: null, dueDate: { lt: todayStart } },
        })
      : Promise.resolve(0),
    isAdmin
      ? prisma.projectPayment.count({
          where: { paidAt: null, dueDate: { gte: todayStart, lte: nextWeek } },
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
            sentAt: { lte: addDays(todayStart, -3) },
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
    prisma.project.count({
      where: {
        ...projectScope,
        stage: 'COMPLETED',
        postSaleFollowUpAt: { lte: todayEnd },
        postSaleContactedAt: null,
      },
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
      body: `${approvalFollowUpDue} ${plural(approvalFollowUpDue, 'orçamento está', 'orçamentos estão')} há mais de 3 dias sem resposta.`,
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
      id: 'post-sale-due',
      title: 'Pós-venda pendente',
      body: `${postSaleDue} ${plural(postSaleDue, 'cliente precisa', 'clientes precisam')} de acompanhamento após a entrega.`,
      href: '/dashboard/projects?stage=COMPLETED',
      count: postSaleDue,
      tone: 'info',
    },
  ] satisfies AppAlert[]).filter((item) => item.count > 0)
}
