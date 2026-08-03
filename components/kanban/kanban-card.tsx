'use client'

import { useState, type PointerEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  GripVertical,
  Loader2,
  LockKeyhole,
  UnlockKeyhole,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { isEnvironmentCompleted } from '@/lib/project-environments'
import {
  getAdjacentProductionStage,
  getProductionProjectState,
  productionDeadlineDateLabel,
  productionDeadlineLabel,
} from '@/lib/production-board'
import {
  PROJECT_ENVIRONMENT_STATUS_BG,
  PROJECT_ENVIRONMENT_STATUS_LABELS,
  PRODUCTION_STAGE_LABELS,
  type ProjectData,
} from '@/types'

interface KanbanCardProps {
  project: ProjectData
  referenceDate: Date
  isDragging?: boolean
  isPending?: boolean
  onMove?: (project: ProjectData, direction: -1 | 1) => void
  onToggleBlock?: (project: ProjectData) => void
  onEditDeadline?: (project: ProjectData) => void
}

function stopPointer(event: PointerEvent<HTMLElement>) {
  event.stopPropagation()
}

export function KanbanCard({
  project,
  referenceDate,
  isDragging,
  isPending,
  onMove,
  onToggleBlock,
  onEditDeadline,
}: KanbanCardProps) {
  const [environmentsOpen, setEnvironmentsOpen] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: project.id, disabled: Boolean(isDragging || isPending) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const attention = getProductionProjectState(project, referenceDate)
  const previousStage = getAdjacentProductionStage(project.stage, -1)
  const nextStage = getAdjacentProductionStage(project.stage, 1)
  const environmentSummary = project.environmentSummary || (
    project.environments
      ? {
          total: project.environments.length,
          completed: project.environments.filter((environment) => isEnvironmentCompleted(environment.status)).length,
        }
      : null
  )

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'select-none border bg-white shadow-sm transition-all duration-150',
        attention.overdue ? 'border-red-200' : attention.blocked ? 'border-amber-300' : 'border-[#E3E3E3]',
        !isPending && 'hover:border-[#CFCFCF] hover:shadow-md',
        isSortableDragging && 'opacity-30',
        isDragging && 'rotate-1 shadow-xl',
        isPending && 'opacity-70',
      )}
    >
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <StatusBadge status={project.status} />
          <div className="flex items-center gap-1">
            {isPending ? <Loader2 size={14} className="animate-spin text-[#FF6B00]" /> : null}
            {!isDragging ? (
              <button
                type="button"
                aria-label={`Mover ${project.name}`}
                title="Arrastar projeto"
                onPointerDown={stopPointer}
                className="flex h-7 w-7 cursor-grab items-center justify-center text-[#999] hover:bg-[#F5F5F5] hover:text-[#333] active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical size={15} />
              </button>
            ) : null}
          </div>
        </div>

        <Link
          href={`/dashboard/projects/${project.id}`}
          className="line-clamp-2 text-sm font-semibold text-[#121212] transition-colors hover:text-[#FF6B00]"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={stopPointer}
        >
          {project.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-[#777]">{project.client.name}</p>
        {project.room ? <p className="truncate text-xs text-[#9E9E9E]">{project.room}</p> : null}

        {attention.blocked ? (
          <div className="mt-2 border-l-4 border-red-500 bg-red-50 px-2 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-bold text-red-700">
              <LockKeyhole size={11} /> Produção bloqueada
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] text-red-700">
              {project.productionBlockReason || 'Motivo não informado'}
            </p>
          </div>
        ) : null}

        <div
          className={cn(
            'mt-2 flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] font-semibold',
            attention.overdue
              ? 'bg-red-50 text-red-700'
              : attention.dueSoon
                ? 'bg-amber-50 text-amber-800'
                : attention.noDeadline
                  ? 'bg-[#F5F5F5] text-[#666]'
                  : 'bg-emerald-50 text-emerald-700',
          )}
        >
          <span className="flex items-center gap-1">
            {attention.overdue || attention.noDeadline ? <CircleAlert size={11} /> : <CalendarClock size={11} />}
            {productionDeadlineLabel(attention)}
          </span>
          {attention.deadline ? (
            <span>{productionDeadlineDateLabel(attention)}: {formatDate(attention.deadline)}</span>
          ) : null}
        </div>

        {environmentSummary && environmentSummary.total > 0 ? (
          <div className="mt-2 border border-[#ECECEC]">
            <button
              type="button"
              onClick={() => setEnvironmentsOpen((current) => !current)}
              onPointerDown={stopPointer}
              aria-expanded={environmentsOpen}
              className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] hover:bg-[#FAFAFA]"
            >
              <span className="font-medium text-[#666]">Ambientes</span>
              <span className="flex items-center gap-1 font-semibold text-[#121212]">
                {environmentSummary.completed}/{environmentSummary.total}
                {environmentsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </button>
            <div className="h-1 overflow-hidden bg-[#E8E8E8]">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.round((environmentSummary.completed / environmentSummary.total) * 100)}%` }}
              />
            </div>
            {environmentsOpen && project.environments ? (
              <div className="divide-y divide-[#EFEFEF] border-t border-[#EFEFEF]">
                {project.environments.map((environment) => (
                  <div key={environment.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-[10px] font-medium text-[#333]">{environment.name}</span>
                    <span className={cn('shrink-0 px-1.5 py-0.5 text-[9px] font-semibold', PROJECT_ENVIRONMENT_STATUS_BG[environment.status])}>
                      {PROJECT_ENVIRONMENT_STATUS_LABELS[environment.status]}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {nextStage ? (
          <p className="mt-2 truncate text-[10px] text-[#777]">
            Próxima etapa: <span className="font-semibold text-[#333]">{PRODUCTION_STAGE_LABELS[nextStage]}</span>
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#EFEFEF] pt-2.5">
          {project.manager ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar name={project.manager.name} size="xs" />
              <span className="truncate text-[10px] text-[#777]">{project.manager.name}</span>
            </div>
          ) : <span />}

          {!isDragging ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Voltar etapa"
                title={previousStage ? `Voltar para ${PRODUCTION_STAGE_LABELS[previousStage]}` : 'Primeira etapa'}
                disabled={!previousStage || isPending}
                onClick={() => previousStage && onMove?.(project, -1)}
                onPointerDown={stopPointer}
                className="flex h-7 w-7 items-center justify-center text-[#666] hover:bg-[#F5F5F5] disabled:opacity-25"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label={attention.blocked ? 'Desbloquear produção' : 'Bloquear produção'}
                title={attention.blocked ? 'Desbloquear produção' : 'Registrar bloqueio'}
                disabled={isPending}
                onClick={() => onToggleBlock?.(project)}
                onPointerDown={stopPointer}
                className={cn(
                  'flex h-7 w-7 items-center justify-center hover:bg-[#F5F5F5] disabled:opacity-25',
                  attention.blocked ? 'text-red-600' : 'text-[#666]',
                )}
              >
                {attention.blocked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}
              </button>
              <button
                type="button"
                aria-label="Alterar prazo da etapa"
                title="Alterar prazo da etapa"
                disabled={isPending}
                onClick={() => onEditDeadline?.(project)}
                onPointerDown={stopPointer}
                className="flex h-7 w-7 items-center justify-center text-[#666] hover:bg-[#F5F5F5] disabled:opacity-25"
              >
                <CalendarClock size={14} />
              </button>
              <button
                type="button"
                aria-label="Avançar etapa"
                title={nextStage ? `Avançar para ${PRODUCTION_STAGE_LABELS[nextStage]}` : 'Projeto concluído'}
                disabled={!nextStage || isPending}
                onClick={() => nextStage && onMove?.(project, 1)}
                onPointerDown={stopPointer}
                className="flex h-7 w-7 items-center justify-center bg-[#FF6B00] text-white hover:bg-[#E85F00] disabled:bg-[#DDD]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
