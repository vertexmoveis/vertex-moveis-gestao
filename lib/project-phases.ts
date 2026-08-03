import type { ProductionStage, ProjectEnvironmentStatus } from '@/types'
import {
  getProjectContractReadiness,
  getProjectFinancialReadiness,
  type ProjectContractWorkflowStatus,
  type ProjectWorkflowPayment,
} from '@/lib/project-workflow'

export const PROJECT_MACRO_PHASES = [
  'PREPARATION',
  'PRODUCTION',
  'DELIVERY',
  'COMPLETED',
] as const

export type ProjectMacroPhase = typeof PROJECT_MACRO_PHASES[number]

export const PROJECT_MACRO_PHASE_LABELS: Record<ProjectMacroPhase, string> = {
  PREPARATION: 'Preparação',
  PRODUCTION: 'Em produção',
  DELIVERY: 'Entrega e instalação',
  COMPLETED: 'Finalizado',
}

export const PROJECT_MACRO_PHASE_DESCRIPTIONS: Record<ProjectMacroPhase, string> = {
  PREPARATION: 'Medição, projeto técnico, aprovação e pagamento.',
  PRODUCTION: 'Fabricação por ambiente, materiais e custos reais.',
  DELIVERY: 'Agendamento, transporte, instalação e conferência.',
  COMPLETED: 'Resultado final, garantia e pós-venda.',
}

export const PROJECT_MACRO_PHASE_TARGET_STAGE: Partial<Record<ProjectMacroPhase, ProductionStage>> = {
  PREPARATION: 'PRODUCTION',
  PRODUCTION: 'INSTALLATION',
  DELIVERY: 'COMPLETED',
}

export type ProjectPhaseTask = {
  key: string
  label: string
  completed: boolean
  required: boolean
}

export type ProjectPhaseInput = {
  stage: ProductionStage
  createdAt: string
  approvalDate?: string | null
  paymentConfirmedAt?: string | null
  downPayment?: number | null
  financialReady?: boolean
  contractStatus?: ProjectContractWorkflowStatus | null
  contractViewedAt?: string | null
  contractRevisionRequiredAt?: string | null
  productionBlockedAt?: string | null
  environments: { status: ProjectEnvironmentStatus }[]
  files: { category: string }[]
  payments: ProjectWorkflowPayment[]
  clientPhone?: string | null
  postSaleContactedAt?: string | null
}

const PREPARATION_STAGES: ProductionStage[] = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN',
  'PROJECT_READY',
]

const READY_FOR_INSTALLATION: ProjectEnvironmentStatus[] = ['READY', 'INSTALLED', 'COMPLETED']
const INSTALLED_ENVIRONMENTS: ProjectEnvironmentStatus[] = ['INSTALLED', 'COMPLETED']

export function getProjectMacroPhase(stage: ProductionStage): ProjectMacroPhase {
  if (PREPARATION_STAGES.includes(stage)) return 'PREPARATION'
  if (stage === 'PRODUCTION') return 'PRODUCTION'
  if (stage === 'COMPLETED') return 'COMPLETED'
  return 'DELIVERY'
}

export function getProjectMacroPhaseIndex(phase: ProjectMacroPhase) {
  return PROJECT_MACRO_PHASES.indexOf(phase)
}

function hasFile(input: ProjectPhaseInput, category: string) {
  return input.files.some((file) => file.category === category)
}

function hasEnvironments(input: ProjectPhaseInput) {
  return input.environments.length > 0
}

function allEnvironmentsMatch(input: ProjectPhaseInput, statuses: ProjectEnvironmentStatus[]) {
  return hasEnvironments(input) && input.environments.every((environment) => statuses.includes(environment.status))
}

export function getProjectPhaseTasks(input: ProjectPhaseInput, phase: ProjectMacroPhase): ProjectPhaseTask[] {
  if (phase === 'PREPARATION') {
    const financial = getProjectFinancialReadiness({
      paymentConfirmedAt: input.paymentConfirmedAt,
      downPayment: input.downPayment,
      payments: input.payments,
    })
    const contract = getProjectContractReadiness({
      createdAt: input.createdAt,
      contractStatus: input.contractStatus,
      viewedAt: input.contractViewedAt,
      revisionRequiredAt: input.contractRevisionRequiredAt,
    })

    return [
      { key: 'environments', label: 'Ambientes cadastrados', completed: hasEnvironments(input), required: true },
      { key: 'measurement', label: 'Medição anexada', completed: hasFile(input, 'MEASUREMENT'), required: true },
      { key: 'technical-project', label: 'Projeto técnico anexado', completed: hasFile(input, 'TECHNICAL_PROJECT'), required: true },
      { key: 'approval', label: 'Aprovação do cliente registrada', completed: Boolean(input.approvalDate), required: true },
      {
        key: 'payment',
        label: financial.label,
        completed: input.financialReady ?? financial.ready,
        required: true,
      },
      {
        key: 'contract',
        label: contract.label,
        completed: contract.ready,
        required: contract.required,
      },
    ]
  }

  if (phase === 'PRODUCTION') {
    return [
      { key: 'environments', label: 'Ambientes cadastrados', completed: hasEnvironments(input), required: true },
      { key: 'unblocked', label: 'Produção sem impedimentos', completed: !input.productionBlockedAt, required: true },
      {
        key: 'ready',
        label: 'Todos os ambientes prontos para instalar',
        completed: allEnvironmentsMatch(input, READY_FOR_INSTALLATION),
        required: true,
      },
      { key: 'production-files', label: 'Fotos da fabricação anexadas', completed: hasFile(input, 'PRODUCTION'), required: false },
    ]
  }

  if (phase === 'DELIVERY') {
    return [
      { key: 'contact', label: 'WhatsApp do cliente disponível', completed: Boolean(input.clientPhone), required: true },
      {
        key: 'installed',
        label: 'Todos os ambientes instalados e conferidos',
        completed: allEnvironmentsMatch(input, INSTALLED_ENVIRONMENTS),
        required: true,
      },
      {
        key: 'final-files',
        label: 'Fotos da instalação ou entrega anexadas',
        completed: hasFile(input, 'INSTALLATION') || hasFile(input, 'DELIVERY'),
        required: false,
      },
    ]
  }

  return [
    { key: 'completed', label: 'Projeto concluído', completed: input.stage === 'COMPLETED', required: true },
    {
      key: 'final-files',
      label: 'Fotos finais arquivadas',
      completed: hasFile(input, 'INSTALLATION') || hasFile(input, 'DELIVERY'),
      required: false,
    },
    { key: 'post-sale', label: 'Pós-venda realizado', completed: Boolean(input.postSaleContactedAt), required: false },
  ]
}

export function getProjectPhaseBlockers(tasks: ProjectPhaseTask[]) {
  return tasks.filter((task) => task.required && !task.completed).map((task) => task.label)
}
