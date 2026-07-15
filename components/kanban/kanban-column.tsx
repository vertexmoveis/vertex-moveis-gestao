'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { KanbanCard } from './kanban-card'
import { type ProductionStage, type ProjectData } from '@/types'

interface KanbanColumnProps {
  stage: ProductionStage
  label: string
  color: string
  projects: ProjectData[]
}

export function KanbanColumn({ stage, label, color, projects }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div className="flex min-w-[260px] flex-1 flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
        style={{ background: color + '18' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-xs font-semibold text-[#121212]">{label}</span>
        </div>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-md"
          style={{ background: color + '30', color }}
        >
          {projects.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[480px] p-2 rounded-b-xl space-y-2 transition-all duration-150',
          isOver
            ? 'bg-orange-50 border-2 border-dashed border-orange-200'
            : 'bg-[#F0F0F0]'
        )}
      >
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <KanbanCard key={project.id} project={project} />
          ))}
        </SortableContext>

        {projects.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 text-[#BDBDBD] text-xs text-center">
            Arraste projetos aqui
          </div>
        )}
      </div>
    </div>
  )
}
