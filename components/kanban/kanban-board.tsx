'use client'

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, useCallback, useRef } from 'react'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import {
  PRODUCTION_STAGE_LABELS,
  PRODUCTION_STAGE_STATUS,
  type ProductionStage,
  type ProjectData,
} from '@/types'
import { useRouter } from 'next/navigation'

const STAGES: ProductionStage[] = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN',
  'CUTTING',
  'MANUFACTURING',
  'FINISHING',
  'QUALITY_CONTROL',
  'PACKAGING',
  'TRANSPORTATION',
  'INSTALLATION',
  'COMPLETED',
]

const STAGE_COLORS: Record<ProductionStage, string> = {
  PENDING_START: '#9E9E9E',
  MEASUREMENT: '#3B82F6',
  DESIGN: '#A855F7',
  CUTTING: '#F59E0B',
  MANUFACTURING: '#FF6B00',
  FINISHING: '#06B6D4',
  QUALITY_CONTROL: '#10B981',
  PACKAGING: '#8B5CF6',
  TRANSPORTATION: '#EC4899',
  INSTALLATION: '#6366F1',
  COMPLETED: '#22C55E',
}

interface KanbanBoardProps {
  initialProjects: ProjectData[]
}

function getDropStage(overId: string, projects: ProjectData[]) {
  const columnStage = STAGES.find((stage) => stage === overId)
  if (columnStage) return columnStage

  return projects.find((project) => project.id === overId)?.stage
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects)
  const [activeProject, setActiveProject] = useState<ProjectData | null>(null)
  const activeProjectRef = useRef<ProjectData | null>(null)
  const lastOverStageRef = useRef<ProductionStage | null>(null)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grouped = STAGES.reduce<Record<ProductionStage, ProjectData[]>>(
    (acc, stage) => {
      acc[stage] = projects.filter((p) => p.stage === stage)
      return acc
    },
    {} as Record<ProductionStage, ProjectData[]>
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const project = projects.find((p) => p.id === event.active.id)
    if (project) {
      activeProjectRef.current = project
      lastOverStageRef.current = project.stage
      setActiveProject(project)
    }
  }, [projects])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const overStage = getDropStage(overId, projects)
    if (!overStage) return

    lastOverStageRef.current = overStage
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeId
          ? { ...p, stage: overStage, status: PRODUCTION_STAGE_STATUS[overStage] }
          : p
      )
    )
  }, [projects])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    const draggedProject = activeProjectRef.current || activeProject
    setActiveProject(null)

    const activeId = active.id as string
    const overStage = over
      ? getDropStage(over.id as string, projects) || lastOverStageRef.current
      : lastOverStageRef.current

    activeProjectRef.current = null
    lastOverStageRef.current = null

    if (!overStage) {
      setProjects(initialProjects)
      return
    }

    const nextStatus = PRODUCTION_STAGE_STATUS[overStage]
    const sourceProject = draggedProject || projects.find((p) => p.id === activeId)
    if (!sourceProject || (sourceProject.stage === overStage && sourceProject.status === nextStatus)) return

    try {
      const response = await fetch(`/api/projects/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: overStage, status: nextStatus }),
      })
      if (!response.ok) throw new Error('Failed to update project')
      router.refresh()
    } catch {
      setProjects(initialProjects)
    }
  }, [activeProject, projects, initialProjects, router])

  const handleDragCancel = useCallback(() => {
    activeProjectRef.current = null
    lastOverStageRef.current = null
    setActiveProject(null)
    setProjects(initialProjects)
  }, [initialProjects])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none h-full">
        <SortableContext items={STAGES} strategy={horizontalListSortingStrategy}>
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              label={PRODUCTION_STAGE_LABELS[stage]}
              color={STAGE_COLORS[stage]}
              projects={grouped[stage]}
            />
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeProject && (
          <div className="rotate-2 opacity-95 shadow-xl">
            <KanbanCard project={activeProject} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
