export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER'

export type ProjectStatus =
  | 'APPROVED'
  | 'MEASUREMENT_SCHEDULED'
  | 'DESIGN_ENGINEERING'
  | 'PROJECT_READY'
  | 'IN_PRODUCTION'
  | 'INSTALLATION_SCHEDULED'
  | 'COMPLETED'
  | 'DELAYED'

export type ProductionStage =
  | 'PENDING_START'
  | 'MEASUREMENT'
  | 'DESIGN_PENDING'
  | 'DESIGN'
  | 'PROJECT_READY'
  | 'DIMENSIONING'
  | 'PROJECT_APPROVED'
  | 'SENDING_TO_PRODUCTION'
  | 'PRODUCTION'
  | 'PRODUCTION_READY'
  | 'TRANSPORTATION'
  | 'INSTALLATION'
  | 'COMPLETED'

export type ProjectEnvironmentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'READY'
  | 'INSTALLED'
  | 'COMPLETED'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  APPROVED: 'Aprovado',
  MEASUREMENT_SCHEDULED: 'Medição Agendada',
  DESIGN_ENGINEERING: 'Projeto e Engenharia',
  PROJECT_READY: 'Projeto pronto',
  IN_PRODUCTION: 'Em Produção',
  INSTALLATION_SCHEDULED: 'Instalação Agendada',
  COMPLETED: 'Concluído',
  DELAYED: 'Atrasado',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  APPROVED: '#EAB308',
  MEASUREMENT_SCHEDULED: '#3B82F6',
  DESIGN_ENGINEERING: '#A855F7',
  PROJECT_READY: '#8B5CF6',
  IN_PRODUCTION: '#FF6B00',
  INSTALLATION_SCHEDULED: '#06B6D4',
  COMPLETED: '#22C55E',
  DELAYED: '#EF4444',
}

export const PROJECT_STATUS_BG: Record<ProjectStatus, string> = {
  APPROVED: 'bg-yellow-100 text-yellow-800',
  MEASUREMENT_SCHEDULED: 'bg-blue-100 text-blue-800',
  DESIGN_ENGINEERING: 'bg-purple-100 text-purple-800',
  PROJECT_READY: 'bg-violet-100 text-violet-800',
  IN_PRODUCTION: 'bg-orange-100 text-orange-800',
  INSTALLATION_SCHEDULED: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-green-100 text-green-800',
  DELAYED: 'bg-red-100 text-red-800',
}

export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  PENDING_START: 'Aguardando medição',
  MEASUREMENT: 'Em medição',
  DESIGN_PENDING: 'Aguardando projeto',
  DESIGN: 'Projetando',
  PROJECT_READY: 'Desenho pronto',
  DIMENSIONING: 'Detalhamento e cotas',
  PROJECT_APPROVED: 'Projeto aprovado',
  SENDING_TO_PRODUCTION: 'Preparando produção',
  PRODUCTION: 'Em produção',
  PRODUCTION_READY: 'Pronto para transporte',
  TRANSPORTATION: 'Em transporte',
  INSTALLATION: 'Em instalação',
  COMPLETED: 'Concluído',
}

export const PRODUCTION_STAGE_DESCRIPTIONS: Record<ProductionStage, string> = {
  PENDING_START: 'Aguardando a medição dos ambientes para iniciar o projeto.',
  MEASUREMENT: 'Conferindo as medidas do ambiente.',
  DESIGN_PENDING: 'Medição concluída; aguardando o início do desenho.',
  DESIGN: 'Desenvolvendo o desenho e a solução dos móveis.',
  PROJECT_READY: 'Desenho pronto para receber as cotas e a conferência.',
  DIMENSIONING: 'Adicionando as cotas e medidas para o cliente e a produção conferirem.',
  PROJECT_APPROVED: 'Projeto aprovado para preparar o envio à produção.',
  SENDING_TO_PRODUCTION: 'Preparando e enviando os arquivos e as orientações para fabricar.',
  PRODUCTION: 'Fabricando os móveis.',
  PRODUCTION_READY: 'Móveis fabricados, aguardando transporte.',
  TRANSPORTATION: 'Transportando os móveis até o local.',
  INSTALLATION: 'Instalando e conferindo os móveis.',
  COMPLETED: 'Serviço finalizado e entregue ao cliente.',
}

export const PRODUCTION_STAGE_STATUS: Record<ProductionStage, ProjectStatus> = {
  PENDING_START: 'APPROVED',
  MEASUREMENT: 'MEASUREMENT_SCHEDULED',
  DESIGN_PENDING: 'DESIGN_ENGINEERING',
  DESIGN: 'DESIGN_ENGINEERING',
  PROJECT_READY: 'PROJECT_READY',
  DIMENSIONING: 'PROJECT_READY',
  PROJECT_APPROVED: 'PROJECT_READY',
  SENDING_TO_PRODUCTION: 'PROJECT_READY',
  PRODUCTION: 'IN_PRODUCTION',
  PRODUCTION_READY: 'IN_PRODUCTION',
  TRANSPORTATION: 'INSTALLATION_SCHEDULED',
  INSTALLATION: 'INSTALLATION_SCHEDULED',
  COMPLETED: 'COMPLETED',
}

export const PRODUCTION_STAGE_FLOW: ProductionStage[] = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN_PENDING',
  'DESIGN',
  'PROJECT_READY',
  'DIMENSIONING',
  'PROJECT_APPROVED',
  'SENDING_TO_PRODUCTION',
  'PRODUCTION',
  'PRODUCTION_READY',
  'TRANSPORTATION',
  'INSTALLATION',
  'COMPLETED',
]

export const normalizeProductionStage = (stage: ProductionStage): ProductionStage =>
  stage

export const PROJECT_ENVIRONMENT_STATUS_LABELS: Record<ProjectEnvironmentStatus, string> = {
  PENDING: 'A iniciar',
  IN_PROGRESS: 'Em produção',
  READY: 'Pronto para instalar',
  INSTALLED: 'Instalado',
  COMPLETED: 'Finalizado',
}

export const PROJECT_ENVIRONMENT_STATUS_BG: Record<ProjectEnvironmentStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  READY: 'bg-blue-100 text-blue-700',
  INSTALLED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

export interface ProjectEnvironmentData {
  id: string
  name: string
  status: ProjectEnvironmentStatus
  workflowStage?: ProductionStage | null
  position: number
  notes: string | null
  mdfSpecifications: ProjectMdfSpecification[]
  startedAt: string | null
  completedAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type ProjectMdfSide = 'EXTERNAL' | 'INTERNAL'

export interface ProjectMdfSpecification {
  id: string
  application: string
  side: ProjectMdfSide
  mdf: string
  notes: string | null
}

export interface ClientData {
  id: string
  name: string
  document: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  latitude?: number | null
  longitude?: number | null
  geocodedAt?: string | null
  notes?: string | null
  relationshipStage: 'CONTACT' | 'NEGOTIATING' | 'CUSTOMER' | 'INACTIVE'
  relationshipStageChangedAt: string
  lastCommercialActivityAt: string | null
  inactivatedAt?: string | null
  inactiveReason?: string | null
  latestQuote?: {
    id: string
    number: number
    title: string
    status: string
    updatedAt: string
  } | null
  attention?: {
    code: 'NO_RESPONSE' | 'CLOSE_SUGGESTED'
    label: string
    elapsedDays: number
  } | null
  createdAt: string
  updatedAt: string
  _count?: { projects: number; quotes?: number }
}

export interface ProjectData {
  id: string
  name: string
  room: string | null
  status: ProjectStatus
  stage: ProductionStage
  workflowVersion?: number
  approvalDate: string | null
  paymentConfirmedAt?: string | null
  deliveryBusinessDays: number
  deliveryDeadlineDate: string | null
  productionReminderBusinessDays: number
  productionStartReminderDate: string | null
  startDate: string | null
  estimatedEndDate: string | null
  deliveryForecastMonth?: string | null
  actualEndDate: string | null
  value: number | null
  productionCost: number | null
  downPayment: number | null
  downPaymentDate: string | null
  installmentCount: number
  installmentValue: number | null
  firstInstallmentDate: string | null
  internalNotes: string | null
  productionBlockedAt?: string | null
  productionBlockReason?: string | null
  stageDeadlineDate?: string | null
  pendingMaterialCount?: number
  environments?: ProjectEnvironmentData[]
  environmentSummary?: { total: number; completed: number }
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; phone: string | null; whatsapp: string | null }
  manager: { id: string; name: string } | null
}
