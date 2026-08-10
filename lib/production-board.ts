import {
  normalizeProductionStage,
  PRODUCTION_STAGE_FLOW,
  type ProductionStage,
  type ProjectData,
} from '@/types'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const DUE_SOON_DAYS = 7

export type ProductionAttentionFilter =
  | 'ALL'
  | 'OVERDUE'
  | 'BLOCKED'
  | 'DUE_SOON'
  | 'NO_DEADLINE'

export type ProductionViewMode = 'BOARD' | 'ATTENTION' | 'LIST'

export type ProductionDeadlineKind = 'STAGE' | 'DELIVERY'

export type ProductionProjectState = {
  blocked: boolean
  completed: boolean
  deadline: string | null
  deadlineKind: ProductionDeadlineKind | null
  daysRemaining: number | null
  overdue: boolean
  dueSoon: boolean
  noDeadline: boolean
  needsAttention: boolean
}

function dateOnlyTimestamp(value: Date | string) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12).getTime()
  }

  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  if (year && month && day) return new Date(year, month - 1, day, 12).getTime()

  const parsed = new Date(value)
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12).getTime()
}

export function getProductionDeadline(project: ProjectData) {
  return getProductionDeadlineDetails(project).deadline
}

export function getProductionDeadlineDetails(project: ProjectData): {
  deadline: string | null
  kind: ProductionDeadlineKind | null
} {
  const stageDeadline = project.stageDeadlineDate || null
  const deliveryDeadline = project.deliveryDeadlineDate || project.estimatedEndDate || null

  if (!stageDeadline && !deliveryDeadline) return { deadline: null, kind: null }
  if (!stageDeadline) return { deadline: deliveryDeadline, kind: 'DELIVERY' }
  if (!deliveryDeadline) return { deadline: stageDeadline, kind: 'STAGE' }

  return dateOnlyTimestamp(stageDeadline) < dateOnlyTimestamp(deliveryDeadline)
    ? { deadline: stageDeadline, kind: 'STAGE' }
    : { deadline: deliveryDeadline, kind: 'DELIVERY' }
}

export function getProductionProjectState(
  project: ProjectData,
  now = new Date(),
): ProductionProjectState {
  const completed = normalizeProductionStage(project.stage) === 'COMPLETED'
  const deadlineDetails = getProductionDeadlineDetails(project)
  const deadline = deadlineDetails.deadline
  const daysRemaining = deadline
    ? Math.round((dateOnlyTimestamp(deadline) - dateOnlyTimestamp(now)) / DAY_IN_MS)
    : null
  const overdue = !completed && daysRemaining !== null && daysRemaining < 0
  const dueSoon =
    !completed &&
    daysRemaining !== null &&
    daysRemaining >= 0 &&
    daysRemaining <= DUE_SOON_DAYS
  const noDeadline = !completed && !deadline
  const blocked = !completed && Boolean(project.productionBlockedAt)

  return {
    blocked,
    completed,
    deadline,
    deadlineKind: deadlineDetails.kind,
    daysRemaining,
    overdue,
    dueSoon,
    noDeadline,
    needsAttention: blocked || overdue || dueSoon || noDeadline,
  }
}

function attentionRank(state: ProductionProjectState) {
  if (state.blocked) return 0
  if (state.overdue) return 1
  if (state.dueSoon) return 2
  if (state.noDeadline) return 3
  if (state.completed) return 5
  return 4
}

export function compareProductionProjects(
  left: ProjectData,
  right: ProjectData,
  now = new Date(),
) {
  const leftState = getProductionProjectState(left, now)
  const rightState = getProductionProjectState(right, now)
  const rankDifference = attentionRank(leftState) - attentionRank(rightState)
  if (rankDifference !== 0) return rankDifference

  if (leftState.daysRemaining !== null || rightState.daysRemaining !== null) {
    if (leftState.daysRemaining === null) return 1
    if (rightState.daysRemaining === null) return -1
    if (leftState.daysRemaining !== rightState.daysRemaining) {
      return leftState.daysRemaining - rightState.daysRemaining
    }
  }

  return left.client.name.localeCompare(right.client.name, 'pt-BR')
}

export function matchesProductionAttention(
  project: ProjectData,
  filter: ProductionAttentionFilter,
  now = new Date(),
) {
  if (filter === 'ALL') return true
  const state = getProductionProjectState(project, now)
  if (filter === 'OVERDUE') return state.overdue
  if (filter === 'BLOCKED') return state.blocked
  if (filter === 'DUE_SOON') return state.dueSoon
  return state.noDeadline
}

function productionStageIndex(stage: ProductionStage) {
  return PRODUCTION_STAGE_FLOW.indexOf(normalizeProductionStage(stage))
}

export function getAdjacentProductionStage(
  stage: ProductionStage,
  direction: -1 | 1,
) {
  const currentIndex = productionStageIndex(stage)
  const nextIndex = currentIndex + direction
  return nextIndex >= 0 && nextIndex < PRODUCTION_STAGE_FLOW.length
    ? PRODUCTION_STAGE_FLOW[nextIndex]
    : null
}

export function isProductionStageSkip(from: ProductionStage, to: ProductionStage) {
  return Math.abs(productionStageIndex(from) - productionStageIndex(to)) > 1
}

export function productionDeadlineLabel(state: ProductionProjectState) {
  if (state.completed) return 'Concluído'
  if (state.daysRemaining === null) return 'Sem prazo'
  if (state.daysRemaining < 0) {
    const lateDays = Math.abs(state.daysRemaining)
    return `Atrasado há ${lateDays} dia${lateDays === 1 ? '' : 's'}`
  }
  if (state.daysRemaining === 0) return 'Prazo hoje'
  return `${state.daysRemaining} dia${state.daysRemaining === 1 ? '' : 's'} restante${state.daysRemaining === 1 ? '' : 's'}`
}

export function productionDeadlineDateLabel(state: ProductionProjectState) {
  if (state.deadlineKind === 'STAGE') return 'Etapa'
  if (state.deadlineKind === 'DELIVERY') return 'Entrega'
  return 'Prazo'
}
