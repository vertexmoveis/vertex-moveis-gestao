import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { CalendarView, type CalendarEvent } from '@/components/calendar/calendar-view'
import { OperationsSchedule } from '@/components/calendar/operations-schedule'
import { numberValue } from '@/lib/money'
import { deliveryForecastMonthLabel } from '@/lib/delivery-forecast'
import type { ProjectStatus } from '@/types'

type DashboardUser = { id?: string; role?: string }

const CALENDAR_EVENT_LIMIT = 600

function parseMonth(value: string | undefined) {
  const now = new Date()
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  const year = match ? Number(match[1]) : now.getFullYear()
  const month = match ? Number(match[2]) - 1 : now.getMonth()
  const safeMonth = month >= 0 && month <= 11 ? month : now.getMonth()
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear()

  const start = new Date(safeYear, safeMonth, 1)
  const end = new Date(safeYear, safeMonth + 1, 1)
  const visibleStart = new Date(safeYear, safeMonth, -7)
  const visibleEnd = new Date(safeYear, safeMonth + 1, 8)
  const dueStart = new Date(Date.UTC(visibleStart.getFullYear(), visibleStart.getMonth(), visibleStart.getDate()))
  const dueEnd = new Date(Date.UTC(visibleEnd.getFullYear(), visibleEnd.getMonth(), visibleEnd.getDate()))

  return {
    key: `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}`,
    start,
    end,
    visibleStart,
    visibleEnd,
    dueStart,
    dueEnd,
  }
}

function isInRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end)
}

async function getCalendarEvents(user: DashboardUser, range: ReturnType<typeof parseMonth>) {
  const isAdmin = user.role === 'ADMIN'
  const projectAccess = { archivedAt: null, ...(isAdmin ? {} : { managerId: user.id }) }

  const [projects, installationSchedules, monthForecasts] = await Promise.all([
    prisma.project.findMany({
    where: {
      ...projectAccess,
      OR: [
        { productionStartReminderDate: { gte: range.visibleStart, lt: range.visibleEnd } },
        { deliveryDeadlineDate: { gte: range.visibleStart, lt: range.visibleEnd } },
        { estimatedEndDate: { gte: range.visibleStart, lt: range.visibleEnd } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      stage: true,
      productionStartReminderDate: true,
      deliveryDeadlineDate: true,
      deliveryForecastMonth: true,
      estimatedEndDate: true,
      client: { select: { name: true } },
    },
    orderBy: [{ deliveryDeadlineDate: 'asc' }, { estimatedEndDate: 'asc' }],
      take: CALENDAR_EVENT_LIMIT + 1,
    }),
    prisma.installationSchedule.findMany({
      where: {
        scheduledStart: { gte: range.visibleStart, lt: range.visibleEnd },
        project: projectAccess,
      },
      select: {
        id: true,
        scheduledStart: true,
        project: { select: { id: true, name: true, status: true, stage: true, client: { select: { name: true } } } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: CALENDAR_EVENT_LIMIT + 1,
    }),
    prisma.project.findMany({
      where: { ...projectAccess, stage: { not: 'COMPLETED' }, deliveryForecastMonth: range.key },
      select: { id: true, name: true, deliveryForecastMonth: true, client: { select: { name: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: CALENDAR_EVENT_LIMIT + 1,
    }),
  ])

  const events: CalendarEvent[] = []

  for (const project of projects.slice(0, CALENDAR_EVENT_LIMIT)) {
    if (
      project.stage !== 'COMPLETED' &&
      project.stage === 'PENDING_START' &&
      isInRange(project.productionStartReminderDate, range.visibleStart, range.visibleEnd)
    ) {
      events.push({
        id: `${project.id}:production`,
        projectId: project.id,
        projectName: project.name,
        clientName: project.client.name,
        date: project.productionStartReminderDate!.toISOString(),
        type: 'production',
        status: project.status as ProjectStatus,
        stage: project.stage,
      })
    }

    const deadline = project.deliveryDeadlineDate || project.estimatedEndDate
    if (project.stage !== 'COMPLETED' && !project.deliveryForecastMonth && isInRange(deadline, range.visibleStart, range.visibleEnd)) {
      events.push({
        id: `${project.id}:deadline`,
        projectId: project.id,
        projectName: project.name,
        clientName: project.client.name,
        date: deadline!.toISOString(),
        type: project.stage === 'INSTALLATION' || project.stage === 'TRANSPORTATION' ? 'installation' : 'delivery',
        status: project.status as ProjectStatus,
        stage: project.stage,
      })
    }
  }

  for (const schedule of installationSchedules.slice(0, CALENDAR_EVENT_LIMIT)) {
    events.push({
      id: `${schedule.id}:installation`,
      projectId: schedule.project.id,
      projectName: schedule.project.name,
      clientName: schedule.project.client.name,
      date: schedule.scheduledStart.toISOString(),
      type: 'installation',
      status: schedule.project.status as ProjectStatus,
      stage: schedule.project.stage,
    })
  }

  let paymentsLimited = false
  if (isAdmin) {
    const payments = await prisma.projectPayment.findMany({
      where: {
        paidAt: null,
        dueDate: { gte: range.dueStart, lt: range.dueEnd },
        project: { archivedAt: null },
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            stage: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: CALENDAR_EVENT_LIMIT + 1,
    })
    paymentsLimited = payments.length > CALENDAR_EVENT_LIMIT

    for (const payment of payments.slice(0, CALENDAR_EVENT_LIMIT)) {
      events.push({
        id: `${payment.id}:finance`,
        projectId: payment.project.id,
        projectName: payment.project.name,
        clientName: payment.project.client.name,
        date: payment.dueDate.toISOString(),
        type: 'finance',
        status: payment.project.status as ProjectStatus,
        stage: payment.project.stage,
        amount: numberValue(payment.amount),
      })
    }
  }

  return {
    events: events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    monthForecasts: monthForecasts.slice(0, CALENDAR_EVENT_LIMIT),
    monthForecastsLimited: monthForecasts.length > CALENDAR_EVENT_LIMIT,
    limited: projects.length > CALENDAR_EVENT_LIMIT || installationSchedules.length > CALENDAR_EVENT_LIMIT || paymentsLimited,
  }
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams])
  const range = parseMonth(params.month)
  const calendar = await getCalendarEvents((session?.user as DashboardUser | undefined) || {}, range)

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Calendário"
        subtitle="Prazos de produção, entregas, instalações e recebimentos"
        userName={session?.user?.name || ''}
      />
      <div className="flex-1 space-y-6 overflow-auto p-4 sm:p-6">
        <CalendarView key={range.key} events={calendar.events} initialMonth={range.key} limited={calendar.limited} />
        {calendar.monthForecasts.length > 0 ? (
          <section className="space-y-3 rounded-lg border border-[#E8E8E8] bg-white p-4 sm:p-5" aria-label="Previsões sem dia definido">
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Previsões sem dia definido</h2>
              <p className="mt-1 text-xs text-[#777]">Entregas previstas para este mês, aguardando a definição do dia.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {calendar.monthForecasts.map((project) => (
                <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="rounded-lg border border-[#E8E8E8] p-3 hover:border-[#FF6B00]">
                  <p className="text-sm font-semibold">{project.name}</p>
                  <p className="mt-1 text-xs text-[#777]">{project.client.name}</p>
                  <p className="mt-2 text-xs text-orange-700">{deliveryForecastMonthLabel(project.deliveryForecastMonth)}</p>
                </Link>
              ))}
            </div>
            {calendar.monthForecastsLimited ? <p className="text-xs text-[#777]">Mostrando as primeiras {CALENDAR_EVENT_LIMIT} previsões deste mês.</p> : null}
          </section>
        ) : null}
        <OperationsSchedule key={`operations-${range.key}`} month={range.key} />
      </div>
    </div>
  )
}
