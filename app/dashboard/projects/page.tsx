'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, FolderOpen, Calendar, DollarSign, User, Plus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProjectForm } from '@/components/projects/project-form'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PROJECT_STATUS_LABELS, PRODUCTION_STAGE_LABELS, type ProjectData } from '@/types'
import Link from 'next/link'

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/projects?${params}`)
    const data = await res.json()
    setProjects(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(fetchProjects, 300)
    return () => clearTimeout(timer)
  }, [fetchProjects])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([c, u]) => {
      setClients(c)
      setManagers(u)
    })
  }, [])

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

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Projetos"
        subtitle={`${projects.length} projeto${projects.length !== 1 ? 's' : ''} encontrado${projects.length !== 1 ? 's' : ''}`}
        action={{ label: 'Novo Projeto', onClick: () => setModalOpen(true) }}
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
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#D9D9D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-white border border-[#D9D9D9] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] shadow-sm"
          >
            {statusOptions.map((o) => (
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
              {search || statusFilter ? 'Tente outros filtros' : 'Comece criando seu primeiro projeto'}
            </p>
            {!search && !statusFilter && (
              <Button className="mt-4" onClick={() => setModalOpen(true)}>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Resp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {projects.map((project, i) => {
                    const isDelayed =
                      project.estimatedEndDate &&
                      new Date(project.estimatedEndDate) < new Date() &&
                      project.stage !== 'COMPLETED'

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
                          {project.estimatedEndDate ? (
                            <span className={`text-xs ${isDelayed ? 'text-red-500 font-medium' : 'text-[#9E9E9E]'}`}>
                              {formatDate(project.estimatedEndDate)}
                              {isDelayed && ' ⚠'}
                            </span>
                          ) : (
                            <span className="text-[#D9D9D9]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {project.value ? (
                            <span className="text-xs font-medium text-[#121212]">{formatCurrency(project.value)}</span>
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
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Projeto" size="lg">
        <ProjectForm
          clients={clients}
          managers={managers}
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
