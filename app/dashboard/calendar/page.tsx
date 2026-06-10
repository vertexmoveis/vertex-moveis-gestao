import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { CalendarView } from '@/components/calendar/calendar-view'

async function getCalendarEvents() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { estimatedEndDate: { not: null } },
        { startDate: { not: null } },
      ],
    },
    include: {
      client: { select: { name: true } },
    },
    orderBy: { estimatedEndDate: 'asc' },
  })

  return projects.map((p) => ({
    id: p.id,
    title: `${p.name} — ${p.client.name}`,
    start: p.estimatedEndDate || p.startDate || new Date(),
    end: p.estimatedEndDate || p.startDate || new Date(),
    status: p.status,
    stage: p.stage,
    startDate: p.startDate?.toISOString() || null,
    estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
    clientName: p.client.name,
    projectName: p.name,
  }))
}

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  const events = await getCalendarEvents()

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Calendário"
        subtitle="Cronograma de entregas e instalações"
        userName={session?.user?.name || ''}
      />
      <div className="flex-1 p-6">
        <CalendarView events={events} />
      </div>
    </div>
  )
}
