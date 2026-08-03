'use client'

import Link from 'next/link'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  LockKeyhole,
  UnlockKeyhole,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { isEnvironmentCompleted } from '@/lib/project-environments'
import { cn, formatDate } from '@/lib/utils'
import {
  getAdjacentProductionStage,
  getProductionProjectState,
  productionDeadlineDateLabel,
  productionDeadlineLabel,
} from '@/lib/production-board'
import {
  PRODUCTION_STAGE_LABELS,
  type ProjectData,
} from '@/types'

export function ProductionList({
  projects,
  referenceDate,
  pendingIds,
  onMove,
  onToggleBlock,
  onEditDeadline,
}: {
  projects: ProjectData[]
  referenceDate: Date
  pendingIds: Set<string>
  onMove: (project: ProjectData, direction: -1 | 1) => void
  onToggleBlock: (project: ProjectData) => void
  onEditDeadline: (project: ProjectData) => void
}) {
  return (
    <div className="overflow-hidden border border-[#E5E5E5] bg-white">
      <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px_130px_minmax(130px,0.7fr)_170px] gap-3 border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-2.5 text-[10px] font-semibold uppercase text-[#777] lg:grid">
        <span>Projeto</span>
        <span>Etapa</span>
        <span>Ambientes</span>
        <span>Prazo</span>
        <span>Responsável</span>
        <span className="text-right">Ações</span>
      </div>

      <div className="divide-y divide-[#ECECEC]">
        {projects.map((project) => {
          const attention = getProductionProjectState(project, referenceDate)
          const previousStage = getAdjacentProductionStage(project.stage, -1)
          const nextStage = getAdjacentProductionStage(project.stage, 1)
          const pending = pendingIds.has(project.id)
          const environments = project.environmentSummary || {
            total: project.environments?.length || 0,
            completed: project.environments?.filter((item) => isEnvironmentCompleted(item.status)).length || 0,
          }

          return (
            <div
              key={project.id}
              className={cn(
                'grid gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px_130px_minmax(130px,0.7fr)_170px] lg:items-center',
                attention.overdue && 'bg-red-50/40',
                attention.blocked && !attention.overdue && 'bg-amber-50/40',
              )}
            >
              <div className="min-w-0">
                <Link href={`/dashboard/projects/${project.id}`} className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-[#121212] hover:text-[#FF6B00]">
                  <span className="truncate">{project.name}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </Link>
                <p className="truncate text-xs text-[#777]">{project.client.name}</p>
                {attention.blocked ? (
                  <p className="mt-1 line-clamp-1 text-[10px] font-medium text-red-700">
                    Bloqueado: {project.productionBlockReason}
                  </p>
                ) : null}
              </div>

              <div>
                <span className="inline-flex bg-[#F1EBFF] px-2 py-1 text-[10px] font-semibold text-purple-700">
                  {PRODUCTION_STAGE_LABELS[project.stage]}
                </span>
              </div>

              <div className="text-xs text-[#555]">
                <span className="font-semibold text-[#121212]">{environments.completed}/{environments.total}</span> concluídos
              </div>

              <button
                type="button"
                onClick={() => onEditDeadline(project)}
                className={cn(
                  'text-left text-xs font-semibold hover:text-[#FF6B00]',
                  attention.overdue ? 'text-red-700' : attention.dueSoon ? 'text-amber-700' : 'text-[#555]',
                )}
              >
                {productionDeadlineLabel(attention)}
                {attention.deadline ? (
                  <span className="block text-[10px] font-normal text-[#888]">
                    {productionDeadlineDateLabel(attention)}: {formatDate(attention.deadline)}
                  </span>
                ) : null}
              </button>

              <div className="flex min-w-0 items-center gap-2">
                {project.manager ? (
                  <>
                    <Avatar name={project.manager.name} size="xs" />
                    <span className="truncate text-xs text-[#555]">{project.manager.name}</span>
                  </>
                ) : <span className="text-xs text-[#999]">Sem responsável</span>}
              </div>

              <div className="flex items-center justify-end gap-1">
                {pending ? <Loader2 size={15} className="mr-1 animate-spin text-[#FF6B00]" /> : null}
                <button
                  type="button"
                  title={previousStage ? `Voltar para ${PRODUCTION_STAGE_LABELS[previousStage]}` : 'Primeira etapa'}
                  aria-label="Voltar etapa"
                  disabled={!previousStage || pending}
                  onClick={() => previousStage && onMove(project, -1)}
                  className="flex h-8 w-8 items-center justify-center border border-[#E3E3E3] text-[#555] hover:bg-[#F5F5F5] disabled:opacity-25"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  title={attention.blocked ? 'Desbloquear produção' : 'Registrar bloqueio'}
                  aria-label={attention.blocked ? 'Desbloquear produção' : 'Bloquear produção'}
                  disabled={pending}
                  onClick={() => onToggleBlock(project)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center border border-[#E3E3E3] hover:bg-[#F5F5F5] disabled:opacity-25',
                    attention.blocked ? 'text-red-600' : 'text-[#555]',
                  )}
                >
                  {attention.blocked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}
                </button>
                <button
                  type="button"
                  title="Alterar prazo da etapa"
                  aria-label="Alterar prazo da etapa"
                  disabled={pending}
                  onClick={() => onEditDeadline(project)}
                  className="flex h-8 w-8 items-center justify-center border border-[#E3E3E3] text-[#555] hover:bg-[#F5F5F5] disabled:opacity-25"
                >
                  <CalendarClock size={14} />
                </button>
                <button
                  type="button"
                  title={nextStage ? `Avançar para ${PRODUCTION_STAGE_LABELS[nextStage]}` : 'Projeto concluído'}
                  aria-label="Avançar etapa"
                  disabled={!nextStage || pending}
                  onClick={() => nextStage && onMove(project, 1)}
                  className="flex h-8 w-8 items-center justify-center bg-[#FF6B00] text-white hover:bg-[#E85F00] disabled:bg-[#DDD]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
