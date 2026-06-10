import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { ProjectData } from '@/types'

async function getProjects(): Promise<ProjectData[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      client: { select: { id: true, name: true, phone: true, whatsapp: true } },
      manager: { select: { id: true, name: true } },
    },
  })

  return projects.map((p) => ({
    ...p,
    status: p.status as ProjectData['status'],
    stage: p.stage as ProjectData['stage'],
    startDate: p.startDate?.toISOString() || null,
    estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
    actualEndDate: p.actualEndDate?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))
}

export default async function ProductionPage() {
  const session = await getServerSession(authOptions)
  const projects = await getProjects()

  const totalActive = projects.filter((p) => p.stage !== 'COMPLETED').length
  const totalCompleted = projects.filter((p) => p.stage === 'COMPLETED').length
  const totalDelayed = projects.filter((p) => p.status === 'DELAYED').length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Produção"
        subtitle={`${totalActive} projetos em andamento · ${totalCompleted} concluídos · ${totalDelayed > 0 ? `${totalDelayed} atrasados ⚠` : ''}`}
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
        <div className="h-full overflow-hidden">
          <KanbanBoard initialProjects={projects} />
        </div>
      </div>
    </div>
  )
}
