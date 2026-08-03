'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  MessageCircle,
  Search,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardBody } from '@/components/ui/card'
import {
  CONTRACT_CENTER_STATUS_LABELS,
  type ContractCenterStatus,
} from '@/lib/contract-center'
import { formatDate } from '@/lib/utils'

type ContractRow = {
  id: string
  name: string
  clientName: string
  clientPhone: string | null
  managerName: string
  status: ContractCenterStatus
  contract: null | {
    id: string
    version: number
    publicUrl: string | null
    sentAt: string | null
    viewedAt: string | null
    lastReminderAt: string | null
    reminderCount: number
    signedAt: string | null
  }
}

type ContractsPayload = {
  items: ContractRow[]
  total: number
  page: number
  totalPages: number
  counts: { all: number; attention: number; waiting: number; signed: number; legacy: number }
}

const emptyPayload: ContractsPayload = {
  items: [], total: 0, page: 1, totalPages: 1,
  counts: { all: 0, attention: 0, waiting: 0, signed: 0, legacy: 0 },
}

function whatsappUrl(row: ContractRow) {
  const digits = (row.clientPhone || '').replace(/\D/g, '')
  const phone = digits.startsWith('55') ? digits : `55${digits}`
  const url = row.contract?.publicUrl || ''
  const message = `Olá, ${row.clientName}! O contrato do projeto ${row.name} está aguardando sua aprovação. Você conseguiu conferir? Se tiver alguma dúvida ou precisar de ajuste, me avise. ${url}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function statusTone(status: ContractCenterStatus) {
  if (status === 'SIGNED') return 'bg-emerald-50 text-emerald-700'
  if (status === 'SENT' || status === 'VIEWED') return 'bg-blue-50 text-blue-700'
  if (status === 'LEGACY') return 'bg-[#F5F5F5] text-[#666]'
  return 'bg-amber-50 text-amber-800'
}

function reminderIsAvailable(row: ContractRow) {
  if (!['SENT', 'VIEWED'].includes(row.status) || !row.clientPhone || !row.contract?.publicUrl) return false
  if (!row.contract.lastReminderAt) return true
  return Date.now() - new Date(row.contract.lastReminderAt).getTime() >= 24 * 60 * 60 * 1000
}

export default function ContractsPage() {
  const [payload, setPayload] = useState(emptyPayload)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)
    try {
      const response = await fetch(`/api/contracts?${params}`, { signal })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar os contratos.')
      setPayload(result)
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError') {
        setError((requestError as Error).message)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [page, query, status])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])

  const remind = async (row: ContractRow) => {
    if (!row.contract || !row.clientPhone || !row.contract.publicUrl) return
    setBusyId(row.id)
    const popup = window.open(whatsappUrl(row), '_blank', 'noopener,noreferrer')
    try {
      const response = await fetch(`/api/projects/${row.id}/contracts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: row.contract.id }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível registrar o lembrete.')
      await load()
    } catch (requestError) {
      if (popup) popup.close()
      setError((requestError as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Contratos" subtitle="Acompanhe envios, visualizações, assinaturas e cobranças" />
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Precisam de atenção" value={payload.counts.attention} icon={AlertTriangle} tone="amber" />
          <Metric label="Aguardando cliente" value={payload.counts.waiting} icon={MessageCircle} tone="blue" />
          <Metric label="Assinados" value={payload.counts.signed} icon={CheckCircle2} tone="green" />
          <Metric label="Projetos antigos" value={payload.counts.legacy} icon={FileSignature} tone="gray" />
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="flex flex-col gap-3 border-b border-[#ECECEC] p-4 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-3 text-[#999]" />
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                  placeholder="Buscar projeto ou cliente"
                  className="h-10 w-full rounded-lg border border-[#D9D9D9] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </label>
              <select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
                aria-label="Filtrar por status"
                className="h-10 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm"
              >
                <option value="">Todos os status</option>
                {Object.entries(CONTRACT_CENTER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {error ? <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {loading ? (
              <div className="space-y-2 p-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-[#F5F5F5]" />)}</div>
            ) : payload.items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <FileSignature className="mx-auto text-[#C8C8C8]" />
                <p className="mt-3 text-sm font-semibold text-[#333]">Nenhum contrato encontrado</p>
                <p className="mt-1 text-xs text-[#888]">Os contratos dos projetos aparecerão aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#ECECEC]">
                {payload.items.map((row) => {
                  const canRemind = reminderIsAvailable(row)
                  return (
                    <div key={row.id} className="grid gap-3 px-4 py-4 hover:bg-[#FAFAFA] md:grid-cols-[minmax(190px,1.4fr)_minmax(130px,1fr)_150px_auto] md:items-center">
                      <div className="min-w-0">
                        <Link href={`/dashboard/projects/${row.id}#contrato`} className="truncate text-sm font-semibold text-[#121212] hover:text-[#FF6B00]">{row.name}</Link>
                        <p className="mt-1 truncate text-xs text-[#777]">{row.clientName} · {row.managerName}</p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>{CONTRACT_CENTER_STATUS_LABELS[row.status]}</span>
                        {row.contract?.version ? <p className="mt-1 text-[11px] text-[#999]">Versão {row.contract.version}</p> : null}
                      </div>
                      <div className="text-xs text-[#777]">
                        {row.contract?.signedAt
                          ? `Assinado em ${formatDate(row.contract.signedAt)}`
                          : row.contract?.viewedAt
                            ? `Visto em ${formatDate(row.contract.viewedAt)}`
                            : row.contract?.sentAt
                              ? `Enviado em ${formatDate(row.contract.sentAt)}`
                              : 'Ainda não enviado'}
                        {row.contract?.reminderCount ? <p className="mt-1">{row.contract.reminderCount} lembrete{row.contract.reminderCount !== 1 ? 's' : ''}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status === 'SIGNED' && row.contract ? (
                          <a href={`/api/projects/${row.id}/contracts/${row.contract.id}/document`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]">PDF <ExternalLink size={13} /></a>
                        ) : null}
                        {canRemind ? (
                          <button type="button" disabled={busyId === row.id} onClick={() => void remind(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FF6B00] px-3 text-xs font-semibold text-[#FF6B00] hover:bg-orange-50 disabled:opacity-50"><MessageCircle size={14} /> Lembrar</button>
                        ) : null}
                        <Link href={`/dashboard/projects/${row.id}#contrato`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#121212] px-3 text-xs font-semibold text-white hover:bg-[#292929]">Abrir <ArrowRight size={13} /></Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#ECECEC] px-4 py-3">
              <p className="text-xs text-[#777]">{payload.total} contrato{payload.total !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] disabled:opacity-40"><ArrowLeft size={14} /></button>
                <span className="flex h-8 items-center px-2 text-xs text-[#666]">{page} de {payload.totalPages}</span>
                <button type="button" aria-label="Próxima página" disabled={page >= payload.totalPages} onClick={() => setPage((value) => value + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] disabled:opacity-40"><ArrowRight size={14} /></button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof FileSignature; tone: 'amber' | 'blue' | 'green' | 'gray' }) {
  const colors = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', gray: 'bg-[#F5F5F5] text-[#666]' }
  return (
    <Card><CardBody className="flex items-center gap-3 p-4"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={17} /></span><span><strong className="block text-xl text-[#121212]">{value}</strong><span className="text-xs text-[#777]">{label}</span></span></CardBody></Card>
  )
}
