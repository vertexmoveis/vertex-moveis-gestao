'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { formatDateOnly, dateOnlyKey } from '@/lib/date-only'
import {
  WARRANTY_PRIORITY_LABELS,
  WARRANTY_STATUS_LABELS,
  type WarrantyPriority,
  type WarrantyStatus,
} from '@/lib/warranty'

type WarrantyTicket = {
  id: string
  title: string
  description: string
  priority: WarrantyPriority
  status: WarrantyStatus
  openedAt: string
  scheduledAt: string | null
  resolvedAt: string | null
  resolution: string | null
  assignedTo: { id: string; name: string } | null
}

async function fetchWarrantyTickets(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/warranty`, { cache: 'no-store' })
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível carregar os chamados.')
  }
  return Array.isArray(payload) ? payload as WarrantyTicket[] : []
}

const priorityClass: Record<WarrantyPriority, string> = {
  NORMAL: 'bg-slate-100 text-slate-700',
  HIGH: 'bg-amber-50 text-amber-800',
  URGENT: 'bg-red-50 text-red-700',
}

export function ProjectWarrantyCard({
  projectId,
  warrantyEndsAt,
}: {
  projectId: string
  warrantyEndsAt: string | null
}) {
  const [tickets, setTickets] = useState<WarrantyTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<WarrantyPriority>('NORMAL')
  const [scheduledAt, setScheduledAt] = useState('')
  const [ticketDates, setTicketDates] = useState<Record<string, string>>({})
  const [resolutions, setResolutions] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const rows = await fetchWarrantyTickets(projectId)
      setTickets(rows)
      setTicketDates(Object.fromEntries(rows.map((ticket) => [
        ticket.id,
        ticket.scheduledAt ? dateOnlyKey(ticket.scheduledAt) || '' : '',
      ])))
      setResolutions(Object.fromEntries(rows.map((ticket) => [ticket.id, ticket.resolution || ''])))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os chamados.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    let canceled = false
    void fetchWarrantyTickets(projectId)
      .then((rows) => {
        if (canceled) return
        setTickets(rows)
        setTicketDates(Object.fromEntries(rows.map((ticket) => [
          ticket.id,
          ticket.scheduledAt ? dateOnlyKey(ticket.scheduledAt) || '' : '',
        ])))
        setResolutions(Object.fromEntries(rows.map((ticket) => [ticket.id, ticket.resolution || ''])))
      })
      .catch((error) => {
        if (!canceled) {
          setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os chamados.')
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [projectId])

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status !== 'RESOLVED' && ticket.status !== 'CANCELED').length,
    [tickets],
  )

  const create = async () => {
    setBusyId('new')
    setMessage('')
    const response = await fetch(`/api/projects/${projectId}/warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority, scheduledAt }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId(null)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível abrir o chamado.')
      return
    }
    setTitle('')
    setDescription('')
    setPriority('NORMAL')
    setScheduledAt('')
    setShowForm(false)
    setMessage('Chamado aberto e incluído no histórico do projeto.')
    await load()
  }

  const update = async (ticketId: string, data: Record<string, unknown>) => {
    setBusyId(ticketId)
    setMessage('')
    const response = await fetch(`/api/projects/${projectId}/warranty/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId(null)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível atualizar o chamado.')
      return
    }
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? payload : ticket))
    setMessage('Chamado atualizado.')
  }

  return (
    <Card id="garantia" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-[#121212]">Chamados de garantia</h3>
              <p className="mt-1 text-xs text-[#777]">
                {warrantyEndsAt
                  ? `Garantia registrada até ${formatDateOnly(warrantyEndsAt)}`
                  : 'Registro de ocorrências, visitas e soluções'}
              </p>
            </div>
          </div>
          {!loading ? (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              aria-expanded={showForm}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]"
            >
              {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
              {showForm ? 'Fechar' : 'Novo chamado'}
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {showForm ? (
          <div className="space-y-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
            <Input
              label="Assunto"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Regular porta do armário"
              maxLength={120}
            />
            <Textarea
              label="O que aconteceu?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva o problema e em qual ambiente ele ocorreu."
              maxLength={2000}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Prioridade"
                value={priority}
                onChange={(event) => setPriority(event.target.value as WarrantyPriority)}
                options={Object.entries(WARRANTY_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Agendar visita"
                type="date"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              loading={busyId === 'new'}
              disabled={title.trim().length < 3 || description.trim().length < 3}
              onClick={() => void create()}
            >
              <Plus size={14} />
              Abrir chamado
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-20 items-center justify-center">
            <Loader2 size={18} className="animate-spin text-[#777]" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#D9D9D9] p-4 text-center">
            <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-[#121212]">Nenhum chamado registrado</p>
            <p className="mt-1 text-xs text-[#777]">Quando houver um ajuste, registre aqui para acompanhar até a solução.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#777]">{openCount} chamado{openCount !== 1 ? 's' : ''} em aberto</p>
            {tickets.map((ticket) => {
              const closed = ticket.status === 'RESOLVED' || ticket.status === 'CANCELED'
              return (
                <div key={ticket.id} className="rounded-lg border border-[#E8E8E8] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[#121212]">{ticket.title}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityClass[ticket.priority]}`}>
                          {WARRANTY_PRIORITY_LABELS[ticket.priority]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#666]">{ticket.description}</p>
                    </div>
                    <span className="rounded-full bg-[#F3F3F3] px-2 py-1 text-[10px] font-semibold text-[#555]">
                      {WARRANTY_STATUS_LABELS[ticket.status]}
                    </span>
                  </div>

                  {closed ? (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                      {ticket.status === 'RESOLVED'
                        ? ticket.resolution || 'Chamado resolvido.'
                        : 'Chamado cancelado.'}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 border-t border-[#EFEFEF] pt-3">
                      <Select
                        label="Andamento"
                        value={ticket.status}
                        disabled={busyId === ticket.id}
                        onChange={(event) => void update(ticket.id, { status: event.target.value })}
                        options={[
                          'OPEN',
                          'IN_PROGRESS',
                          'WAITING_PARTS',
                          'SCHEDULED',
                          'CANCELED',
                        ].map((value) => ({
                          value,
                          label: WARRANTY_STATUS_LABELS[value as WarrantyStatus],
                        }))}
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Input
                          label="Data da visita"
                          type="date"
                          value={ticketDates[ticket.id] || ''}
                          onChange={(event) => setTicketDates((current) => ({
                            ...current,
                            [ticket.id]: event.target.value,
                          }))}
                        />
                        <button
                          type="button"
                          title="Salvar data da visita"
                          disabled={busyId === ticket.id}
                          onClick={() => void update(ticket.id, {
                            scheduledAt: ticketDates[ticket.id] || null,
                            status: ticketDates[ticket.id] ? 'SCHEDULED' : ticket.status,
                          })}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5] disabled:opacity-50"
                        >
                          <CalendarClock size={14} />
                          Agendar
                        </button>
                      </div>
                      <Textarea
                        label="Solução aplicada"
                        value={resolutions[ticket.id] || ''}
                        onChange={(event) => setResolutions((current) => ({
                          ...current,
                          [ticket.id]: event.target.value,
                        }))}
                        placeholder="Descreva o ajuste realizado antes de concluir."
                      />
                      <Button
                        type="button"
                        size="sm"
                        loading={busyId === ticket.id}
                        disabled={(resolutions[ticket.id] || '').trim().length < 3}
                        onClick={() => void update(ticket.id, {
                          status: 'RESOLVED',
                          resolution: resolutions[ticket.id],
                        })}
                      >
                        <Wrench size={14} />
                        Concluir atendimento
                      </Button>
                    </div>
                  )}

                  {closed ? (
                    <button
                      type="button"
                      disabled={busyId === ticket.id}
                      onClick={() => void update(ticket.id, { status: 'OPEN', resolution: null })}
                      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5] disabled:opacity-50"
                    >
                      <Save size={13} />
                      Reabrir
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {message ? <p role="status" className="text-xs text-[#666]">{message}</p> : null}
      </CardBody>
    </Card>
  )
}
