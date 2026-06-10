'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Calendar, DollarSign, User, MessageSquare,
  Send, Clock, CheckCircle, Pencil, Trash2, FileText,
  Phone, MessageCircle, MapPin
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { ProjectForm } from '@/components/projects/project-form'
import { formatDate, formatCurrency, formatDateRelative } from '@/lib/utils'
import { PRODUCTION_STAGE_LABELS, type ProjectStatus } from '@/types'
import Link from 'next/link'

interface ProjectDetail {
  id: string
  name: string
  room: string | null
  status: ProjectStatus
  stage: string
  startDate: string | null
  estimatedEndDate: string | null
  actualEndDate: string | null
  value: number | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string; name: string; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null
  }
  manager: { id: string; name: string; email: string } | null
  notes: { id: string; content: string; createdAt: string; author: { id: string; name: string } }[]
  timeline: { id: string; event: string; description: string | null; date: string }[]
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [note, setNote] = useState('')
  const [sendingNote, setSendingNote] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([p, c, u]) => {
      setProject(p)
      setClients(c)
      setManagers(u)
      setLoading(false)
    })
  }, [id])

  const handleEdit = async (data: Record<string, string>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
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

  const handleDelete = async () => {
    if (!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    router.push('/dashboard/projects')
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
      <div className="flex items-center justify-center h-full">
        <p className="text-[#9E9E9E]">Projeto não encontrado</p>
      </div>
    )
  }

  const isDelayed = project.estimatedEndDate && new Date(project.estimatedEndDate) < new Date() && project.stage !== 'COMPLETED'
  const daysLeft = project.estimatedEndDate
    ? Math.ceil((new Date(project.estimatedEndDate).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="flex flex-col h-full">
      <Header
        title={project.name}
        subtitle={project.client.name}
        userName=""
        action={{ label: 'Editar Projeto', onClick: () => setEditOpen(true) }}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-4">
            {/* Status */}
            <Card>
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
                </div>
              </CardBody>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader><p className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide">Datas</p></CardHeader>
              <CardBody>
                <div className="space-y-3">
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

            {/* Client */}
            <Card>
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
                  {project.client.whatsapp && (
                    <a
                      href={`https://wa.me/55${project.client.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-green-600 hover:underline"
                    >
                      <MessageCircle size={12} />WhatsApp
                    </a>
                  )}
                </div>
              </CardBody>
            </Card>

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
            {/* Timeline */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[#121212]">Histórico do Projeto</h3>
              </CardHeader>
              <CardBody>
                {project.timeline.length === 0 ? (
                  <p className="text-sm text-[#9E9E9E] text-center py-4">Nenhum evento registrado</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[#E8E8E8]" />
                    <div className="space-y-5">
                      {project.timeline.map((event, i) => (
                        <div key={event.id} className="flex items-start gap-4 pl-1">
                          <div className="w-6 h-6 rounded-full bg-[#FF6B00] flex items-center justify-center flex-shrink-0 z-10">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#121212]">{event.event}</p>
                            {event.description && (
                              <p className="text-xs text-[#9E9E9E] mt-0.5">{event.description}</p>
                            )}
                            <p className="text-[10px] text-[#BDBDBD] mt-1">{formatDate(event.date)}</p>
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
            <Card>
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
        <ProjectForm
          clients={clients}
          managers={managers}
          initialData={{
            ...project,
            clientId: project.client.id,
            managerId: project.manager?.id || '',
            value: project.value?.toString() || '',
            startDate: project.startDate?.split('T')[0] || '',
            estimatedEndDate: project.estimatedEndDate?.split('T')[0] || '',
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  )
}
