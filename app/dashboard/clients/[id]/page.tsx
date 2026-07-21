'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Phone, Mail, MapPin, FolderOpen, ArrowLeft, MessageCircle,
  Calendar, User
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { ClientForm } from '@/components/clients/client-form'
import { formatDate, formatCurrency } from '@/lib/utils'
import { formatClientAddress } from '@/lib/address'
import Link from 'next/link'
import type { ClientData, ProjectStatus } from '@/types'

interface ClientDetail extends ClientData {
  projects: Array<{
    id: string
    name: string
    room: string | null
    status: ProjectStatus
    stage: string
    startDate: string | null
    estimatedEndDate: string | null
    value: number | null
    manager: { id: string; name: string } | null
  }>
}

type ClientFormData = {
  name: string
  document?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  notes?: string
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((data) => { setClient(data); setLoading(false) })
  }, [id])

  const handleEdit = async (data: ClientFormData) => {
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    setClient((prev) => prev ? { ...prev, ...updated } : prev)
    setEditOpen(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-16 bg-white border-b animate-pulse" />
        <div className="p-6 grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#9E9E9E]">Cliente não encontrado</p>
      </div>
    )
  }

  const totalValue = client.projects.reduce((sum, p) => sum + (p.value || 0), 0)
  const activeProjects = client.projects.filter((p) => p.stage !== 'COMPLETED').length
  const clientAddress = formatClientAddress(client)

  return (
    <div className="flex flex-col h-full">
      <Header
        title={client.name}
        subtitle="Detalhes do cliente"
        userName=""
        action={{ label: 'Editar Cliente', onClick: () => setEditOpen(true) }}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Back */}
        <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-sm text-[#9E9E9E] hover:text-[#121212] transition-colors">
          <ArrowLeft size={14} />
          Voltar para Clientes
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <div className="space-y-4">
            <Card>
              <CardBody>
                <div className="flex flex-col items-center text-center py-2">
                  <Avatar name={client.name} size="lg" className="mb-3" />
                  <h2 className="text-base font-bold text-[#121212]">{client.name}</h2>
                  <p className="text-xs text-[#9E9E9E] mt-1">Cliente desde {formatDate(client.createdAt)}</p>
                </div>

                <div className="mt-4 space-y-3 border-t border-[#F5F5F5] pt-4">
                  {client.document && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                        <User size={13} className="text-[#9E9E9E]" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-[#9E9E9E]">CPF / CNPJ</p>
                        <p className="text-sm text-[#121212]">{client.document}</p>
                      </div>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                        <Phone size={13} className="text-[#9E9E9E]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide">Telefone</p>
                        <p className="text-sm text-[#121212]">{client.phone}</p>
                      </div>
                    </div>
                  )}
                  {client.whatsapp && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <MessageCircle size={13} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide">WhatsApp</p>
                        <a
                          href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-green-600 hover:underline"
                        >
                          {client.whatsapp}
                        </a>
                      </div>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                        <Mail size={13} className="text-[#9E9E9E]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide">Email</p>
                        <p className="text-sm text-[#121212] break-all">{client.email}</p>
                      </div>
                    </div>
                  )}
                  {clientAddress && (
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={13} className="text-[#9E9E9E]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide">Endereço</p>
                        <p className="text-sm text-[#121212]">{clientAddress}</p>
                      </div>
                    </div>
                  )}
                </div>

                {client.notes && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[10px] text-amber-700 uppercase tracking-wide font-medium mb-1">Observações</p>
                    <p className="text-xs text-amber-800">{client.notes}</p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardBody className="text-center py-4">
                  <p className="text-2xl font-bold text-[#121212]">{client.projects.length}</p>
                  <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mt-1">Projetos</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center py-4">
                  <p className="text-2xl font-bold text-[#FF6B00]">{activeProjects}</p>
                  <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mt-1">Ativos</p>
                </CardBody>
              </Card>
            </div>

            {totalValue > 0 && (
              <Card>
                <CardBody className="text-center py-4">
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
                  <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide mt-1">Volume Total</p>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Projects */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#121212]">
                    Projetos ({client.projects.length})
                  </h3>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {client.projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#9E9E9E]">
                    <FolderOpen size={36} className="mb-2 opacity-20" />
                    <p className="text-sm">Nenhum projeto cadastrado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F5F5F5]">
                    {client.projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="flex items-start justify-between px-5 py-4 hover:bg-[#FAFAFA] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-[#121212] hover:text-[#FF6B00]">{project.name}</p>
                            {project.room && (
                              <span className="text-xs bg-[#F5F5F5] text-[#9E9E9E] px-2 py-0.5 rounded-md">{project.room}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                            <StatusBadge status={project.status} />
                            {project.estimatedEndDate && (
                              <span className="flex items-center gap-1 text-xs text-[#9E9E9E]">
                                <Calendar size={11} />
                                {formatDate(project.estimatedEndDate)}
                              </span>
                            )}
                            {project.manager && (
                              <span className="flex items-center gap-1 text-xs text-[#9E9E9E]">
                                <User size={11} />
                                {project.manager.name}
                              </span>
                            )}
                          </div>
                        </div>
                        {project.value && (
                          <div className="ml-4 text-right">
                            <p className="text-sm font-semibold text-[#121212]">{formatCurrency(project.value)}</p>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Cliente" size="md">
        <ClientForm
          initialData={{ ...client, id: client.id }}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  )
}
