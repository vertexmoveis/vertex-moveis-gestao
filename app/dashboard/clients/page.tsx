'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, Mail, MapPin, FolderOpen, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { ClientForm } from '@/components/clients/client-form'
import { formatDate } from '@/lib/utils'
import { formatClientAddress } from '@/lib/address'
import Link from 'next/link'
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

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalClients, setTotalClients] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ paged: '1', page: String(page), pageSize: '24' })
    if (search) params.set('q', search)
    const res = await fetch(`/api/clients?${params.toString()}`)
    const data = await res.json()
    setClients(Array.isArray(data) ? data : data.items || [])
    setTotalClients(Array.isArray(data) ? data.length : data.total || 0)
    setTotalPages(Array.isArray(data) ? 1 : data.totalPages || 1)
    setLoading(false)
  }, [page, search])

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300)
    return () => clearTimeout(timer)
  }, [fetchClients])

  const handleCreate = async (data: ClientFormData) => {
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setModalOpen(false)
    fetchClients()
  }

  const handleEdit = async (data: ClientFormData) => {
    if (!editingClient) return
    await fetch(`/api/clients/${editingClient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setEditingClient(null)
    fetchClients()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchClients()
  }

  const filtered = clients

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Clientes"
        subtitle={`${totalClients} clientes cadastrados`}
        action={{ label: 'Novo Cliente', onClick: () => setModalOpen(true) }}
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#D9D9D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all shadow-sm"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8E8E8] h-40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#9E9E9E]">
            <Users size={48} className="mb-3 opacity-20" />
            <p className="text-base font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">
              {search ? 'Tente outro termo de busca' : 'Comece cadastrando seu primeiro cliente'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setModalOpen(true)}>
                <UserPlus size={16} />
                Cadastrar Cliente
              </Button>
            )}
          </div>
        )}

        {/* Client grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((client, i) => {
              const clientAddress = formatClientAddress(client)

              return (
                <div
                  key={client.id}
                  className="bg-white rounded-xl border border-[#E8E8E8] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in overflow-hidden group"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.name} size="md" />
                      <div>
                        <h3 className="text-sm font-semibold text-[#121212]">{client.name}</h3>
                        <p className="text-xs text-[#9E9E9E]">Desde {formatDate(client.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingClient(client)}
                        className="p-1.5 rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(client.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#9E9E9E] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                        <Phone size={12} className="flex-shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                        <Mail size={12} className="flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {clientAddress && (
                      <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
                        <MapPin size={12} className="flex-shrink-0" />
                        <span className="truncate">{clientAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[#9E9E9E]">
                    <FolderOpen size={12} />
                    <span>{client._count?.projects || 0} projeto{(client._count?.projects || 0) !== 1 ? 's' : ''}</span>
                  </div>
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="text-xs font-medium text-[#FF6B00] hover:underline"
                  >
                    Ver detalhes →
                  </Link>
                </div>
                </div>
              )
            })}
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

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Cliente" size="md">
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingClient} onClose={() => setEditingClient(null)} title="Editar Cliente" size="md">
        {editingClient && (
          <ClientForm
            initialData={editingClient}
            onSubmit={handleEdit}
            onCancel={() => setEditingClient(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Excluir Cliente" size="sm">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <p className="text-sm text-[#121212] mb-1">Tem certeza que deseja excluir este cliente?</p>
          <p className="text-xs text-[#9E9E9E] mb-6">Esta ação não pode ser desfeita. Todos os projetos vinculados serão removidos.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
