import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { ProjectData } from '@/types'
import { serializeEnvironment, summarizeEnvironments } from '@/lib/project-environments'
import { optionalMoneyValue } from '@/lib/money'

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

export default async function ProductionPage() {
  const session = await getServerSession(authOptions)
  const production = await getProjects((session?.user as DashboardUser | undefined) || {})
  const projects = production.projects

  const totalActive = projects.filter((p) => p.stage !== 'COMPLETED').length
  const totalCompleted = projects.filter((p) => p.stage === 'COMPLETED').length
  const totalDelayed = projects.filter((p) => p.status === 'DELAYED').length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Produção"
        subtitle={`${totalActive} projetos em andamento · ${totalCompleted} concluídos recentes · ${totalDelayed > 0 ? `${totalDelayed} atrasados ⚠` : `concluídos somem após ${COMPLETED_VISIBLE_DAYS} dias`}`}
        userName={session?.user?.name || ''}
      />

      <div className="flex-1 p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-[#9E9E9E]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9E9E9E]" />
              Arraste os cards entre as colunas
            </span>
            <span className="text-[#D9D9D9]">|</span>
            <span>{projects.length} projeto{projects.length !== 1 ? 's' : ''} total</span>
          </div>
        </div>
        {production.limited ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Mostrando os {PRODUCTION_PROJECT_LIMIT} projetos mais atualizados. Use Projetos para localizar os demais.
          </div>
        ) : null}
        <div className="h-full overflow-hidden">
          <KanbanBoard
            key={projects.map((p) => `${p.id}:${p.stage}:${p.status}:${p.updatedAt}`).join('|')}
            initialProjects={projects}
          />
        </div>
      </div>
    </div>
  )
}
