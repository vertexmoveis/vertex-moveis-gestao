'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  LockKeyhole,
  Search,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { ProductionList } from './production-list'
import { cn } from '@/lib/utils'
import {
  compareProductionProjects,
  getAdjacentProductionStage,
  getProductionProjectState,
  isProductionStageSkip,
  matchesProductionAttention,
  type ProductionAttentionFilter,
  type ProductionViewMode,
} from '@/lib/production-board'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_LABELS,
  PRODUCTION_STAGE_STATUS,
  type ProductionStage,
  type ProjectData,
  type ProjectStatus,
} from '@/types'

const STAGES = PRODUCTION_STAGE_FLOW

const STAGE_COLORS: Record<ProductionStage, string> = {
  PENDING_START: '#888888',
  MEASUREMENT: '#2563EB',
  DESIGN: '#9333EA',
  PROJECT_READY: '#7C3AED',
  PRODUCTION: '#F05A00',
  TRANSPORTATION: '#4F46E5',
  INSTALLATION: '#4F46E5',
  COMPLETED: '#16A34A',
}

type ProjectPatch = {
  stage?: ProductionStage
  status?: ProjectStatus
  productionBlocked?: boolean
  productionBlockReason?: string | null
  stageDeadlineDate?: string | null
}

type ActionDialog =
  | { type: 'MOVE'; project: ProjectData; targetStage: ProductionStage }
  | { type: 'BLOCK'; project: ProjectData; reason: string }
  | { type: 'DEADLINE'; project: ProjectData; deadline: string }

type Notice = { type: 'success' | 'error'; text: string } | null

interface KanbanBoardProps {
  initialProjects: ProjectData[]
  referenceDate: string
}

function getDropStage(overId: string, projects: ProjectData[]) {
  const columnStage = STAGES.find((stage) => stage === overId)
  if (columnStage) return columnStage

  const projectStage = projects.find((project) => project.id === overId)?.stage
  return projectStage ? normalizeProductionStage(projectStage) : undefined
}

function projectSearchValue(project: ProjectData) {
  return [
    project.name,
    project.client.name,
    project.room,
    project.manager?.name,
    ...(project.environments?.map((environment) => environment.name) || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR')
}

function optimisticProject(project: ProjectData, patch: ProjectPatch) {
  const next = { ...project }
  if (patch.stage) {
    next.stage = normalizeProductionStage(patch.stage)
    next.status = patch.status || PRODUCTION_STAGE_STATUS[next.stage]
    if (next.stage !== normalizeProductionStage(project.stage) && patch.productionBlocked === undefined) {
      next.productionBlockedAt = null
      next.productionBlockReason = null
    }
  } else if (patch.status) {
    next.status = patch.status
  }

  if (patch.productionBlocked !== undefined) {
    next.productionBlockedAt = patch.productionBlocked ? project.productionBlockedAt || new Date().toISOString() : null
    next.productionBlockReason = patch.productionBlocked ? patch.productionBlockReason || null : null
  }
  if (patch.stageDeadlineDate !== undefined) {
    next.stageDeadlineDate = patch.stageDeadlineDate
  }
  return next
}

export function KanbanBoard({ initialProjects, referenceDate }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects)
  const [activeProject, setActiveProject] = useState<ProjectData | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [managerId, setManagerId] = useState('ALL')
  const [attentionFilter, setAttentionFilter] = useState<ProductionAttentionFilter>('ALL')
  const [viewMode, setViewMode] = useState<ProductionViewMode>('BOARD')
  const [showEmptyStages, setShowEmptyStages] = useState(false)
  const [dialog, setDialog] = useState<ActionDialog | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeProjectRef = useRef<ProjectData | null>(null)
  const lastOverStageRef = useRef<ProductionStage | null>(null)
  const today = useMemo(() => new Date(referenceDate), [referenceDate])
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!dialog) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDialog(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dialog])

  const managers = useMemo(() => {
    const unique = new Map<string, string>()
    for (const project of projects) {
      if (project.manager) unique.set(project.manager.id, project.manager.name)
    }
    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [projects])

  const baseFilteredProjects = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase('pt-BR')
    return projects.filter((project) => {
      if (managerId !== 'ALL' && project.manager?.id !== managerId) return false
      return !normalizedQuery || projectSearchValue(project).includes(normalizedQuery)
    })
  }, [deferredQuery, managerId, projects])

  const stats = useMemo(() => {
    return baseFilteredProjects.reduce(
      (result, project) => {
        const state = getProductionProjectState(project, today)
        if (state.overdue) result.overdue += 1
        if (state.blocked) result.blocked += 1
        if (state.dueSoon) result.dueSoon += 1
        if (state.noDeadline) result.noDeadline += 1
        return result
      },
      { overdue: 0, blocked: 0, dueSoon: 0, noDeadline: 0 },
    )
  }, [baseFilteredProjects, today])

  const visibleProjects = useMemo(() => {
    return baseFilteredProjects
      .filter((project) => matchesProductionAttention(project, attentionFilter, today))
      .filter((project) => viewMode !== 'ATTENTION' || getProductionProjectState(project, today).needsAttention)
      .sort((left, right) => compareProductionProjects(left, right, today))
  }, [attentionFilter, baseFilteredProjects, today, viewMode])

  const grouped = useMemo(() => {
    return STAGES.reduce<Record<ProductionStage, ProjectData[]>>(
      (result, stage) => {
        result[stage] = visibleProjects.filter((project) => normalizeProductionStage(project.stage) === stage)
        return result
      },
      {} as Record<ProductionStage, ProjectData[]>,
    )
  }, [visibleProjects])

  const visibleStages = useMemo(
    () => showEmptyStages ? STAGES : STAGES.filter((stage) => grouped[stage].length > 0),
    [grouped, showEmptyStages],
  )
  const hiddenStageCount = STAGES.length - visibleStages.length

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
  }, [updateScrollState, visibleStages.length, viewMode])

  const scrollBoard = useCallback((direction: 'left' | 'right') => {
    const node = scrollRef.current
    if (!node) return
    node.scrollBy({
      left: direction === 'left' ? -node.clientWidth * 0.8 : node.clientWidth * 0.8,
      behavior: 'smooth',
    })
  }, [])

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const node = scrollRef.current
    if (!node || Math.abs(event.deltaY) <= Math.abs(event.deltaX) || node.scrollWidth <= node.clientWidth) return
    event.preventDefault()
    node.scrollLeft += event.deltaY
    updateScrollState()
  }, [updateScrollState])

  const persistProjectPatch = useCallback(async (
    sourceProject: ProjectData,
    patch: ProjectPatch,
    successMessage: string,
  ) => {
    if (pendingIds.has(sourceProject.id)) return
    const previous = { ...sourceProject }
    const optimistic = optimisticProject(sourceProject, patch)
    setPendingIds((current) => new Set(current).add(sourceProject.id))
    setProjects((current) => current.map((project) => project.id === sourceProject.id ? optimistic : project))
    setNotice(null)

    try {
      const response = await fetch(`/api/projects/${sourceProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível atualizar o projeto.')
      }

      setProjects((current) => current.map((project) => (
        project.id === sourceProject.id
          ? {
              ...project,
              stage: payload.stage || project.stage,
              status: payload.status || project.status,
              productionBlockedAt: payload.productionBlockedAt,
              productionBlockReason: payload.productionBlockReason,
              stageDeadlineDate: payload.stageDeadlineDate,
              actualEndDate: payload.actualEndDate || project.actualEndDate,
            }
          : project
      )))
      setNotice({ type: 'success', text: successMessage })
      router.refresh()
    } catch (error) {
      setProjects((current) => current.map((project) => project.id === previous.id ? previous : project))
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível atualizar o projeto.',
      })
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(sourceProject.id)
        return next
      })
    }
  }, [pendingIds, router])

  const requestStageMove = useCallback((project: ProjectData, targetStage: ProductionStage) => {
    const latest = projects.find((item) => item.id === project.id) || project
    const currentStage = normalizeProductionStage(latest.stage)
    if (currentStage === targetStage) return
    if (isProductionStageSkip(currentStage, targetStage)) {
      setDialog({ type: 'MOVE', project: latest, targetStage })
      return
    }
    void persistProjectPatch(
      latest,
      { stage: targetStage, status: PRODUCTION_STAGE_STATUS[targetStage] },
      `${latest.name} avançou para ${PRODUCTION_STAGE_LABELS[targetStage]}.`,
    )
  }, [persistProjectPatch, projects])

  const handleMove = useCallback((project: ProjectData, direction: -1 | 1) => {
    const latest = projects.find((item) => item.id === project.id) || project
    const targetStage = getAdjacentProductionStage(latest.stage, direction)
    if (targetStage) requestStageMove(latest, targetStage)
  }, [projects, requestStageMove])

  const handleToggleBlock = useCallback((project: ProjectData) => {
    const latest = projects.find((item) => item.id === project.id) || project
    if (latest.productionBlockedAt) {
      void persistProjectPatch(
        latest,
        { productionBlocked: false, productionBlockReason: null },
        `Produção de ${latest.name} desbloqueada.`,
      )
      return
    }
    setDialog({ type: 'BLOCK', project: latest, reason: '' })
  }, [persistProjectPatch, projects])

  const handleEditDeadline = useCallback((project: ProjectData) => {
    const latest = projects.find((item) => item.id === project.id) || project
    setDialog({
      type: 'DEADLINE',
      project: latest,
      deadline: latest.stageDeadlineDate?.slice(0, 10) || '',
    })
  }, [projects])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const project = projects.find((item) => item.id === event.active.id)
    if (!project || pendingIds.has(project.id)) return
    activeProjectRef.current = { ...project }
    lastOverStageRef.current = normalizeProductionStage(project.stage)
    setActiveProject(project)
  }, [pendingIds, projects])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overStage = getDropStage(over.id as string, projects)
    if (!overStage) return

    lastOverStageRef.current = overStage
    setProjects((current) => current.map((project) => (
      project.id === activeId
        ? { ...project, stage: overStage, status: PRODUCTION_STAGE_STATUS[overStage] }
        : project
    )))
  }, [projects])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const sourceProject = activeProjectRef.current
    const targetStage = event.over
      ? getDropStage(event.over.id as string, projects) || lastOverStageRef.current
      : lastOverStageRef.current

    activeProjectRef.current = null
    lastOverStageRef.current = null
    setActiveProject(null)

    if (!sourceProject || !targetStage) {
      if (sourceProject) {
        setProjects((current) => current.map((project) => project.id === sourceProject.id ? sourceProject : project))
      }
      return
    }

    const sourceStage = normalizeProductionStage(sourceProject.stage)
    if (sourceStage === targetStage) {
      setProjects((current) => current.map((project) => project.id === sourceProject.id ? sourceProject : project))
      return
    }

    if (isProductionStageSkip(sourceStage, targetStage)) {
      setProjects((current) => current.map((project) => project.id === sourceProject.id ? sourceProject : project))
      setDialog({ type: 'MOVE', project: sourceProject, targetStage })
      return
    }

    void persistProjectPatch(
      sourceProject,
      { stage: targetStage, status: PRODUCTION_STAGE_STATUS[targetStage] },
      `${sourceProject.name} avançou para ${PRODUCTION_STAGE_LABELS[targetStage]}.`,
    )
  }, [persistProjectPatch, projects])

  const handleDragCancel = useCallback(() => {
    const sourceProject = activeProjectRef.current
    if (sourceProject) {
      setProjects((current) => current.map((project) => project.id === sourceProject.id ? sourceProject : project))
    }
    activeProjectRef.current = null
    lastOverStageRef.current = null
    setActiveProject(null)
  }, [])

  const submitDialog = () => {
    if (!dialog) return
    if (dialog.type === 'MOVE') {
      const { project, targetStage } = dialog
      setDialog(null)
      void persistProjectPatch(
        project,
        { stage: targetStage, status: PRODUCTION_STAGE_STATUS[targetStage] },
        `${project.name} foi movido para ${PRODUCTION_STAGE_LABELS[targetStage]}.`,
      )
      return
    }
    if (dialog.type === 'BLOCK') {
      const reason = dialog.reason.trim()
      if (!reason) return
      const { project } = dialog
      setDialog(null)
      void persistProjectPatch(
        project,
        { productionBlocked: true, productionBlockReason: reason },
        `Bloqueio registrado em ${project.name}.`,
      )
      return
    }

    const { project, deadline } = dialog
    setDialog(null)
    void persistProjectPatch(
      project,
      { stageDeadlineDate: deadline || null },
      deadline ? `Prazo de ${project.name} atualizado.` : `Prazo de ${project.name} removido.`,
    )
  }

  const setMetricFilter = (filter: ProductionAttentionFilter) => {
    setAttentionFilter((current) => current === filter ? 'ALL' : filter)
  }

  const clearFilters = () => {
    setQuery('')
    setManagerId('ALL')
    setAttentionFilter('ALL')
  }

  const renderBoard = () => {
    if (visibleStages.length === 0) return null
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            aria-label="Voltar colunas"
            title="Voltar colunas"
            disabled={!canScrollLeft}
            onClick={() => scrollBoard('left')}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E0E0E0] bg-white shadow-md transition-all hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={scrollRef}
            onWheel={handleWheel}
            className="h-full overflow-x-auto overflow-y-hidden scroll-smooth pb-2"
          >
            <div className={cn(
              'flex h-full min-w-max gap-3',
              visibleStages.length <= 4 && 'min-w-full',
            )}>
              {visibleStages.map((stage) => {
                const stageStates = grouped[stage].map((project) => getProductionProjectState(project, today))
                return (
                  <KanbanColumn
                    key={stage}
                    stage={stage}
                    label={PRODUCTION_STAGE_LABELS[stage]}
                    color={STAGE_COLORS[stage]}
                    projects={grouped[stage]}
                    referenceDate={today}
                    overdueCount={stageStates.filter((state) => state.overdue).length}
                    blockedCount={stageStates.filter((state) => state.blocked).length}
                    pendingIds={pendingIds}
                    onMove={handleMove}
                    onToggleBlock={handleToggleBlock}
                    onEditDeadline={handleEditDeadline}
                  />
                )
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Avançar colunas"
            title="Avançar colunas"
            disabled={!canScrollRight}
            onClick={() => scrollBoard('right')}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E0E0E0] bg-white shadow-md transition-all hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <DragOverlay>
          {activeProject ? (
            <div className="w-[285px]">
              <KanbanCard project={activeProject} referenceDate={today} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricButton
          label="Atrasados"
          value={stats.overdue}
          icon={AlertTriangle}
          active={attentionFilter === 'OVERDUE'}
          tone="red"
          onClick={() => setMetricFilter('OVERDUE')}
        />
        <MetricButton
          label="Bloqueados"
          value={stats.blocked}
          icon={LockKeyhole}
          active={attentionFilter === 'BLOCKED'}
          tone="amber"
          onClick={() => setMetricFilter('BLOCKED')}
        />
        <MetricButton
          label="Próximos 7 dias"
          value={stats.dueSoon}
          icon={CalendarClock}
          active={attentionFilter === 'DUE_SOON'}
          tone="blue"
          onClick={() => setMetricFilter('DUE_SOON')}
        />
        <MetricButton
          label="Sem prazo"
          value={stats.noDeadline}
          icon={CalendarClock}
          active={attentionFilter === 'NO_DEADLINE'}
          tone="gray"
          onClick={() => setMetricFilter('NO_DEADLINE')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-[#E8E8E8] bg-white py-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar projeto, cliente ou ambiente"
            className="h-9 w-full border border-[#D9D9D9] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#FF6B00]"
          />
        </label>

        {managers.length > 1 ? (
          <select
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            aria-label="Filtrar por responsável"
            className="h-9 min-w-[170px] border border-[#D9D9D9] bg-white px-3 text-xs outline-none focus:border-[#FF6B00]"
          >
            <option value="ALL">Todos os responsáveis</option>
            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
          </select>
        ) : null}

        <div className="flex h-9 border border-[#D9D9D9] bg-white p-0.5" role="group" aria-label="Modo de visualização">
          <ViewButton icon={LayoutGrid} label="Quadro" active={viewMode === 'BOARD'} onClick={() => setViewMode('BOARD')} />
          <ViewButton icon={AlertTriangle} label="Atenção" active={viewMode === 'ATTENTION'} onClick={() => setViewMode('ATTENTION')} />
          <ViewButton icon={List} label="Lista" active={viewMode === 'LIST'} onClick={() => setViewMode('LIST')} />
        </div>

        {viewMode === 'BOARD' ? (
          <label className="flex h-9 cursor-pointer items-center gap-2 border border-[#D9D9D9] bg-white px-3 text-xs font-semibold text-[#555] hover:bg-[#FAFAFA]">
            <input
              type="checkbox"
              checked={showEmptyStages}
              onChange={(event) => setShowEmptyStages(event.target.checked)}
              className="sr-only"
            />
            {showEmptyStages ? <Eye size={14} /> : <EyeOff size={14} />}
            {showEmptyStages ? 'Ocultar vazias' : `Exibir vazias${hiddenStageCount > 0 ? ` (${hiddenStageCount})` : ''}`}
          </label>
        ) : null}

        {(query || managerId !== 'ALL' || attentionFilter !== 'ALL') ? (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-9 items-center gap-1.5 px-2 text-xs font-semibold text-[#666] hover:text-[#FF6B00]"
          >
            <X size={14} /> Limpar
          </button>
        ) : null}
      </div>

      {notice ? (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-center justify-between border px-3 py-2 text-xs font-semibold',
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar mensagem"><X size={14} /></button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {visibleProjects.length === 0 ? (
          <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center border border-dashed border-[#D9D9D9] bg-[#FAFAFA] text-center">
            <Search size={22} className="mb-3 text-[#AAA]" />
            <p className="text-sm font-semibold text-[#333]">Nenhum projeto encontrado</p>
            <button type="button" onClick={clearFilters} className="mt-3 text-xs font-semibold text-[#FF6B00]">
              Limpar filtros
            </button>
          </div>
        ) : viewMode === 'BOARD' ? (
          renderBoard()
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <ProductionList
              projects={visibleProjects}
              referenceDate={today}
              pendingIds={pendingIds}
              onMove={handleMove}
              onToggleBlock={handleToggleBlock}
              onEditDeadline={handleEditDeadline}
            />
          </div>
        )}
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onMouseDown={() => setDialog(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="production-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md border border-[#E0E0E0] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E8E8E8] px-5 py-4">
              <h2 id="production-dialog-title" className="text-base font-semibold text-[#121212]">
                {dialog.type === 'MOVE'
                  ? 'Confirmar mudança de etapa'
                  : dialog.type === 'BLOCK'
                    ? 'Registrar bloqueio'
                    : 'Prazo da etapa'}
              </h2>
              <button type="button" onClick={() => setDialog(null)} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center hover:bg-[#F5F5F5]">
                <X size={17} />
              </button>
            </div>

            <div className="px-5 py-4">
              {dialog.type === 'MOVE' ? (
                <p className="text-sm leading-6 text-[#555]">
                  Mover <strong className="text-[#121212]">{dialog.project.name}</strong> de{' '}
                  <strong className="text-[#121212]">{PRODUCTION_STAGE_LABELS[normalizeProductionStage(dialog.project.stage)]}</strong>{' '}
                  diretamente para <strong className="text-[#121212]">{PRODUCTION_STAGE_LABELS[dialog.targetStage]}</strong>?
                </p>
              ) : null}

              {dialog.type === 'BLOCK' ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#444]">Motivo do bloqueio</span>
                  <textarea
                    value={dialog.reason}
                    onChange={(event) => setDialog({ ...dialog, reason: event.target.value })}
                    rows={4}
                    maxLength={500}
                    autoFocus
                    placeholder="Ex.: aguardando confirmação do cliente"
                    className="w-full resize-none border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#FF6B00]"
                  />
                </label>
              ) : null}

              {dialog.type === 'DEADLINE' ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#444]">Prazo de {dialog.project.name}</span>
                  <input
                    type="date"
                    value={dialog.deadline}
                    onChange={(event) => setDialog({ ...dialog, deadline: event.target.value })}
                    autoFocus
                    className="h-10 w-full border border-[#D9D9D9] px-3 text-sm outline-none focus:border-[#FF6B00]"
                  />
                </label>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E8E8E8] px-5 py-3">
              <button type="button" onClick={() => setDialog(null)} className="h-9 border border-[#D9D9D9] px-4 text-xs font-semibold text-[#555] hover:bg-[#F5F5F5]">
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitDialog}
                disabled={dialog.type === 'BLOCK' && !dialog.reason.trim()}
                className="flex h-9 items-center gap-2 bg-[#FF6B00] px-4 text-xs font-semibold text-white hover:bg-[#E85F00] disabled:opacity-40"
              >
                <Check size={14} />
                {dialog.type === 'BLOCK' ? 'Registrar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetricButton({
  label,
  value,
  icon: Icon,
  active,
  tone,
  onClick,
}: {
  label: string
  value: number
  icon: typeof AlertTriangle
  active: boolean
  tone: 'red' | 'amber' | 'blue' | 'gray'
  onClick: () => void
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    gray: 'border-[#DEDEDE] bg-[#F7F7F7] text-[#555]',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-[52px] items-center justify-between border px-3 py-2 text-left transition-all hover:brightness-[0.98]',
        tones[tone],
        active && 'ring-2 ring-[#FF6B00] ring-offset-1',
      )}
    >
      <span className="flex items-center gap-2 text-xs font-semibold"><Icon size={15} /> {label}</span>
      <span className="text-lg font-bold">{value}</span>
    </button>
  )
}

function ViewButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutGrid
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-full items-center gap-1.5 px-2.5 text-xs font-semibold',
        active ? 'bg-[#121212] text-white' : 'text-[#666] hover:bg-[#F5F5F5]',
      )}
    >
      <Icon size={14} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}
