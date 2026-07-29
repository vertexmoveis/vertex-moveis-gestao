'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { ClientForm } from '@/components/clients/client-form'
import { formatDate } from '@/lib/utils'
import { formatClientAddress } from '@/lib/address'
import { cn } from '@/lib/utils'
import type { ClientData } from '@/types'

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

type ClientSegment = 'customers' | 'negotiating' | 'inactive' | 'all'

type ClientCounts = {
  customers: number
  negotiating: number
  inactive: number
  all: number
}

type DuplicateWarning = {
  client: { id: string; name: string }
  data: ClientFormData
  mode: 'create' | 'edit'
}

const tabs: Array<{ id: ClientSegment; label: string }> = [
  { id: 'customers', label: 'Clientes' },
  { id: 'negotiating', label: 'Em negociação' },
  { id: 'inactive', label: 'Inativos' },
  { id: 'all', label: 'Todos' },
]

const relationshipLabels = {
  CONTACT: 'Contato',
  NEGOTIATING: 'Em negociação',
  CUSTOMER: 'Cliente',
  INACTIVE: 'Inativo',
} as const

const relationshipStyles = {
  CONTACT: 'bg-blue-50 text-blue-700',
  NEGOTIATING: 'bg-amber-50 text-amber-800',
  CUSTOMER: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-[#F1F1F1] text-[#6B7280]',
} as const

function activityLabel(client: ClientData) {
  const value = client.lastCommercialActivityAt || client.updatedAt
  return `Atualizado em ${formatDate(value)}`
}

function ContactDetails({ client }: { client: ClientData }) {
  const address = formatClientAddress(client)
  const contact = client.whatsapp || client.phone

  return (
    <div className="space-y-1 text-xs text-[#6B7280]">
      {contact && (
        <div className="flex items-center gap-1.5">
          <Phone size={12} />
          <span>{contact}</span>
        </div>
      )}
      {client.email && (
        <div className="flex min-w-0 items-center gap-1.5">
          <Mail size={12} />
          <span className="truncate">{client.email}</span>
        </div>
      )}
      {address && (
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin size={12} />
          <span className="truncate">{address}</span>
        </div>
      )}
      {!contact && !client.email && !address && <span>Sem contato informado</span>}
    </div>
  )
}

export default function ClientsPage() {
  const searchParams = useSearchParams()
  const requestedSegment = searchParams.get('segment')
  const initialSegment: ClientSegment = requestedSegment === 'negotiating'
    || requestedSegment === 'inactive'
    || requestedSegment === 'all'
    ? requestedSegment
    : 'customers'
  const [clients, setClients] = useState<ClientData[]>([])
  const [counts, setCounts] = useState<ClientCounts>({ customers: 0, negotiating: 0, inactive: 0, all: 0 })
  const [segment, setSegment] = useState<ClientSegment>(initialSegment)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalClients, setTotalClients] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        paged: '1',
        page: String(page),
        pageSize: '20',
        segment,
      })
      if (search) params.set('q', search)
      const response = await fetch(`/api/clients?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar os cadastros.')
      setClients(data.items || [])
      setTotalClients(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setCounts(data.counts || { customers: 0, negotiating: 0, inactive: 0, all: 0 })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }, [page, search, segment])

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchClients(), 300)
    return () => window.clearTimeout(timer)
  }, [fetchClients])

  const saveClient = async (
    mode: 'create' | 'edit',
    data: ClientFormData,
    allowPossibleDuplicate = false,
  ) => {
    const clientId = mode === 'edit' ? editingClient?.id : null
    const response = await fetch(clientId ? `/api/clients/${clientId}` : '/api/clients', {
      method: clientId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, allowPossibleDuplicate }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      if (payload?.code === 'POSSIBLE_DUPLICATE' && payload.existingClient) {
        setDuplicateWarning({ client: payload.existingClient, data, mode })
      }
      const message = payload?.error || 'Não foi possível salvar o cadastro.'
      setFormError(message)
      return
    }

    setDuplicateWarning(null)
    setFormError('')
    setModalOpen(false)
    setEditingClient(null)
    await fetchClients()
  }

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error || 'Não foi possível mover o contato para a lixeira.')
      setDeleteConfirm(null)
      return
    }
    setDeleteConfirm(null)
    await fetchClients()
  }

  const updateRelationship = async (
    client: ClientData,
    action: 'INACTIVATE' | 'REACTIVATE',
  ) => {
    setError('')
    const response = await fetch(`/api/clients/${client.id}/relationship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason: action === 'INACTIVATE' ? 'Negociação encerrada manualmente' : undefined,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error || 'Não foi possível atualizar a classificação.')
      return
    }
    await fetchClients()
  }

  const openCreate = () => {
    setFormError('')
    setDuplicateWarning(null)
    setModalOpen(true)
  }

  const openEdit = (client: ClientData) => {
    setFormError('')
    setDuplicateWarning(null)
    setEditingClient(client)
  }

  const closeForm = () => {
    setFormError('')
    setDuplicateWarning(null)
    setModalOpen(false)
    setEditingClient(null)
  }

  const emptyTitle = segment === 'customers'
    ? 'Nenhum cliente convertido ainda'
    : segment === 'negotiating'
      ? 'Nenhuma negociação em andamento'
      : segment === 'inactive'
        ? 'Nenhum cadastro inativo'
        : 'Nenhum cadastro encontrado'

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Clientes"
        subtitle={`${counts.customers} clientes · ${counts.negotiating} em negociação`}
        action={{ label: 'Novo contato', onClick: openCreate }}
      />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        <div className="overflow-x-auto border-b border-[#E8E8E8]">
          <div className="flex min-w-max gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSegment(tab.id)
                  setPage(1)
                }}
                className={cn(
                  'border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                  segment === tab.id
                    ? 'border-[#FF6B00] text-[#121212]'
                    : 'border-transparent text-[#777] hover:text-[#121212]',
                )}
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-[#F1F1F1] px-2 py-0.5 text-xs text-[#6B7280]">
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
          <input
            type="search"
            placeholder="Buscar por nome, telefone, e-mail, rua ou CEP"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className="h-11 w-full rounded-lg border border-[#D9D9D9] bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-[#FF6B00]"
          />
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="font-semibold">Fechar</button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-[78px] animate-pulse rounded-lg border border-[#E8E8E8] bg-white" />
            ))}
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-[#777]">
            <Users size={42} className="mb-3 opacity-25" />
            <p className="font-semibold text-[#121212]">{emptyTitle}</p>
            <p className="mt-1 text-sm">
              {search ? 'Tente outro termo de busca.' : 'Os cadastros aparecerão aqui conforme avançarem no atendimento.'}
            </p>
            {!search && segment === 'negotiating' && (
              <Button className="mt-4" onClick={openCreate}>
                <UserPlus size={16} />
                Novo contato
              </Button>
            )}
          </div>
        )}

        {!loading && clients.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-[#E8E8E8] bg-white lg:block">
              <div className="grid grid-cols-[minmax(220px,1.35fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_140px_170px] gap-4 border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-2.5 text-xs font-semibold uppercase text-[#777]">
                <span>Nome</span>
                <span>Contato</span>
                <span>Último andamento</span>
                <span>Histórico</span>
                <span className="text-right">Ações</span>
              </div>
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="grid min-h-[82px] grid-cols-[minmax(220px,1.35fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_140px_170px] items-center gap-4 border-b border-[#EFEFEF] px-4 py-3 last:border-b-0 hover:bg-[#FCFCFC]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={client.name} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/dashboard/clients/${client.id}`} className="block truncate text-sm font-semibold text-[#121212] hover:text-[#FF6B00]">
                        {client.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', relationshipStyles[client.relationshipStage])}>
                          {relationshipLabels[client.relationshipStage]}
                        </span>
                        {client.attention && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            {client.attention.label} · {client.attention.elapsedDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ContactDetails client={client} />
                  <div className="min-w-0 text-xs text-[#6B7280]">
                    {client.latestQuote ? (
                      <Link href={`/dashboard/quotes/${client.latestQuote.id}`} className="block truncate font-medium text-[#121212] hover:text-[#FF6B00]">
                        #{String(client.latestQuote.number).padStart(4, '0')} · {client.latestQuote.title}
                      </Link>
                    ) : (
                      <span className="text-[#9E9E9E]">Sem orçamento</span>
                    )}
                    <p className="mt-1">{activityLabel(client)}</p>
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    <p>{client._count?.quotes || 0} orçamento(s)</p>
                    <p className="mt-1">{client._count?.projects || 0} projeto(s)</p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="rounded-lg border border-[#D9D9D9] px-3 py-2 text-xs font-semibold text-[#121212] hover:border-[#FF6B00]"
                    >
                      Abrir
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      className="rounded-lg p-2 text-[#777] hover:bg-[#F1F1F1] hover:text-[#121212]"
                      title="Editar cadastro"
                      aria-label={`Editar ${client.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    {client.relationshipStage === 'INACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => void updateRelationship(client, 'REACTIVATE')}
                        className="rounded-lg p-2 text-[#777] hover:bg-emerald-50 hover:text-emerald-700"
                        title="Reativar contato"
                        aria-label={`Reativar ${client.name}`}
                      >
                        <ArchiveRestore size={15} />
                      </button>
                    ) : (client.relationshipStage === 'CONTACT' || client.relationshipStage === 'NEGOTIATING') ? (
                      <button
                        type="button"
                        onClick={() => void updateRelationship(client, 'INACTIVATE')}
                        className="rounded-lg p-2 text-[#777] hover:bg-amber-50 hover:text-amber-700"
                        title="Encerrar negociação"
                        aria-label={`Encerrar negociação com ${client.name}`}
                      >
                        <Archive size={15} />
                      </button>
                    ) : null}
                    {(client._count?.projects || 0) === 0 && (client._count?.quotes || 0) === 0 && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(client.id)}
                        className="rounded-lg p-2 text-[#777] hover:bg-red-50 hover:text-red-600"
                        title="Mover contato vazio para a lixeira"
                        aria-label={`Mover ${client.name} para a lixeira`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 lg:hidden">
              {clients.map((client) => (
                <div key={client.id} className="rounded-lg border border-[#E8E8E8] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={client.name} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/dashboard/clients/${client.id}`} className="block truncate text-sm font-semibold text-[#121212]">
                          {client.name}
                        </Link>
                        <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', relationshipStyles[client.relationshipStage])}>
                          {relationshipLabels[client.relationshipStage]}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm font-medium text-[#121212]"
                    >
                      Abrir
                    </Link>
                  </div>
                  <div className="mt-3 border-t border-[#EFEFEF] pt-3">
                    <ContactDetails client={client} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                    <span>{client._count?.quotes || 0} orçamento(s) · {client._count?.projects || 0} projeto(s)</span>
                    {client.attention && (
                      <span className="font-semibold text-red-700">{client.attention.label} · {client.attention.elapsedDays}d</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-[#EFEFEF] pt-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => openEdit(client)}>
                      <Pencil size={14} />
                      Editar
                    </Button>
                    {client.relationshipStage === 'INACTIVE' && (
                      <Button type="button" variant="outline" className="flex-1" onClick={() => void updateRelationship(client, 'REACTIVATE')}>
                        <ArchiveRestore size={14} />
                        Reativar
                      </Button>
                    )}
                    {(client.relationshipStage === 'CONTACT' || client.relationshipStage === 'NEGOTIATING') && (
                      <Button type="button" variant="outline" className="flex-1" onClick={() => void updateRelationship(client, 'INACTIVATE')}>
                        <Archive size={14} />
                        Encerrar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between rounded-lg border border-[#E8E8E8] bg-white px-4 py-3 text-sm">
            <span className="text-[#6B7280]">Página {page} de {totalPages} · {totalClients} registros</span>
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

      <Modal open={modalOpen} onClose={closeForm} title="Novo contato" size="md">
        <ClientForm
          onSubmit={(data) => saveClient('create', data)}
          onCancel={closeForm}
          serverError={formError}
        />
        {duplicateWarning?.mode === 'create' && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Confira primeiro o cadastro de{' '}
              <Link className="font-semibold underline" href={`/dashboard/clients/${duplicateWarning.client.id}`}>
                {duplicateWarning.client.name}
              </Link>.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void saveClient('create', duplicateWarning.data, true)}
            >
              Cadastrar mesmo assim
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editingClient)} onClose={closeForm} title="Editar cadastro" size="md">
        {editingClient && (
          <ClientForm
            initialData={editingClient}
            onSubmit={(data) => saveClient('edit', data)}
            onCancel={closeForm}
            serverError={formError}
          />
        )}
        {duplicateWarning?.mode === 'edit' && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>O contato coincide com {duplicateWarning.client.name}. Revise antes de continuar.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void saveClient('edit', duplicateWarning.data, true)}
            >
              Salvar mesmo assim
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} title="Mover para a lixeira" size="sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <p className="mb-1 text-sm font-semibold text-[#121212]">Mover este contato vazio para a lixeira?</p>
          <p className="mb-6 text-xs text-[#777]">
            Cadastros com orçamento ou projeto não podem ser apagados e devem ser inativados.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" onClick={() => deleteConfirm && void handleDelete(deleteConfirm)}>
              Mover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
