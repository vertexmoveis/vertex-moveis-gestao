import { PRODUCTION_STAGE_FLOW, PRODUCTION_STAGE_LABELS, type ProductionStage, type ProjectEnvironmentStatus } from '@/types'

export type EnvironmentWorkflowInput = { status: string; workflowStage?: string | null }
export function isEnvironmentWorkflowStage(value: unknown): value is ProductionStage {
  return typeof value === 'string' && PRODUCTION_STAGE_FLOW.includes(value as ProductionStage)
}
export function getEnvironmentWorkflowStage(environment: EnvironmentWorkflowInput): ProductionStage | null {
  if (isEnvironmentWorkflowStage(environment.workflowStage)) return environment.workflowStage
  if (environment.status === 'IN_PROGRESS') return 'PRODUCTION'
  if (environment.status === 'READY') return 'PRODUCTION_READY'
  if (environment.status === 'INSTALLED' || environment.status === 'COMPLETED') return 'COMPLETED'
  return null
}
export function environmentWorkflowLabel(environment: EnvironmentWorkflowInput): string {
  const stage = getEnvironmentWorkflowStage(environment)
  return stage ? PRODUCTION_STAGE_LABELS[stage] : 'Etapa a definir'
}
export function environmentStatusForStage(stage: ProductionStage): ProjectEnvironmentStatus {
  if (stage === 'COMPLETED') return 'COMPLETED'
  if (stage === 'PRODUCTION_READY' || stage === 'TRANSPORTATION' || stage === 'INSTALLATION') return 'READY'
  if (stage === 'PRODUCTION') return 'IN_PROGRESS'
  return 'PENDING'
}
export function environmentWorkflowTone(environment: EnvironmentWorkflowInput): string {
  const stage = getEnvironmentWorkflowStage(environment)
  if (stage === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (stage === 'PRODUCTION') return 'bg-orange-50 text-orange-700'
  if (stage === 'PRODUCTION_READY') return 'bg-teal-50 text-teal-700'
  if (stage === 'TRANSPORTATION' || stage === 'INSTALLATION') return 'bg-blue-50 text-blue-700'
  return stage ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600'
}
export function environmentWorkflowSummary(environments: EnvironmentWorkflowInput[]): string {
  const counts = new Map<string, number>()
  for (const environment of environments) {
    const label = environmentWorkflowLabel(environment)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(' · ')
}
