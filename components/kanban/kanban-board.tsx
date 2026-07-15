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
import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_LABELS,
  PRODUCTION_STAGE_STATUS,
  type ProductionStage,
  type ProjectData,
} from '@/types'
import { useRouter } from 'next/navigation'

const STAGES = PRODUCTION_STAGE_FLOW

const STAGE_COLORS: Record<ProductionStage, string> = {
  PENDING_START: '#9E9E9E',
  MEASUREMENT: '#3B82F6',
  DESIGN: '#A855F7',
  PROJECT_READY: '#8B5CF6',
  PRODUCTION: '#FF6B00',
  TRANSPORTATION: '#6366F1',
  INSTALLATION: '#6366F1',
  COMPLETED: '#22C55E',
}

interface KanbanBoardProps {
  initialProjects: ProjectData[]
}

function getDropStage(overId: string, projects: ProjectData[]) {
  const columnStage = STAGES.find((stage) => stage === overId)
  if (columnStage) return columnStage

  const projectStage = projects.find((project) => project.id === overId)?.stage
  return projectStage ? normalizeProductionStage(projectStage) : undefined
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects)
  const [activeProject, setActiveProject] = useState<ProjectData | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeProjectRef = useRef<ProjectData | null>(null)
  const lastOverStageRef = useRef<ProductionStage | null>(null)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grouped = STAGES.reduce<Record<ProductionStage, ProjectData[]>>(
    (acc, stage) => {
      acc[stage] = projects.filter((p) => normalizeProductionStage(p.stage) === stage)
      return acc
    },
    {} as Record<ProductionStage, ProjectData[]>
  )

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current
    if (!node) return

    const maxScroll = node.scrollWidth - node.clientWidth
    setCanScrollLeft(node.scrollLeft > 4)
    setCanScrollRight(node.scrollLeft < maxScroll - 4)
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const frame = window.requestAnimationFrame(updateScrollState)
    node.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      window.cancelAnimationFrame(frame)
      node.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState])

  const scrollBoard = useCallback((direction: 'left' | 'right') => {
    const node = scrollRef.current
    if (!node) return

    node.scrollBy({
      left: direction === 'left' ? -node.clientWidth * 0.75 : node.clientWidth * 0.75,
      behavior: 'smooth',
    })
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const node = scrollRef.current
    if (!node || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

    event.preventDefault()
    node.scrollLeft += event.deltaY
    updateScrollState()
  }, [updateScrollState])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const project = projects.find((p) => p.id === event.active.id)
    if (project) {
      activeProjectRef.current = project
      lastOverStageRef.current = normalizeProductionStage(project.stage)
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
      <div className="relative h-full">
        <button
          type="button"
          aria-label="Voltar colunas"
          title="Voltar"
          disabled={!canScrollLeft}
          onClick={() => scrollBoard('left')}
          className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E8E8E8] bg-white shadow-md transition-all hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft size={18} className="text-[#121212]" />
        </button>

        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="h-full overflow-x-auto overflow-y-hidden scroll-smooth pb-4 pr-2"
        >
          <div className="flex h-full min-w-max gap-3">
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
        </div>

        <button
          type="button"
          aria-label="Avançar colunas"
          title="Avançar"
          disabled={!canScrollRight}
          onClick={() => scrollBoard('right')}
          className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E8E8E8] bg-white shadow-md transition-all hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight size={18} className="text-[#121212]" />
        </button>
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
