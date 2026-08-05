'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertTriangle, LockKeyhole } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanbanCard } from './kanban-card'
import { type ProductionStage, type ProjectData } from '@/types'

interface KanbanColumnProps {
  stage: ProductionStage
  label: string
  color: string
  projects: ProjectData[]
  referenceDate: Date
  overdueCount: number
  blockedCount: number
  pendingIds: Set<string>
  onMove: (project: ProjectData, direction: -1 | 1) => void
  onToggleBlock: (project: ProjectData) => void
  onEditDeadline: (project: ProjectData) => void
}

export function KanbanColumn({
  stage,
  label,
  color,
  projects,
  referenceDate,
  overdueCount,
  blockedCount,
  pendingIds,
  onMove,
  onToggleBlock,
  onEditDeadline,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <section className="flex min-h-0 min-w-[285px] flex-1 flex-col">
      <header
        className="flex min-h-[52px] items-center justify-between gap-2 border border-b-0 border-[#E3E3E3] bg-white px-3 py-2"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <h2 className="truncate text-xs font-semibold text-[#121212]">{label}</h2>
          </div>
          {overdueCount > 0 || blockedCount > 0 ? (
            <div className="mt-1 flex items-center gap-2 pl-[18px] text-[9px] font-semibold">
              {overdueCount > 0 ? (
                <span className="flex items-center gap-1 text-red-700"><AlertTriangle size={9} /> {overdueCount} atrasado{overdueCount === 1 ? '' : 's'}</span>
              ) : null}
              {blockedCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-800"><LockKeyhole size={9} /> {blockedCount} bloqueado{blockedCount === 1 ? '' : 's'}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <span
          className="shrink-0 bg-[#F1F1F1] px-2 py-1 text-xs font-bold text-[#555]"
          title={`${projects.length} projeto${projects.length === 1 ? '' : 's'} nesta etapa`}
        >
          {projects.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[280px] flex-1 space-y-2 overflow-y-auto p-2 transition-colors',
          isOver
            ? 'border-2 border-dashed border-orange-300 bg-orange-50'
            : 'border-2 border-transparent bg-[#F6F6F6]',
        )}
      >
        <SortableContext items={projects.map((project) => project.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <KanbanCard
              key={project.id}
              project={project}
              referenceDate={referenceDate}
              isPending={pendingIds.has(project.id)}
              onMove={onMove}
              onToggleBlock={onToggleBlock}
              onEditDeadline={onEditDeadline}
            />
          ))}
        </SortableContext>

        {projects.length === 0 && !isOver ? (
          <div className="flex h-20 items-center justify-center text-center text-xs text-[#AAA]">
            Sem projetos
          </div>
        ) : null}
      </div>
    </section>
  )
}
