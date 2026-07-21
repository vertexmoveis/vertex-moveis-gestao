'use client'

import { Calculator, ChevronLeft, ChevronRight, ExternalLink, FileText, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { QuotePayload } from '@/components/quotes/quote-form'
import { QUOTE_STATUS_BG, QUOTE_STATUS_LABELS, QUOTE_STATUSES, quoteDisplayCode, type QuoteStatus } from '@/lib/quotes'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { QuoteData } from '@/types/quotes'

const LazyQuoteForm = dynamic(
  () => import('@/components/quotes/quote-form').then((module) => module.QuoteForm),
  { loading: () => <div className="h-80 animate-pulse rounded-xl bg-[#F5F5F5]" /> }
)

type ClientOption = {
  id: string
  name: string
}

type ClientResponse = {
  id: string
  name: string
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type QuoteListResponse = {
  items?: QuoteData[]
  pagination?: Pagination
  totalCount?: number
  statusCounts?: Partial<Record<QuoteStatus, number>>
  expiredCount?: number
}

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
}

export default function QuotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [quotes, setQuotes] = useState<QuoteData[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [expiredOnly, setExpiredOnly] = useState(searchParams.get('expired') === '1')
  const [page, setPage] = useState(Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1))
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION)
  const [statusCounts, setStatusCounts] = useState<Partial<Record<QuoteStatus, number>>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [expiredCount, setExpiredCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [clientOptionsLoaded, setClientOptionsLoaded] = useState(false)
  const [clientOptionsLoading, setClientOptionsLoading] = useState(false)
  const [clientOptionsError, setClientOptionsError] = useState('')

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search.trim()) params.set('q', search.trim())
      if (status) params.set('status', status)
      if (expiredOnly) params.set('expired', '1')
      const response = await fetch(`/api/quotes?${params.toString()}`)
      const data = (await response.json()) as QuoteListResponse
      if (!response.ok) throw new Error('Não foi possível carregar os orçamentos.')

      const nextPagination = data.pagination || EMPTY_PAGINATION
      setQuotes(Array.isArray(data.items) ? data.items : [])
      setPagination(nextPagination)
      if (nextPagination.page > nextPagination.totalPages) setPage(nextPagination.totalPages)
      setStatusCounts(data.statusCounts || {})
      setTotalCount(data.totalCount || 0)
      setExpiredCount(data.expiredCount || 0)
    } catch {
      setQuotes([])
      setPagination(EMPTY_PAGINATION)
      setStatusCounts({})
      setTotalCount(0)
      setExpiredCount(0)
    } finally {
      setLoading(false)
    }
  }, [expiredOnly, page, search, status])

  useEffect(() => {
    const timer = setTimeout(fetchQuotes, 250)
    return () => clearTimeout(timer)
  }, [fetchQuotes])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (status) params.set('status', status)
    if (expiredOnly) params.set('expired', '1')
    if (page > 1) params.set('page', String(page))

    const queryString = params.toString()
    if (queryString !== searchParams.toString()) {
      router.replace(`/dashboard/quotes${queryString ? `?${queryString}` : ''}`)
    }
  }, [expiredOnly, page, router, search, searchParams, status])

  const loadClientOptions = useCallback(async () => {
    if (clientOptionsLoaded || clientOptionsLoading) return
    setClientOptionsLoading(true)
    setClientOptionsError('')

    try {
      const response = await fetch('/api/clients?options=1')
      if (!response.ok) throw new Error('Não foi possível carregar os clientes.')
      const data = await response.json()
      setClients(Array.isArray(data) ? data.map((client: ClientResponse) => ({ id: client.id, name: client.name })) : [])
      setClientOptionsLoaded(true)
    } catch (error) {
      setClientOptionsError(error instanceof Error ? error.message : 'Não foi possível carregar os clientes.')
    } finally {
      setClientOptionsLoading(false)
    }
  }, [clientOptionsLoaded, clientOptionsLoading])

  const openCreateModal = useCallback(() => {
    setModalOpen(true)
    void loadClientOptions()
  }, [loadClientOptions])

  const handleCreate = async (payload: QuotePayload) => {
    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível criar o orçamento.')
    }
    setModalOpen(false)
    router.push(`/dashboard/quotes/${data.id}`)
  }

  const visibleQuotes = quotes
  const firstItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const lastItem = Math.min(pagination.page * pagination.pageSize, pagination.total)

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Orçamentos"
        subtitle={`${pagination.total} orçamento${pagination.total !== 1 ? 's' : ''} na visão atual`}
        action={{ label: 'Novo Orçamento', onClick: openCreateModal }}
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <button
            type="button"
            onClick={() => {
              setStatus('')
              setExpiredOnly(false)
              setPage(1)
            }}
            className={cn(
              'rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-[#FF6B00]/40',
              !status && !expiredOnly ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/10' : 'border-[#E8E8E8]'
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Todos</p>
            <p className="mt-2 text-2xl font-bold text-[#121212]">{totalCount}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('')
              setExpiredOnly(true)
              setPage(1)
            }}
            className={cn(
              'rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-red-300',
              expiredOnly ? 'border-red-500 ring-2 ring-red-500/10' : 'border-[#E8E8E8]'
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Vencidos</p>
            <p className="mt-2 text-2xl font-bold text-[#121212]">{expiredCount}</p>
          </button>
          {QUOTE_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value)
                setExpiredOnly(false)
                setPage(1)
              }}
              className={cn(
                'rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-[#FF6B00]/40',
                status === value && !expiredOnly ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/10' : 'border-[#E8E8E8]'
              )}
            >
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">{QUOTE_STATUS_LABELS[value]}</p>
              <p className="mt-2 text-2xl font-bold text-[#121212]">{statusCounts[value] || 0}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar orçamento ou cliente..."
              className="w-full rounded-xl border border-[#D9D9D9] bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
            />
          </div>
          <select
            value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setExpiredOnly(false)
                setPage(1)
              }}
            className="rounded-xl border border-[#D9D9D9] bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
          >
            <option value="">Todos os status</option>
            {QUOTE_STATUSES.map((value) => (
              <option key={value} value={value}>{QUOTE_STATUS_LABELS[value]}</option>
            ))}
          </select>
          <Button onClick={openCreateModal}>
            <Plus size={16} />
            Novo Orçamento
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-[#E8E8E8] bg-white" />
            ))}
          </div>
        )}

        {!loading && visibleQuotes.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D9D9D9] bg-white py-20 text-center">
            <Calculator size={44} className="mb-3 text-[#FF6B00]" />
            <h2 className="text-base font-semibold text-[#121212]">Nenhum orçamento encontrado</h2>
            <p className="mt-1 max-w-md text-sm text-[#777]">Cadastre as medidas dos móveis para o sistema calcular o preço, custo, lucro e gerar uma proposta para o cliente.</p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus size={16} />
              Criar Orçamento
            </Button>
          </div>
        )}

        {!loading && visibleQuotes.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Orçamento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Ambientes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Lucro</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {visibleQuotes.map((quote) => (
                    <tr key={quote.id} className="cursor-pointer transition-colors hover:bg-[#FAFAFA]" onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#121212]">{quote.title}</p>
                        <p className="text-xs text-[#9E9E9E]">Código {quoteDisplayCode(quote)} • Atualizado em {formatDate(quote.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-[#121212]">{quote.client?.name || 'Cliente em orçamento'}</p>
                        {quote.client?.phone && <p className="text-xs text-[#9E9E9E]">{quote.client.phone}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', QUOTE_STATUS_BG[quote.status as QuoteStatus])}>
                          {QUOTE_STATUS_LABELS[quote.status as QuoteStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#777]">{quote.items.length} {quote.items.length === 1 ? 'móvel' : 'móveis'}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-emerald-600">{formatCurrency(quote.profit)}</p>
                        <p className="text-xs text-[#9E9E9E]">Custo {formatCurrency(quote.costTotal)}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-[#121212]">{formatCurrency(quote.total)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Abrir proposta"
                            onClick={(event) => {
                              event.stopPropagation()
                              window.open(`/api/quotes/${quote.id}/proposal`, '_blank')
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#777] hover:bg-[#F5F5F5] hover:text-[#121212]"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            title="Ver detalhes"
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(`/dashboard/quotes/${quote.id}`)
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#777] hover:bg-[#F5F5F5] hover:text-[#121212]"
                          >
                            <ExternalLink size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#F0F0F0] px-5 py-3 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between">
                <span>Mostrando {firstItem}-{lastItem} de {pagination.total} orçamentos</span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    aria-label="Página anterior"
                    title="Página anterior"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#121212] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="min-w-16 text-center font-semibold text-[#121212]">{pagination.page} de {pagination.totalPages}</span>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    title="Próxima página"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#121212] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Orçamento" size="xl" className="max-w-6xl">
        {clientOptionsLoading && <div className="h-80 animate-pulse rounded-xl bg-[#F5F5F5]" />}
        {!clientOptionsLoading && clientOptionsError && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-600">{clientOptionsError}</p>
            <Button type="button" variant="outline" onClick={() => void loadClientOptions()}>Tentar novamente</Button>
          </div>
        )}
        {clientOptionsLoaded && !clientOptionsLoading && (
          <LazyQuoteForm clients={clients} onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
        )}
      </Modal>
    </div>
  )
}
