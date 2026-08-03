import { getServerSession } from 'next-auth'
import { Header } from '@/components/layout/header'
import { InstallationMobile } from '@/components/installation/installation-mobile'
import { authOptions } from '@/lib/auth'
import { formatClientAddress } from '@/lib/address'
import { prisma } from '@/lib/db'
import {
  ACTIVE_INSTALLATION_SCHEDULE_STATUSES,
  type InstallationScheduleStatus,
} from '@/lib/installation-schedule'

type DashboardUser = { id?: string; role?: string }

export default async function InstallationPage() {
  const session = await getServerSession(authOptions)
  const user = (session?.user as DashboardUser | undefined) || {}
  const projectAccess = user.role === 'ADMIN' ? {} : { managerId: user.id }
  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setDate(rangeStart.getDate() - 1)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(now)
  rangeEnd.setDate(rangeEnd.getDate() + 30)
  rangeEnd.setHours(23, 59, 59, 999)

  const [schedules, unscheduledProjects] = await Promise.all([
    prisma.installationSchedule.findMany({
      where: {
        status: { in: ACTIVE_INSTALLATION_SCHEDULE_STATUSES },
        scheduledStart: { gte: rangeStart, lte: rangeEnd },
        project: { archivedAt: null, ...projectAccess },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            room: true,
            client: {
              select: {
                name: true,
                phone: true,
                whatsapp: true,
                address: true,
                street: true,
                number: true,
                neighborhood: true,
                city: true,
                state: true,
                zipCode: true,
              },
            },
          },
        },
        team: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 100,
    }),
    prisma.project.findMany({
      where: {
        archivedAt: null,
        ...projectAccess,
        stage: 'INSTALLATION',
        installationSchedules: {
          none: { status: { in: ACTIVE_INSTALLATION_SCHEDULE_STATUSES } },
        },
      },
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ])

  const serializedSchedules = schedules.map((schedule) => ({
    id: schedule.id,
    projectId: schedule.projectId,
    scheduledStart: schedule.scheduledStart.toISOString(),
    scheduledEnd: schedule.scheduledEnd.toISOString(),
    teamId: schedule.teamId,
    vehicleId: schedule.vehicleId,
    status: schedule.status as InstallationScheduleStatus,
    notes: schedule.notes,
    clientConfirmation: schedule.clientConfirmation,
    completionNotes: schedule.completionNotes,
    project: {
      id: schedule.project.id,
      name: schedule.project.name,
      room: schedule.project.room,
      client: {
        name: schedule.project.client.name,
        phone: schedule.project.client.whatsapp || schedule.project.client.phone,
        address: formatClientAddress(schedule.project.client),
      },
    },
    team: schedule.team,
    vehicle: schedule.vehicle,
  }))

  return (
    <div className="min-h-full bg-[#F5F5F5]">
      <Header
        title="Instalação"
        subtitle="Agenda de campo, rota, fotos e confirmação do cliente"
        userName={session?.user?.name || ''}
      />
      <InstallationMobile schedules={serializedSchedules} unscheduledProjects={unscheduledProjects} />
    </div>
  )
}
