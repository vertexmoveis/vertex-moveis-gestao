export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER'

export type ProjectStatus =
  | 'APPROVED'
  | 'MEASUREMENT_SCHEDULED'
  | 'DESIGN_ENGINEERING'
  | 'IN_PRODUCTION'
  | 'INSTALLATION_SCHEDULED'
  | 'COMPLETED'
  | 'DELAYED'

export type ProductionStage =
  | 'PENDING_START'
  | 'MEASUREMENT'
  | 'DESIGN'
  | 'CUTTING'
  | 'MANUFACTURING'
  | 'FINISHING'
  | 'QUALITY_CONTROL'
  | 'PACKAGING'
  | 'TRANSPORTATION'
  | 'INSTALLATION'
  | 'COMPLETED'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  APPROVED: 'Aprovado',
  MEASUREMENT_SCHEDULED: 'Medição Agendada',
  DESIGN_ENGINEERING: 'Projeto e Engenharia',
  IN_PRODUCTION: 'Em Produção',
  INSTALLATION_SCHEDULED: 'Instalação Agendada',
  COMPLETED: 'Concluído',
  DELAYED: 'Atrasado',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  APPROVED: '#EAB308',
  MEASUREMENT_SCHEDULED: '#3B82F6',
  DESIGN_ENGINEERING: '#A855F7',
  IN_PRODUCTION: '#FF6B00',
  INSTALLATION_SCHEDULED: '#06B6D4',
  COMPLETED: '#22C55E',
  DELAYED: '#EF4444',
}

export const PROJECT_STATUS_BG: Record<ProjectStatus, string> = {
  APPROVED: 'bg-yellow-100 text-yellow-800',
  MEASUREMENT_SCHEDULED: 'bg-blue-100 text-blue-800',
  DESIGN_ENGINEERING: 'bg-purple-100 text-purple-800',
  IN_PRODUCTION: 'bg-orange-100 text-orange-800',
  INSTALLATION_SCHEDULED: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-green-100 text-green-800',
  DELAYED: 'bg-red-100 text-red-800',
}

export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  PENDING_START: 'Aguardando Início',
  MEASUREMENT: 'Medição',
  DESIGN: 'Projeto',
  CUTTING: 'Corte',
  MANUFACTURING: 'Fabricação',
  FINISHING: 'Acabamento',
  QUALITY_CONTROL: 'Controle de Qualidade',
  PACKAGING: 'Embalagem',
  TRANSPORTATION: 'Transporte',
  INSTALLATION: 'Instalação',
  COMPLETED: 'Concluído',
}

export const PRODUCTION_STAGE_STATUS: Record<ProductionStage, ProjectStatus> = {
  PENDING_START: 'APPROVED',
  MEASUREMENT: 'MEASUREMENT_SCHEDULED',
  DESIGN: 'DESIGN_ENGINEERING',
  CUTTING: 'IN_PRODUCTION',
  MANUFACTURING: 'IN_PRODUCTION',
  FINISHING: 'IN_PRODUCTION',
  QUALITY_CONTROL: 'IN_PRODUCTION',
  PACKAGING: 'IN_PRODUCTION',
  TRANSPORTATION: 'IN_PRODUCTION',
  INSTALLATION: 'INSTALLATION_SCHEDULED',
  COMPLETED: 'COMPLETED',
}

export interface ClientData {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
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
  startDate: string | null
  estimatedEndDate: string | null
  actualEndDate: string | null
  value: number | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; phone: string | null; whatsapp: string | null }
  manager: { id: string; name: string } | null
}

export interface DashboardStats {
  totalClients: number
  activeProjects: number
  inProduction: number
  completed: number
  delayed: number
  todayDeliveries: number
  statusDistribution: { status: ProjectStatus; count: number; label: string; color: string }[]
  recentActivities: { id: string; action: string; details: string | null; createdAt: string; user: { name: string } | null; project: { name: string; client: { name: string } } | null }[]
  upcomingDeliveries: ProjectData[]
}
