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
  | 'DESIGN'
  | 'PROJECT_READY'
  | 'PRODUCTION'
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
  PENDING_START: 'Aguardando Início',
  MEASUREMENT: 'Medição',
  DESIGN: 'Projeto',
  PROJECT_READY: 'Projeto pronto',
  PRODUCTION: 'Produção',
  TRANSPORTATION: 'Transporte e Instalação',
  INSTALLATION: 'Transporte e Instalação',
  COMPLETED: 'Pronto',
}

export const PRODUCTION_STAGE_STATUS: Record<ProductionStage, ProjectStatus> = {
  PENDING_START: 'APPROVED',
  MEASUREMENT: 'MEASUREMENT_SCHEDULED',
  DESIGN: 'DESIGN_ENGINEERING',
  PROJECT_READY: 'PROJECT_READY',
  PRODUCTION: 'IN_PRODUCTION',
  TRANSPORTATION: 'INSTALLATION_SCHEDULED',
  INSTALLATION: 'INSTALLATION_SCHEDULED',
  COMPLETED: 'COMPLETED',
}

export const PRODUCTION_STAGE_FLOW: ProductionStage[] = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN',
  'PROJECT_READY',
  'PRODUCTION',
  'INSTALLATION',
  'COMPLETED',
]

export const normalizeProductionStage = (stage: ProductionStage): ProductionStage =>
  stage === 'TRANSPORTATION' ? 'INSTALLATION' : stage

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
  position: number
  notes: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt?: string
  updatedAt?: string
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
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { projects: number }
}

export interface ProjectData {
  id: string
  name: string
  room: string | null
  status: ProjectStatus
  stage: ProductionStage
  approvalDate: string | null
  paymentConfirmedAt?: string | null
  deliveryBusinessDays: number
  deliveryDeadlineDate: string | null
  productionReminderBusinessDays: number
  productionStartReminderDate: string | null
  startDate: string | null
  estimatedEndDate: string | null
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
  environments?: ProjectEnvironmentData[]
  environmentSummary?: { total: number; completed: number }
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; phone: string | null; whatsapp: string | null }
  manager: { id: string; name: string } | null
}
