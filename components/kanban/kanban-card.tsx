'use client'

import { useState, type PointerEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import {
  CalendarClock,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  GripVertical,
  Loader2,
  LockKeyhole,
  SlidersHorizontal,
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

function compactEnvironmentNames(project: ProjectData) {
  const names = project.environments?.map((environment) => environment.name).filter(Boolean) || []
  if (names.length === 0) return project.room
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
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
  const environmentNames = compactEnvironmentNames(project)

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'select-none rounded-lg border border-[#E3E3E3] border-l-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-150',
        attention.overdue ? 'border-l-red-500' : attention.blocked ? 'border-l-amber-500' : 'border-l-[#E3E3E3]',
        !isPending && 'hover:border-[#CFCFCF] hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)]',
        isSortableDragging && 'opacity-30',
        isDragging && 'rotate-1 shadow-xl',
        isPending && 'opacity-70',
      )}
    >
      <div className="p-3.5">
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
                className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-[#999] hover:bg-[#F5F5F5] hover:text-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] active:cursor-grabbing"
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
          className="line-clamp-2 text-base font-semibold leading-5 text-[#121212] transition-colors hover:text-[#FF6B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={stopPointer}
        >
          {project.name}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-[#666]">{project.client.name}</p>
        {environmentNames ? <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#8A8A8A]">{environmentNames}</p> : null}

        <div className="mt-2.5 space-y-1.5">
          {attention.blocked ? (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
              <LockKeyhole size={11} className="shrink-0" />
              <span className="shrink-0 font-semibold">Produção bloqueada</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{project.productionBlockReason || 'Motivo não informado'}</span>
            </div>
          ) : null}

          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold',
            attention.overdue
              ? 'bg-red-50 text-red-700'
              : attention.dueSoon
                ? 'bg-amber-50 text-amber-800'
                : attention.noDeadline
                  ? 'bg-[#F5F5F5] text-[#666]'
                  : 'bg-[#F5F5F5] text-[#555]',
            )}
          >
            <span className="flex min-w-0 items-center gap-1 truncate">
              {attention.overdue || attention.noDeadline ? <CircleAlert size={11} className="shrink-0" /> : <CalendarClock size={11} className="shrink-0" />}
              {productionDeadlineLabel(attention)}
            </span>
            {attention.deadline ? (
              <span className="shrink-0">{productionDeadlineDateLabel(attention)}: {formatDate(attention.deadline)}</span>
            ) : null}
          </div>
        </div>

        {environmentSummary && environmentSummary.total > 0 ? (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setEnvironmentsOpen((current) => !current)}
              onPointerDown={stopPointer}
              aria-expanded={environmentsOpen}
              className="flex w-full items-center justify-between rounded-md bg-[#F7F7F7] px-2 py-1.5 text-[10px] hover:bg-[#F1F1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
            >
              <span className="font-medium text-[#666]">Ambientes {environmentSummary.completed} de {environmentSummary.total}</span>
              <span className="flex items-center gap-1 font-semibold text-[#121212]">
                {environmentsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </button>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#E8E8E8]">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${Math.round((environmentSummary.completed / environmentSummary.total) * 100)}%` }}
              />
            </div>
            {environmentsOpen && project.environments ? (
              <div className="mt-1 divide-y divide-[#EFEFEF] rounded-md border border-[#EFEFEF] bg-white">
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
          <p className="mt-2 rounded-md bg-[#F7F7F7] px-2 py-1.5 text-[10px] text-[#777]">
            Próxima etapa: <span className="font-semibold text-[#333]">{PRODUCTION_STAGE_LABELS[nextStage]}</span>
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EFEFEF] pt-3">
          {project.manager ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar name={project.manager.name} size="xs" />
              <span className="truncate text-[11px] text-[#777]">{project.manager.name}</span>
            </div>
          ) : <span />}

          {!isDragging ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href={`/dashboard/projects/${project.id}#operacao`}
                aria-label="Abrir centro operacional"
                title="Abrir centro operacional"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={stopPointer}
                className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#666] transition-colors hover:bg-[#F1F1F1] hover:text-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
              >
                <SlidersHorizontal size={14} />
              </Link>
              <Link
                href={`/dashboard/projects/${project.id}#materiais`}
                aria-label="Abrir materiais e compras"
                title={project.pendingMaterialCount ? `${project.pendingMaterialCount} material(is) exigem atenção` : 'Abrir materiais e compras'}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={stopPointer}
                className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#666] transition-colors hover:bg-[#F1F1F1] hover:text-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
              >
                <Boxes size={14} />
                {project.pendingMaterialCount ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#FF6B00] px-0.5 text-[8px] font-bold text-white">
                    {Math.min(project.pendingMaterialCount, 9)}{project.pendingMaterialCount > 9 ? '+' : ''}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                aria-label="Voltar etapa"
                title={previousStage ? `Voltar para ${PRODUCTION_STAGE_LABELS[previousStage]}` : 'Primeira etapa'}
                disabled={!previousStage || isPending}
                onClick={() => previousStage && onMove?.(project, -1)}
                onPointerDown={stopPointer}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#666] transition-colors hover:bg-[#F1F1F1] hover:text-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] disabled:opacity-25"
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
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#F1F1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] disabled:opacity-25',
                  attention.blocked ? 'text-amber-700' : 'text-[#666]',
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
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#666] transition-colors hover:bg-[#F1F1F1] hover:text-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] disabled:opacity-25"
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
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FF6B00] text-white transition-colors hover:bg-[#E85F00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 disabled:bg-[#DDD]"
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
