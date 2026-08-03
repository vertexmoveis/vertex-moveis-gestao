import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { ProjectData } from '@/types'
import { serializeEnvironment, summarizeEnvironments } from '@/lib/project-environments'
import { optionalMoneyValue } from '@/lib/money'
import { getProductionProjectState } from '@/lib/production-board'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE } from '@/lib/company-profile'
import { getProductionCapacityWeeks } from '@/lib/production-capacity'
import { toDateOnlyUtc } from '@/lib/date-only'
import { ProductionCapacity } from '@/components/production/production-capacity'

type DashboardUser = { id?: string; role?: string }

const COMPLETED_VISIBLE_DAYS = 7
const PRODUCTION_PROJECT_LIMIT = 250

async function getProjects(user: DashboardUser): Promise<{ projects: ProjectData[]; limited: boolean }> {
  const isAdmin = user.role === 'ADMIN'
  const completedVisibleSince = new Date()
  completedVisibleSince.setDate(completedVisibleSince.getDate() - COMPLETED_VISIBLE_DAYS)

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(isAdmin ? {} : { managerId: user.id }),
      OR: [
        { stage: { not: 'COMPLETED' } },
        {
          stage: 'COMPLETED',
          OR: [
            { actualEndDate: { gte: completedVisibleSince } },
            { actualEndDate: null, updatedAt: { gte: completedVisibleSince } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: PRODUCTION_PROJECT_LIMIT + 1,
    select: {
      id: true,
      name: true,
      room: true,
      status: true,
      stage: true,
      approvalDate: true,
      deliveryBusinessDays: true,
      deliveryDeadlineDate: true,
      productionReminderBusinessDays: true,
      productionStartReminderDate: true,
      startDate: true,
      estimatedEndDate: true,
      actualEndDate: true,
      value: isAdmin,
      productionCost: isAdmin,
      downPayment: isAdmin,
      downPaymentDate: isAdmin,
      installmentCount: isAdmin,
      installmentValue: isAdmin,
      firstInstallmentDate: isAdmin,
      internalNotes: false,
      productionBlockedAt: true,
      productionBlockReason: true,
      stageDeadlineDate: true,
      environments: {
        select: { id: true, name: true, status: true, position: true, notes: true, startedAt: true, completedAt: true },
        orderBy: { position: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
      manager: { select: { id: true, name: true } },
    },
  })

  return {
    limited: projects.length > PRODUCTION_PROJECT_LIMIT,
    projects: projects.slice(0, PRODUCTION_PROJECT_LIMIT).map((p) => ({
    ...p,
    internalNotes: null,
    productionBlockedAt: p.productionBlockedAt?.toISOString() || null,
    productionBlockReason: p.productionBlockReason,
    stageDeadlineDate: p.stageDeadlineDate?.toISOString() || null,
    value: isAdmin ? optionalMoneyValue(p.value) : null,
    productionCost: isAdmin ? optionalMoneyValue(p.productionCost) : null,
    downPayment: isAdmin ? optionalMoneyValue(p.downPayment) : null,
    downPaymentDate: isAdmin ? p.downPaymentDate?.toISOString() || null : null,
    installmentCount: isAdmin ? p.installmentCount : 0,
    installmentValue: isAdmin ? optionalMoneyValue(p.installmentValue) : null,
    firstInstallmentDate: isAdmin ? p.firstInstallmentDate?.toISOString() || null : null,
    environments: p.environments.map(serializeEnvironment),
    environmentSummary: summarizeEnvironments(p.environments),
    client: {
      ...p.client,
      phone: isAdmin ? p.client.phone : null,
      whatsapp: isAdmin ? p.client.whatsapp : null,
    },
    status: p.status as ProjectData['status'],
    stage: p.stage as ProjectData['stage'],
    approvalDate: p.approvalDate?.toISOString() || null,
    deliveryBusinessDays: p.deliveryBusinessDays,
    deliveryDeadlineDate: p.deliveryDeadlineDate?.toISOString() || null,
    productionReminderBusinessDays: p.productionReminderBusinessDays,
    productionStartReminderDate: p.productionStartReminderDate?.toISOString() || null,
    startDate: p.startDate?.toISOString() || null,
    estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
    actualEndDate: p.actualEndDate?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    })),
  }
}

async function getCapacity(user: DashboardUser, referenceDate: Date) {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: COMPANY_PROFILE_ID },
    select: { weeklyProductionCapacity: true },
  })
  const weeklyCapacity = profile?.weeklyProductionCapacity
    || DEFAULT_COMPANY_PROFILE.weeklyProductionCapacity
  const emptyWeeks = getProductionCapacityWeeks([], weeklyCapacity, referenceDate)
  const rangeStart = toDateOnlyUtc(emptyWeeks[0]?.start)
  const rangeEnd = toDateOnlyUtc(emptyWeeks.at(-1)?.end)

  const projects = rangeStart && rangeEnd
    ? await prisma.project.findMany({
        where: {
          archivedAt: null,
          stage: { not: 'COMPLETED' },
          ...(user.role === 'ADMIN' ? {} : { managerId: user.id }),
          OR: [
            { deliveryDeadlineDate: { gte: rangeStart, lte: rangeEnd } },
            {
              deliveryDeadlineDate: null,
              estimatedEndDate: { gte: rangeStart, lte: rangeEnd },
            },
          ],
        },
        select: { deliveryDeadlineDate: true, estimatedEndDate: true },
      })
    : []

  return getProductionCapacityWeeks(
    projects.map((project) => project.deliveryDeadlineDate || project.estimatedEndDate),
    weeklyCapacity,
    referenceDate,
  )
}

export default async function ProductionPage() {
  const session = await getServerSession(authOptions)
  const user = (session?.user as DashboardUser | undefined) || {}
  const referenceDate = new Date()
  const [production, capacityWeeks] = await Promise.all([
    getProjects(user),
    getCapacity(user, referenceDate),
  ])
  const projects = production.projects

  const totalActive = projects.filter((p) => p.stage !== 'COMPLETED').length
  const totalCompleted = projects.filter((p) => p.stage === 'COMPLETED').length
  const projectStates = projects.map((project) => getProductionProjectState(project, referenceDate))
  const totalDelayed = projectStates.filter((state) => state.overdue).length
  const totalBlocked = projectStates.filter((state) => state.blocked).length

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Produção"
        subtitle={`${totalActive} em andamento · ${totalDelayed} atrasado${totalDelayed === 1 ? '' : 's'} · ${totalBlocked} bloqueado${totalBlocked === 1 ? '' : 's'} · ${totalCompleted} concluído${totalCompleted === 1 ? '' : 's'} recente${totalCompleted === 1 ? '' : 's'}`}
        userName={session?.user?.name || ''}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-6">
        <ProductionCapacity weeks={capacityWeeks} />
        {production.limited ? (
          <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Mostrando os {PRODUCTION_PROJECT_LIMIT} projetos mais atualizados. Use Projetos para localizar os demais.
          </div>
        ) : null}
        <KanbanBoard
          initialProjects={projects}
          referenceDate={referenceDate.toISOString()}
        />
      </div>
    </div>
  )
}
