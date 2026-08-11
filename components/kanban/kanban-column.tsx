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
    <section className="flex min-h-[320px] min-w-[340px] max-w-[420px] basis-[380px] flex-1 self-start flex-col overflow-hidden rounded-lg border border-[#E7E7E7] bg-white">
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-[#E7E7E7] bg-white px-3.5 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <h2 className="truncate text-[13px] font-semibold text-[#121212]">{label}</h2>
          </div>
          {overdueCount > 0 || blockedCount > 0 ? (
            <div className="mt-1 flex items-center gap-2.5 pl-4 text-[10px] font-medium">
              {overdueCount > 0 ? (
                <span className="flex items-center gap-1 text-red-700"><AlertTriangle size={10} /> {overdueCount} atrasado{overdueCount === 1 ? '' : 's'}</span>
              ) : null}
              {blockedCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-700"><LockKeyhole size={10} /> {blockedCount} bloqueado{blockedCount === 1 ? '' : 's'}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <span
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-[#F1F1F1] px-1.5 text-[11px] font-semibold text-[#555]"
          title={`${projects.length} projeto${projects.length === 1 ? '' : 's'} nesta etapa`}
        >
          {projects.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[240px] flex-1 space-y-3 overflow-y-auto bg-[#FAFAFA] p-3 transition-colors',
          isOver && 'bg-orange-50/70 shadow-[inset_0_0_0_2px_#FDBA74]',
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
          <div className="flex h-24 items-center justify-center text-center text-xs text-[#999]">
            Sem projetos nesta etapa
          </div>
        ) : null}
      </div>
    </section>
  )
}
