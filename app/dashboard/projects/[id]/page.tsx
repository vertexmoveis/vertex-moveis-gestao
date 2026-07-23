'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Send, Clock, CheckCircle, Trash2, Phone, MessageCircle, CreditCard, CheckSquare, Square, ReceiptText, RefreshCw, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { ProjectForm } from '@/components/projects/project-form'
import { ProjectFilesCard, type ProjectFile } from '@/components/projects/project-files-card'
import { ProjectMaterialsCard } from '@/components/projects/project-materials-card'
import { ProjectExpensesCard } from '@/components/projects/project-expenses-card'
import { ProjectPortalCard } from '@/components/projects/project-portal-card'
import { ProjectProductionControl } from '@/components/projects/project-production-control'
import { formatDate, formatCurrency, formatDateRelative } from '@/lib/utils'
import { formatDateOnly } from '@/lib/date-only'
import { businessDaysBetween } from '@/lib/business-days'
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/payment-methods'
import { isEnvironmentCompleted, PROJECT_ENVIRONMENT_WORKFLOW_STATUSES } from '@/lib/project-environments'
import {
  PROJECT_ENVIRONMENT_STATUS_BG,
  PROJECT_ENVIRONMENT_STATUS_LABELS,
  PRODUCTION_STAGE_LABELS,
  type ProductionStage,
  type ProjectEnvironmentStatus,
  type ProjectStatus,
} from '@/types'
import Link from 'next/link'

interface ProjectDetail {
  id: string
  name: string
  room: string | null
  status: ProjectStatus
  stage: ProductionStage
  approvalDate: string | null
  paymentConfirmedAt: string | null
  deliveryBusinessDays: number
  deliveryDeadlineDate: string | null
  productionReminderBusinessDays: number
  productionStartReminderDate: string | null
  startDate: string | null
  estimatedEndDate: string | null
  actualEndDate: string | null
  postSaleFollowUpAt: string | null
  postSaleContactedAt: string | null
  warrantyEndsAt: string | null
  value: number | null
  productionCost: number | null
  costSummary: {
    estimatedCost: number
    adjustedCost: number
    materialAdjustment: number
    actualMaterials: number
    actualExpenses: number
    totalExpenses: number
    trackedMaterials: number
    totalMaterials: number
    hasActualCosts: boolean
  } | null
  downPayment: number | null
  downPaymentDate: string | null
  installmentCount: number
  installmentValue: number | null
  firstInstallmentDate: string | null
  internalNotes: string | null
  productionBlockedAt: string | null
  productionBlockReason: string | null
  stageDeadlineDate: string | null
  environments: {
    id: string
    name: string
    status: ProjectEnvironmentStatus
    position: number
    notes: string | null
    startedAt: string | null
    completedAt: string | null
  }[]
  environmentSummary: { total: number; completed: number }
  createdAt: string
  updatedAt: string
  client: {
    id: string; name: string; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null
  }
  manager: { id: string; name: string; email: string } | null
  notes: { id: string; content: string; createdAt: string; author: { id: string; name: string } }[]
  files: ProjectFile[]
  timeline: { id: string; event: string; description: string | null; date: string }[]
  payments: {
    id: string
    installmentNumber: number
    type: string
    amount: number
    dueDate: string
    paidAt: string | null
    paymentMethod: string | null
    history: {
      id: string
      action: string
      method: string | null
      amount: number
      createdAt: string
      user: { id: string; name: string } | null
    }[]
  }[]
  checklist: {
    id: string
    label: string
    position: number
    completedAt: string | null
  }[]
}

const buildWhatsAppNumber = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, '') || ''
  if (!digits) return null
  return digits.startsWith('55') ? digits : `55${digits}`
}

const buildWhatsAppLink = (phone: string, message?: string) => {
  const params = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${phone}${params}`
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editOptionsLoading, setEditOptionsLoading] = useState(false)
  const [editOptionsError, setEditOptionsError] = useState('')
  const [note, setNote] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  const [paymentMethodsById, setPaymentMethodsById] = useState<Record<string, string>>({})
  const [postSaleSaving, setPostSaleSaving] = useState(false)
  const [actualExpensesTotal, setActualExpensesTotal] = useState(0)

  const handleCostSummaryChange = useCallback((costSummary: NonNullable<ProjectDetail['costSummary']>) => {
    setProject((current) => current ? { ...current, costSummary } : current)
  }, [])

  const loadProject = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`/api/projects/${id}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Não foi possível carregar o projeto.')
      setProject(data)
      setActualExpensesTotal(data.costSummary?.actualExpenses || 0)
      if (Array.isArray(data.payments)) {
        setPaymentMethodsById(
          Object.fromEntries(data.payments.map((payment: { id: string; paymentMethod?: string | null }) => [payment.id, payment.paymentMethod || 'PIX']))
        )
      }
    } catch (error) {
      setProject(null)
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o projeto.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    let active = true
    fetch(`/api/projects/${id}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!active) return
        if (!response.ok || !data?.id) {
          setProject(null)
          setLoadError(data?.error || 'Não foi possível carregar o projeto.')
          return
        }
        setProject(data)
        setActualExpensesTotal(data.costSummary?.actualExpenses || 0)
        if (Array.isArray(data.payments)) {
          setPaymentMethodsById(
            Object.fromEntries(data.payments.map((payment: { id: string; paymentMethod?: string | null }) => [payment.id, payment.paymentMethod || 'PIX']))
          )
        }
      })
      .catch(() => {
        if (!active) return
        setProject(null)
        setLoadError('Não foi possível carregar o projeto.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id])

  const openEdit = async () => {
    setEditOpen(true)
    if (clients.length > 0 && managers.length > 0) return

    setEditOptionsLoading(true)
    setEditOptionsError('')
    try {
      const [clientsResponse, managersResponse] = await Promise.all([
        fetch('/api/clients?options=1'),
        fetch('/api/users'),
      ])
      const [clientOptions, managerOptions] = await Promise.all([
        clientsResponse.json().catch(() => []),
        managersResponse.json().catch(() => []),
      ])
      if (!clientsResponse.ok || !managersResponse.ok) throw new Error('Não foi possível carregar as opções de edição.')
      setClients(Array.isArray(clientOptions) ? clientOptions : [])
      setManagers(Array.isArray(managerOptions) ? managerOptions : [])
    } catch (error) {
      setEditOptionsError(error instanceof Error ? error.message : 'Não foi possível carregar as opções de edição.')
    } finally {
      setEditOptionsLoading(false)
    }
  }

  const handleEdit = async (data: Record<string, string>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(updated?.error || 'Não foi possível salvar as alterações do projeto.')
    }
    setProject((prev) => prev ? { ...prev, ...updated } : prev)
    setEditOpen(false)
  }

  const handleSendNote = async () => {
    if (!note.trim()) return
    setSendingNote(true)
    const res = await fetch(`/api/projects/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note }),
    })
    const newNote = await res.json()
    setProject((prev) =>
      prev ? { ...prev, notes: [newNote, ...prev.notes] } : prev
    )
    setNote('')
    setSendingNote(false)
  }

  const handlePaymentToggle = async (paymentId: string, paid: boolean) => {
    if (!project) return

    const selectedMethod = paymentMethodsById[paymentId] || 'PIX'
    const res = await fetch(`/api/projects/${id}/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid, paymentMethod: paid ? selectedMethod : null }),
    })
    if (!res.ok) return

    const updatedPayment = await res.json()
    setProject((prev) =>
      prev
        ? {
            ...prev,
            payments: prev.payments.map((payment) =>
              payment.id === paymentId ? { ...payment, ...updatedPayment } : payment
            ),
          }
        : prev
    )
  }

  const handleChecklistToggle = async (itemId: string, completed: boolean) => {
    const res = await fetch(`/api/projects/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (!res.ok) return

    const updatedItem = await res.json()
    setProject((prev) =>
      prev
        ? {
            ...prev,
            checklist: prev.checklist.map((item) => (item.id === itemId ? { ...item, ...updatedItem } : item)),
          }
        : prev
    )
  }

  const handleEnvironmentStatus = async (environmentId: string, status: ProjectEnvironmentStatus) => {
    const res = await fetch(`/api/projects/${id}/environments/${environmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return

    const updatedEnvironment = await res.json()
    setProject((prev) => {
      if (!prev) return prev
      const environments = prev.environments.map((environment) =>
        environment.id === environmentId ? { ...environment, ...updatedEnvironment } : environment
      )
      return {
        ...prev,
        room: environments.map((environment) => environment.name).join(', '),
        environments,
        environmentSummary: {
          total: environments.length,
          completed: environments.filter((environment) => isEnvironmentCompleted(environment.status)).length,
        },
      }
    })
  }

  const handleDelete = async () => {
    if (!confirm('Mover este projeto para a lixeira? Você poderá restaurá-lo nas Configurações.')) return
    const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setLoadError(data?.error || 'Não foi possível excluir o projeto.')
      return
    }
    router.push('/dashboard/projects')
  }

  const handlePostSale = async (contacted: boolean) => {
    setPostSaleSaving(true)
    const response = await fetch(`/api/projects/${id}/post-sale`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacted }),
    })
    const data = await response.json().catch(() => null)
    if (response.ok && data) {
      setProject((current) => current ? { ...current, ...data } : current)
    }
    setPostSaleSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl h-64 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">{loadError || 'Projeto não encontrado.'}</p>
        <Button variant="outline" onClick={() => void loadProject()}><RefreshCw size={15} /> Tentar novamente</Button>
      </div>
    )
  }

  const nowTime = new Date().getTime()
  const isDelayed = project.estimatedEndDate && new Date(project.estimatedEndDate) < new Date() && project.stage !== 'COMPLETED'
  const daysLeft = project.estimatedEndDate
    ? Math.ceil((new Date(project.estimatedEndDate).getTime() - nowTime) / 86400000)
    : null
  const businessDaysLeft = project.deliveryDeadlineDate
    ? businessDaysBetween(new Date(), project.deliveryDeadlineDate)
    : null
  const totalPaid = project.payments.reduce((sum, payment) => sum + (payment.paidAt ? payment.amount : 0), 0)
  const totalOpen = project.payments.reduce((sum, payment) => sum + (!payment.paidAt ? payment.amount : 0), 0)
  const projectCost = project.costSummary?.adjustedCost ?? project.productionCost ?? 0
  const profit = (project.value || 0) - projectCost
  const checklistDone = project.checklist.filter((item) => item.completedAt).length
  const checklistProgress = project.checklist.length > 0 ? Math.round((checklistDone / project.checklist.length) * 100) : 0
  const environments = project.environments || []
  const environmentsDone = environments.filter((environment) => isEnvironmentCompleted(environment.status)).length
  const environmentsProgress = environments.length > 0 ? Math.round((environmentsDone / environments.length) * 100) : 0
  const environmentStatusOptions = PROJECT_ENVIRONMENT_WORKFLOW_STATUSES.map((status) => [
    status,
    PROJECT_ENVIRONMENT_STATUS_LABELS[status],
  ] as [ProjectEnvironmentStatus, string])
  const clientWhatsAppNumber = buildWhatsAppNumber(project.client.whatsapp || project.client.phone)
  const projectRoomLabel = project.room?.trim()
  const projectLabel =
    projectRoomLabel && projectRoomLabel.toLowerCase() !== project.name.trim().toLowerCase()
      ? `${project.name} (${projectRoomLabel})`
      : project.name
  const approvalMessage = [
    `Olá, ${project.client.name}! Tudo bem?`,
    '',
    `Aqui é da Vertex Móveis. O projeto "${projectLabel}" já está pronto para sua aprovação.`,
    'Pode conferir e me responder com "aprovado" para seguirmos para a próxima etapa?',
  ].join('\n')
  const approvalReminderMessage = [
    `Olá, ${project.client.name}! Tudo bem?`,
    '',
    `Passando para lembrar da aprovação do projeto "${projectLabel}".`,
    'Assim que você aprovar, conseguimos dar sequência na produção e manter o prazo combinado.',
    'Pode me confirmar, por favor?',
  ].join('\n')
  const postSaleMessage = [
    `Olá, ${project.client.name}! Tudo bem?`,
    '',
    `Aqui é da Vertex Móveis. Queríamos saber como ficaram os móveis do projeto "${projectLabel}".`,
    'Está tudo certo? Caso precise de algum ajuste, estamos à disposição.',
  ].join('\n')
  const projectSections = [
    { href: '#resumo', label: 'Resumo' },
    { href: '#producao', label: 'Produção' },
    { href: '#prazos', label: 'Prazos' },
    { href: '#cliente', label: 'Cliente' },
    { href: '#arquivos', label: 'Arquivos' },
    ...(project.postSaleFollowUpAt || project.stage === 'COMPLETED' ? [{ href: '#pos-venda', label: 'Pós-venda' }] : []),
    { href: '#financeiro', label: 'Financeiro' },
    { href: '#materiais', label: 'Materiais' },
    { href: '#historico', label: 'Histórico' },
    { href: '#comentarios', label: 'Comentários' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        title={project.name}
        subtitle={project.client.name}
        userName=""
        action={{ label: 'Editar Projeto', onClick: () => void openEdit() }}
      />

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-sm text-[#9E9E9E] hover:text-[#121212] transition-colors">
            <ArrowLeft size={14} />
            Voltar para Projetos
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Excluir projeto
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-xl border border-[#E8E8E8] bg-white p-1 shadow-sm">
          {projectSections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-[#FFF3EA] hover:text-[#FF6B00]"
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-4">
            {/* Status */}
            <Card id="resumo" className="scroll-mt-28">
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mb-2">Status do Projeto</p>
                    <StatusBadge status={project.status} />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mb-1">Etapa de Produção</p>
                    <p className="text-sm font-medium text-[#121212]">
                      {PRODUCTION_STAGE_LABELS[project.stage as keyof typeof PRODUCTION_STAGE_LABELS]}
                    </p>
                  </div>
                  {project.room && (
                    <div>
                      <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mb-1">Ambiente</p>
                      <p className="text-sm text-[#121212]">{project.room}</p>
                    </div>
                  )}
                  {project.value && (
                    <div>
                      <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mb-1">Valor</p>
                      <p className="text-base font-bold text-[#121212]">{formatCurrency(project.value)}</p>
                    </div>
                  )}
                  {project.value && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#FAFAFA] p-3">
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">{project.costSummary?.hasActualCosts ? 'Custo ajustado' : 'Custo previsto'}</p>
                        <p className="text-sm font-semibold text-[#121212]">{formatCurrency(projectCost)}</p>
                        {project.costSummary?.hasActualCosts ? (
                          <p className="mt-1 text-[10px] text-[#777]">Previsto: {formatCurrency(project.costSummary.estimatedCost)}</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">{project.costSummary?.hasActualCosts ? 'Lucro ajustado' : 'Lucro previsto'}</p>
                        <p className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(profit)}</p>
                      </div>
                    </div>
                  )}
                  {project.value && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#FAFAFA] p-3">
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Entrada</p>
                        <p className="text-sm font-semibold text-[#121212]">{formatCurrency(project.downPayment || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Parcelas</p>
                        <p className="text-sm font-semibold text-[#121212]">
                          {project.installmentCount || 0}x {formatCurrency(project.installmentValue || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Data da entrada</p>
                        <p className="text-sm font-semibold text-[#121212]">
                          {project.downPaymentDate ? formatDateOnly(project.downPaymentDate) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">1a parcela</p>
                        <p className="text-sm font-semibold text-[#121212]">
                          {project.firstInstallmentDate ? formatDateOnly(project.firstInstallmentDate) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Recebido</p>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Aberto</p>
                        <p className="text-sm font-semibold text-orange-600">{formatCurrency(totalOpen)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Environments */}
            <Card id="producao" className="scroll-mt-28">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Ambientes do projeto</p>
                    {environments.length > 0 && (
                      <p className="mt-1 text-[11px] text-[#9E9E9E]">
                        {environmentsDone}/{environments.length} concluídos
                      </p>
                    )}
                  </div>
                  {environments.length > 0 && (
                    <span className="text-xs font-semibold text-[#121212]">{environmentsProgress}%</span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {environments.length === 0 ? (
                  <p className="text-sm text-[#9E9E9E]">Edite o projeto para cadastrar ambientes separados.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
                      <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${environmentsProgress}%` }} />
                    </div>
                    <div className="space-y-2">
                      {environments.map((environment) => (
                        <div key={environment.id} className="rounded-lg border border-[#E8E8E8] bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#121212]">{environment.name}</p>
                              {environment.completedAt && (
                                <p className="mt-0.5 text-[10px] text-green-600">
                                  Concluído em {formatDate(environment.completedAt)}
                                </p>
                              )}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_ENVIRONMENT_STATUS_BG[environment.status]}`}>
                              {PROJECT_ENVIRONMENT_STATUS_LABELS[environment.status]}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-[#F7F7F7] p-1 xl:grid-cols-4">
                            {environmentStatusOptions.map(([status, label]) => (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={environment.status === status}
                                onClick={() => handleEnvironmentStatus(environment.id, status)}
                                className={`min-h-9 rounded-md px-2 py-1 text-[10px] font-semibold leading-tight transition-colors ${
                                  environment.status === status
                                    ? 'bg-white text-[#FF6B00] shadow-sm ring-1 ring-[#FF6B00]/30'
                                    : 'text-[#6B7280] hover:bg-white hover:text-[#121212]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Dates */}
            <Card id="prazos" className="scroll-mt-28">
              <CardHeader><p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Datas</p></CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {project.approvalDate && (
                    <div className="flex items-center gap-3">
                      <CreditCard size={14} className="text-[#9E9E9E] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Aprovação do orçamento</p>
                        <p className="text-sm text-[#121212]">{formatDate(project.approvalDate)}</p>
                      </div>
                    </div>
                  )}
                  {project.paymentConfirmedAt && (
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={14} className="flex-shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Pagamento confirmado</p>
                        <p className="text-sm font-medium text-emerald-700">{formatDate(project.paymentConfirmedAt)}</p>
                      </div>
                    </div>
                  )}
                  {project.productionStartReminderDate && project.stage === 'PENDING_START' && (
                    <div className="flex items-center gap-3">
                      <Clock size={14} className="text-orange-500 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Cobrar início</p>
                        <p className="text-sm font-medium text-orange-600">{formatDate(project.productionStartReminderDate)}</p>
                      </div>
                    </div>
                  )}
                  {project.deliveryDeadlineDate && (
                    <div className="flex items-center gap-3">
                      <Calendar size={14} className="text-[#9E9E9E] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Entrega em {project.deliveryBusinessDays} dias úteis</p>
                        <p className={`text-sm font-medium ${businessDaysLeft !== null && businessDaysLeft < 0 ? 'text-red-500' : 'text-[#121212]'}`}>
                          {formatDate(project.deliveryDeadlineDate)}
                          {businessDaysLeft !== null && (
                            <span className="text-[#9E9E9E] font-normal ml-1 text-xs">
                              ({businessDaysLeft < 0 ? `${Math.abs(businessDaysLeft)} úteis atrasado` : `${businessDaysLeft} úteis`})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {project.startDate && (
                    <div className="flex items-center gap-3">
                      <Calendar size={14} className="text-[#9E9E9E] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Início</p>
                        <p className="text-sm text-[#121212]">{formatDate(project.startDate)}</p>
                      </div>
                    </div>
                  )}
                  {project.estimatedEndDate && (
                    <div className="flex items-center gap-3">
                      <Clock size={14} className={isDelayed ? 'text-red-500 flex-shrink-0' : 'text-[#9E9E9E] flex-shrink-0'} />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Previsão</p>
                        <p className={`text-sm font-medium ${isDelayed ? 'text-red-500' : 'text-[#121212]'}`}>
                          {formatDate(project.estimatedEndDate)}
                          {daysLeft !== null && daysLeft > 0 && (
                            <span className="text-[#9E9E9E] font-normal ml-1 text-xs">({daysLeft}d)</span>
                          )}
                          {isDelayed && <span className="ml-1 text-xs">⚠ Atrasado</span>}
                        </p>
                      </div>
                    </div>
                  )}
                  {project.actualEndDate && (
                    <div className="flex items-center gap-3">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Conclusão</p>
                        <p className="text-sm text-green-600 font-medium">{formatDate(project.actualEndDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Production checklist */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Checklist</p>
                    {project.checklist.length > 0 && (
                      <p className="mt-1 text-[11px] text-[#9E9E9E]">
                        {checklistDone}/{project.checklist.length} etapas
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#121212]">{checklistProgress}%</span>
                </div>
              </CardHeader>
              <CardBody>
                {project.checklist.length === 0 ? (
                  <p className="text-sm text-[#9E9E9E]">O checklist será criado ao salvar o projeto.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
                      <div className="h-full rounded-full bg-[#FF6B00] transition-all" style={{ width: `${checklistProgress}%` }} />
                    </div>
                    <div className="space-y-1">
                      {project.checklist.map((item) => {
                        const completed = !!item.completedAt

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleChecklistToggle(item.id, !completed)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[#FAFAFA]"
                          >
                            {completed ? <CheckSquare size={15} className="text-green-600" /> : <Square size={15} className="text-[#9E9E9E]" />}
                            <span className={completed ? 'text-[#6B7280] line-through' : 'text-[#121212]'}>
                              {item.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Client */}
            <Card id="cliente" className="scroll-mt-28">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Cliente</p>
                  <Link href={`/dashboard/clients/${project.client.id}`} className="text-xs text-[#FF6B00] hover:underline">
                    Ver perfil
                  </Link>
                </div>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={project.client.name} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-[#121212]">{project.client.name}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {project.client.phone && (
                    <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                      <Phone size={12} />{project.client.phone}
                    </div>
                  )}
                  {clientWhatsAppNumber && (
                    <a
                      href={buildWhatsAppLink(clientWhatsAppNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-green-600 hover:underline"
                    >
                      <MessageCircle size={12} />WhatsApp
                    </a>
                  )}
                  {clientWhatsAppNumber && (
                    <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                      <a
                        href={buildWhatsAppLink(clientWhatsAppNumber, approvalMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#FF6B00] px-3 text-xs font-semibold text-[#FF6B00] transition-colors hover:bg-[#FFF3EA]"
                      >
                        <Send size={13} />
                        Pedir aprovação
                      </a>
                      <a
                        href={buildWhatsAppLink(clientWhatsAppNumber, approvalReminderMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] px-3 text-xs font-semibold text-[#121212] transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00]"
                      >
                        <MessageCircle size={13} />
                        Cobrar aprovação
                      </a>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <ProjectPortalCard
              projectId={project.id}
              clientName={project.client.name}
              whatsapp={project.client.whatsapp || project.client.phone}
            />

            <ProjectProductionControl
              projectId={project.id}
              value={{
                productionBlockedAt: project.productionBlockedAt,
                productionBlockReason: project.productionBlockReason,
                stageDeadlineDate: project.stageDeadlineDate,
              }}
              onChange={(control) => setProject((current) => current ? { ...current, ...control } : current)}
            />

            {(project.postSaleFollowUpAt || project.stage === 'COMPLETED') && (
              <Card id="pos-venda" className="scroll-mt-28">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Pós-venda e garantia</p>
                    {project.postSaleContactedAt ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600"><CheckCircle size={13} /> Realizado</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-orange-600">Pendente</span>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MessageCircle size={15} className="mt-0.5 shrink-0 text-[#FF6B00]" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Contato de pós-venda</p>
                        <p className="text-sm font-medium text-[#121212]">
                          {project.postSaleContactedAt
                            ? `Realizado em ${formatDate(project.postSaleContactedAt)}`
                            : project.postSaleFollowUpAt
                              ? `Previsto para ${formatDate(project.postSaleFollowUpAt)}`
                              : 'Será agendado ao concluir o projeto.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-green-600" />
                      <div>
                        <p className="text-[10px] text-[#9E9E9E]">Garantia</p>
                        <p className="text-sm font-medium text-[#121212]">
                          {project.warrantyEndsAt ? `Até ${formatDate(project.warrantyEndsAt)}` : 'Será registrada na conclusão.'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                      {clientWhatsAppNumber && (
                        <a
                          href={buildWhatsAppLink(clientWhatsAppNumber, postSaleMessage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-green-200 px-3 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50"
                        >
                          <MessageCircle size={13} />
                          Enviar WhatsApp
                        </a>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={project.postSaleContactedAt ? 'outline' : 'primary'}
                        loading={postSaleSaving}
                        onClick={() => void handlePostSale(!project.postSaleContactedAt)}
                        className="h-9"
                      >
                        {project.postSaleContactedAt ? <RefreshCw size={13} /> : <CheckCircle size={13} />}
                        {project.postSaleContactedAt ? 'Reabrir pós-venda' : 'Marcar como realizado'}
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Manager */}
            {project.manager && (
              <Card>
                <CardHeader><p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Responsável</p></CardHeader>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Avatar name={project.manager.name} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-[#121212]">{project.manager.name}</p>
                      <p className="text-xs text-[#9E9E9E]">{project.manager.email}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Center / Right */}
          <div className="lg:col-span-2 space-y-4">
            {/* Payments */}
            <Card id="financeiro" className="scroll-mt-28">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#121212]">Pagamentos</h3>
                  <span className="text-xs text-[#9E9E9E]">{project.payments.length} lançamento{project.payments.length !== 1 ? 's' : ''}</span>
                </div>
              </CardHeader>
              <CardBody>
                {project.payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
                    <CreditCard size={28} className="mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma parcela cadastrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
                    {project.payments.map((payment) => {
                      const paid = !!payment.paidAt
                      return (
                        <div key={payment.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#121212]">
                              {payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.installmentNumber}`}
                            </p>
                            <p className="text-xs text-[#9E9E9E]">
                              Vencimento: {formatDateOnly(payment.dueDate)}
                              {paid ? ` | Pago em ${formatDate(payment.paidAt)}` : ''}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#9E9E9E]">
                              Método: {paymentMethodLabel(payment.paymentMethod)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`text-sm font-bold ${paid ? 'text-green-600' : 'text-[#121212]'}`}>
                              {formatCurrency(payment.amount)}
                            </p>
                            {!paid && (
                              <select
                                value={paymentMethodsById[payment.id] || 'PIX'}
                                onChange={(event) => setPaymentMethodsById((prev) => ({ ...prev, [payment.id]: event.target.value }))}
                                className="h-8 rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                              >
                                {PAYMENT_METHODS.map((method) => (
                                  <option key={method.value} value={method.value}>
                                    {method.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {paid && (
                              <a
                                href={`/api/projects/${project.id}/payments/${payment.id}/receipt`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D9D9D9] px-2 text-xs font-medium text-[#121212] hover:bg-[#F5F5F5]"
                              >
                                <ReceiptText size={13} />
                                Recibo
                              </a>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={paid ? 'outline' : 'primary'}
                              onClick={() => handlePaymentToggle(payment.id, !paid)}
                            >
                              {paid ? 'Reabrir' : 'Pago'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <ProjectMaterialsCard
              projectId={project.id}
              projectValue={project.value}
              baseCost={project.productionCost}
              canManage={project.value !== null}
              actualExpensesTotal={actualExpensesTotal}
              onCostSummaryChange={handleCostSummaryChange}
            />

            {project.value !== null ? (
              <ProjectExpensesCard projectId={project.id} onExpensesChange={setActualExpensesTotal} />
            ) : null}

            <ProjectFilesCard
              projectId={project.id}
              files={project.files}
              onFilesChange={(files) => setProject((current) => current ? { ...current, files } : current)}
            />

            {/* Timeline */}
            <Card id="historico" className="scroll-mt-28">
              <CardHeader>
                <h3 className="text-sm font-semibold text-[#121212]">Histórico do Projeto</h3>
              </CardHeader>
              <CardBody>
                {project.timeline.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#9E9E9E]">Nenhum evento registrado</p>
                ) : (
                  <div className="relative">
                    <div className="absolute bottom-0 left-3.5 top-0 w-px bg-[#E8E8E8]" />
                    <div className="space-y-5">
                      {project.timeline.map((event) => (
                        <div key={event.id} className="flex items-start gap-4 pl-1">
                          <div className="z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#FF6B00]">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#121212]">{event.event}</p>
                            {event.description && (
                              <p className="mt-0.5 text-xs text-[#9E9E9E]">{event.description}</p>
                            )}
                            <p className="mt-1 text-[10px] text-[#BDBDBD]">{formatDate(event.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Internal notes */}
            {project.internalNotes && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-[#121212]">Notas Internas</h3></CardHeader>
                <CardBody>
                  <p className="text-sm text-[#121212] leading-relaxed">{project.internalNotes}</p>
                </CardBody>
              </Card>
            )}

            {/* Comments */}
            <Card id="comentarios" className="scroll-mt-28">
              <CardHeader>
                <h3 className="text-sm font-semibold text-[#121212]">
                  Comentários ({project.notes.length})
                </h3>
              </CardHeader>
              <CardBody>
                {/* Add note */}
                <div className="flex gap-3 mb-5">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Adicionar comentário ou observação..."
                    rows={2}
                    className="flex-1 text-sm bg-[#F5F5F5] border border-[#E8E8E8] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent resize-none"
                  />
                  <Button
                    onClick={handleSendNote}
                    loading={sendingNote}
                    disabled={!note.trim()}
                    className="self-end"
                  >
                    <Send size={14} />
                    Enviar
                  </Button>
                </div>

                {/* Notes list */}
                <div className="space-y-3">
                  {project.notes.map((n) => (
                    <div key={n.id} className="flex items-start gap-3">
                      <Avatar name={n.author.name} size="sm" />
                      <div className="flex-1 bg-[#F5F5F5] rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-[#121212]">{n.author.name}</p>
                          <p className="text-[10px] text-[#9E9E9E]">{formatDateRelative(n.createdAt)}</p>
                        </div>
                        <p className="text-sm text-[#121212] leading-relaxed whitespace-pre-wrap">{n.content}</p>
                      </div>
                    </div>
                  ))}
                  {project.notes.length === 0 && (
                    <p className="text-sm text-[#9E9E9E] text-center py-4">Nenhum comentário ainda</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Projeto" size="lg">
        {editOptionsLoading ? (
          <div className="h-56 animate-pulse rounded-lg bg-[#F5F5F5]" />
        ) : editOptionsError ? (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{editOptionsError}</p>
            <Button type="button" variant="outline" onClick={() => void openEdit()}><RefreshCw size={15} /> Tentar novamente</Button>
          </div>
        ) : (
        <ProjectForm
          clients={clients}
          managers={managers}
          initialData={{
            ...project,
            clientId: project.client.id,
            managerId: project.manager?.id || '',
            environments: environments.map((environment) => environment.name).join('\n'),
            value: project.value?.toString() || '',
            productionCost: project.productionCost?.toString() || '',
            downPayment: project.downPayment?.toString() || '',
            downPaymentDate: project.downPaymentDate?.split('T')[0] || '',
            installmentCount: project.installmentCount?.toString() || '',
            firstInstallmentDate: project.firstInstallmentDate?.split('T')[0] || '',
            approvalDate: project.approvalDate?.split('T')[0] || '',
            paymentConfirmedAt: project.paymentConfirmedAt?.split('T')[0] || '',
            deliveryBusinessDays: project.deliveryBusinessDays?.toString() || '',
            productionReminderBusinessDays: project.productionReminderBusinessDays?.toString() || '',
            startDate: project.startDate?.split('T')[0] || '',
            estimatedEndDate: project.estimatedEndDate?.split('T')[0] || '',
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
        )}
      </Modal>
    </div>
  )
}
