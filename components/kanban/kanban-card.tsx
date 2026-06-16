'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { Calendar, DollarSign } from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { type ProjectData } from '@/types'

interface KanbanCardProps {
  project: ProjectData
  isDragging?: boolean
}

export function KanbanCard({ project, isDragging }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isDelayed =
    project.estimatedEndDate &&
    new Date(project.estimatedEndDate) < new Date() &&
    project.stage !== 'COMPLETED'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-lg border border-[#E8E8E8] shadow-sm cursor-grab active:cursor-grabbing select-none',
        'hover:shadow-md hover:border-[#D9D9D9] transition-all duration-150',
        isSortableDragging && 'opacity-30',
        isDragging && 'shadow-2xl cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      <div className="p-3">
        {/* Status badge + delay */}
        <div className="flex items-center justify-between mb-2">
          <StatusBadge status={project.status} />
          {isDelayed && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
              Atrasado
            </span>
          )}
        </div>

        {/* Project name */}
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="text-sm font-semibold text-[#121212] hover:text-[#FF6B00] transition-colors line-clamp-2"
          onClick={(e) => e.stopPropagation()}
        >
          {project.name}
        </Link>

        {/* Client */}
        <p className="text-xs text-[#9E9E9E] mt-0.5 truncate">{project.client.name}</p>
        {project.room && (
          <p className="text-xs text-[#BDBDBD] truncate">{project.room}</p>
        )}

        {/* Footer info */}
        <div className="mt-2.5 pt-2.5 border-t border-[#F5F5F5] flex items-center justify-between gap-2">
          {project.estimatedEndDate && (
            <div className={cn('flex items-center gap-1 text-[10px]', isDelayed ? 'text-red-500' : 'text-[#9E9E9E]')}>
              <Calendar size={10} />
              {formatDate(project.estimatedEndDate)}
            </div>
          )}
          {project.value && (
            <div className="flex items-center gap-1 text-[10px] text-[#9E9E9E] ml-auto">
              <DollarSign size={10} />
              {formatCurrency(project.value)}
            </div>
          )}
        </div>

        {project.manager && (
          <div className="mt-2 flex items-center gap-1.5">
            <Avatar name={project.manager.name} size="xs" />
            <span className="text-[10px] text-[#9E9E9E] truncate">{project.manager.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}
