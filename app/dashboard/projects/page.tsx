'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, FolderOpen, Plus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency } from '@/lib/utils'
import { businessDaysBetween } from '@/lib/business-days'
import { PROJECT_STATUS_LABELS, PRODUCTION_STAGE_FLOW, PRODUCTION_STAGE_LABELS, type ProjectData } from '@/types'

const LazyProjectForm = dynamic(
  () => import('@/components/projects/project-form').then((module) => module.ProjectForm),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-[#F5F5F5]" /> }
)

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '')
  const [page, setPage] = useState(Math.max(Number(searchParams.get('page') || 1), 1))
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [formOptionsLoaded, setFormOptionsLoaded] = useState(false)
  const [formOptionsLoading, setFormOptionsLoading] = useState(false)
  const [formOptionsError, setFormOptionsError] = useState('')

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ paged: '1', page: String(page), pageSize: '20' })
    if (search) params.set('q', search)
    if (statusFilter) params.set('status', statusFilter)
    if (stageFilter) params.set('stage', stageFilter)

    const res = await fetch(`/api/projects?${params}`)
    const data = await res.json()
    setProjects(Array.isArray(data) ? data : data.items || [])
    setTotalProjects(Array.isArray(data) ? data.length : data.total || 0)
    setTotalPages(Array.isArray(data) ? 1 : data.totalPages || 1)
    setLoading(false)
  }, [page, search, stageFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(fetchProjects, 300)
    return () => clearTimeout(timer)
  }, [fetchProjects])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (statusFilter) params.set('status', statusFilter)
    if (stageFilter) params.set('stage', stageFilter)
    if (page > 1) params.set('page', String(page))

    const queryString = params.toString()
    const currentString = searchParams.toString()
    if (queryString !== currentString) {
      router.replace(`/dashboard/projects${queryString ? `?${queryString}` : ''}`)
    }
  }, [page, router, search, searchParams, stageFilter, statusFilter])

  const loadFormOptions = useCallback(async () => {
    if (formOptionsLoaded || formOptionsLoading) return
    setFormOptionsLoading(true)
    setFormOptionsError('')

    try {
      const [clientsResponse, usersResponse] = await Promise.all([
        fetch('/api/clients?options=1'),
        fetch('/api/users'),
      ])
      if (!clientsResponse.ok || !usersResponse.ok) throw new Error('Não foi possível carregar o formulário.')
      const [clientOptions, userOptions] = await Promise.all([clientsResponse.json(), usersResponse.json()])
      setClients(Array.isArray(clientOptions) ? clientOptions : [])
      setManagers(Array.isArray(userOptions) ? userOptions : [])
      setFormOptionsLoaded(true)
    } catch (error) {
      setFormOptionsError(error instanceof Error ? error.message : 'Não foi possível carregar o formulário.')
    } finally {
      setFormOptionsLoading(false)
    }
  }, [formOptionsLoaded, formOptionsLoading])

  const openCreateModal = useCallback(() => {
    setModalOpen(true)
    void loadFormOptions()
  }, [loadFormOptions])

  const handleCreate = async (data: Record<string, string>) => {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setModalOpen(false)
    fetchProjects()
  }

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    ...Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  ]
  const stageOptions = [
    { value: '', label: 'Todas as etapas' },
    ...PRODUCTION_STAGE_FLOW.map((value) => ({ value, label: PRODUCTION_STAGE_LABELS[value] })),
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Projetos"
        subtitle={`${totalProjects} projeto${totalProjects !== 1 ? 's' : ''} encontrado${totalProjects !== 1 ? 's' : ''}`}
        action={{ label: 'Novo Projeto', onClick: openCreateModal }}
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              type="text"
              placeholder="Buscar por projeto ou cliente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#D9D9D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="text-sm bg-white border border-[#D9D9D9] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] shadow-sm"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value)
              setPage(1)
            }}
            className="text-sm bg-white border border-[#D9D9D9] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] shadow-sm"
          >
            {stageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8E8E8] h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9E9E9E]">
            <FolderOpen size={48} className="mb-3 opacity-20" />
            <p className="text-base font-medium">Nenhum projeto encontrado</p>
            <p className="text-sm mt-1">
              {search || statusFilter || stageFilter ? 'Tente outros filtros' : 'Comece criando seu primeiro projeto'}
            </p>
            {!search && !statusFilter && !stageFilter && (
              <Button className="mt-4" onClick={openCreateModal}>
                <Plus size={16} />
                Criar Projeto
              </Button>
            )}
          </div>
        )}

        {/* Projects table */}
        {!loading && projects.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E8E8E8] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Projeto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Etapa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Entrega</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Financeiro</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Resp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {projects.map((project, i) => {
                    const deliveryDate = project.deliveryDeadlineDate || project.estimatedEndDate
                    const isDelayed =
                      deliveryDate &&
                      new Date(deliveryDate) < new Date() &&
                      project.stage !== 'COMPLETED'
                    const businessDaysLeft = project.deliveryDeadlineDate
                      ? businessDaysBetween(new Date(), project.deliveryDeadlineDate)
                      : null

                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-[#FAFAFA] transition-colors animate-fade-in cursor-pointer"
                        style={{ animationDelay: `${i * 20}ms` }}
                        onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-medium text-[#121212] hover:text-[#FF6B00] transition-colors">
                              {project.name}
                            </p>
                            {project.room && (
                              <p className="text-xs text-[#9E9E9E] mt-0.5">{project.room}</p>
                            )}
                            {project.environmentSummary && project.environmentSummary.total > 0 && (
                              <p className="mt-1 text-[10px] font-medium text-[#6B7280]">
                                {project.environmentSummary.completed}/{project.environmentSummary.total} ambientes concluídos
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[#121212] truncate max-w-[140px]">{project.client.name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-[#9E9E9E]">
                            {PRODUCTION_STAGE_LABELS[project.stage as keyof typeof PRODUCTION_STAGE_LABELS]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {deliveryDate ? (
                            <span className={`text-xs ${isDelayed ? 'font-medium text-red-500' : 'text-[#9E9E9E]'}`}>
                              {formatDate(deliveryDate)}
                              {businessDaysLeft !== null && (
                                <span className="block text-[10px] text-[#9E9E9E]">
                                  {businessDaysLeft < 0 ? `${Math.abs(businessDaysLeft)} úteis atrasado` : `${businessDaysLeft} úteis`}
                                </span>
                              )}
                              {isDelayed && ' ⚠'}
                            </span>
                          ) : (
                            <span className="text-[#D9D9D9]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {project.value ? (
                            <div>
                              <p className="text-xs font-semibold text-[#121212]">{formatCurrency(project.value)}</p>
                              <p className="text-[10px] text-[#9E9E9E]">
                                Entrada {formatCurrency(project.downPayment || 0)}
                                {project.installmentCount ? ` + ${project.installmentCount}x` : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#D9D9D9]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {project.manager ? (
                            <span className="text-xs text-[#9E9E9E]">{project.manager.name.split(' ')[0]}</span>
                          ) : (
                            <span className="text-[#D9D9D9]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-sm">
            <span className="text-[#6B7280]">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                Anterior
              </Button>
              <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Projeto" size="lg">
        {formOptionsLoading && <div className="h-64 animate-pulse rounded-xl bg-[#F5F5F5]" />}
        {!formOptionsLoading && formOptionsError && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-600">{formOptionsError}</p>
            <Button type="button" variant="outline" onClick={() => void loadFormOptions()}>Tentar novamente</Button>
          </div>
        )}
        {formOptionsLoaded && !formOptionsLoading && (
          <LazyProjectForm
            clients={clients}
            managers={managers}
            onSubmit={handleCreate}
            onCancel={() => setModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  )
}
