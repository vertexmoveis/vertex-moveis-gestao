'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, MessageSquareText, ShieldCheck, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, Textarea, Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  PUBLIC_WARRANTY_CATEGORIES,
  PUBLIC_WARRANTY_CATEGORY_LABELS,
  type PublicWarrantyCategory,
} from '@/lib/project-portal-support'
import { WARRANTY_STATUS_LABELS, type WarrantyStatus } from '@/lib/warranty'

type PublicTicket = {
  id: string
  title: string
  status: WarrantyStatus
  openedAt: string
  resolution: string | null
}

type PublicChange = {
  id: string
  title: string
  description: string
  amountDelta: number
  daysDelta: number
  status: string
}

export function PublicProjectSupport({
  token,
  canOpenWarranty,
  warrantyLabel,
  tickets,
  changes,
}: {
  token: string
  canOpenWarranty: boolean
  warrantyLabel: string | null
  tickets: PublicTicket[]
  changes: PublicChange[]
}) {
  const [category, setCategory] = useState<PublicWarrantyCategory>('DOOR_DRAWER')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [respondentName, setRespondentName] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})

  const sendWarranty = async () => {
    setBusy('warranty')
    setMessage('')
    const response = await fetch(`/api/public/project-portals/${token}/warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, description }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy('')
    setMessage(payload.message || payload.error || 'Não foi possível enviar o pedido.')
    if (response.ok) {
      setDescription('')
      window.setTimeout(() => window.location.reload(), 900)
    }
  }

  const decideChange = async (changeId: string, decision: 'APPROVE' | 'REJECT') => {
    setBusy(changeId)
    setMessage('')
    const response = await fetch(`/api/public/project-portals/${token}/changes/${changeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        respondentName,
        note: notes[changeId] || undefined,
        acceptedTerms: accepted[changeId] || false,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy('')
    setMessage(payload.message || payload.error || 'Não foi possível registrar a resposta.')
    if (response.ok) window.setTimeout(() => window.location.reload(), 900)
  }

  const pendingChanges = changes.filter((change) => change.status === 'SENT')
  const answeredChanges = changes.filter((change) => change.status !== 'SENT')

  return (
    <div className="space-y-5">
      {changes.length > 0 ? (
        <section className="bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <MessageSquareText size={20} className="mt-0.5 text-[#FF6B00]" />
            <div>
              <h2 className="text-base font-extrabold">Alterações do projeto</h2>
              <p className="mt-1 text-xs text-[#777]">Confira valor e prazo antes de responder.</p>
            </div>
          </div>

          {pendingChanges.length > 0 ? (
            <div className="mt-5 space-y-4">
              <Input label="Seu nome" value={respondentName} onChange={(event) => setRespondentName(event.target.value)} />
              {pendingChanges.map((change) => (
                <div key={change.id} className="border border-[#E5E5E5] p-4">
                  <h3 className="text-sm font-extrabold">{change.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#555]">{change.description}</p>
                  <div className="mt-3 grid gap-2 bg-[#F7F7F7] p-3 text-sm sm:grid-cols-2">
                    <span>Ajuste de valor: <strong>{formatCurrency(change.amountDelta)}</strong></span>
                    <span>Prazo adicional: <strong>{change.daysDelta} dia(s) útil(eis)</strong></span>
                  </div>
                  <Textarea label="Observação (obrigatória ao recusar)" rows={3} value={notes[change.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [change.id]: event.target.value }))} className="mt-3" />
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#555]">
                    <input type="checkbox" className="mt-1" checked={accepted[change.id] || false} onChange={(event) => setAccepted((current) => ({ ...current, [change.id]: event.target.checked }))} />
                    Li e concordo com a descrição, o ajuste de valor e o prazo informado.
                  </label>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => void decideChange(change.id, 'REJECT')} disabled={busy === change.id}>Solicitar revisão</Button>
                    <Button type="button" onClick={() => void decideChange(change.id, 'APPROVE')} disabled={busy === change.id || !accepted[change.id]}>
                      {busy === change.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Aceitar alteração
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {answeredChanges.length > 0 ? (
            <div className="mt-4 divide-y divide-[#ECECEC] border border-[#E8E8E8]">
              {answeredChanges.map((change) => (
                <div key={change.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-semibold">{change.title}</span>
                  <span className="text-xs font-semibold text-[#666]">
                    {change.status === 'CLIENT_APPROVED' ? 'Aceita, aguardando Vertex' : change.status === 'CLIENT_REJECTED' ? 'Revisão solicitada' : change.status === 'APPROVED' ? 'Aplicada' : 'Finalizada'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {(canOpenWarranty || tickets.length > 0) ? (
        <section className="bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-[#FF6B00]" />
            <div>
              <h2 className="text-base font-extrabold">Assistência e garantia</h2>
              <p className="mt-1 text-xs text-[#777]">{warrantyLabel || 'Acompanhe seus pedidos de assistência.'}</p>
            </div>
          </div>

          {tickets.length > 0 ? (
            <div className="mt-5 divide-y divide-[#ECECEC] border border-[#E8E8E8]">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{ticket.title}</p>
                    <span className="text-xs font-semibold text-[#B84A00]">{WARRANTY_STATUS_LABELS[ticket.status] || ticket.status}</span>
                  </div>
                  {ticket.resolution ? <p className="mt-2 text-xs leading-5 text-[#666]">Solução: {ticket.resolution}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {canOpenWarranty ? (
            <div className="mt-5 border-t border-[#ECECEC] pt-5">
              <h3 className="flex items-center gap-2 text-sm font-extrabold"><Wrench size={16} /> Abrir novo pedido</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)]">
                <Select
                  label="Assunto"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PublicWarrantyCategory)}
                  options={PUBLIC_WARRANTY_CATEGORIES.map((value) => ({ value, label: PUBLIC_WARRANTY_CATEGORY_LABELS[value] }))}
                />
                <Textarea label="Descreva o que aconteceu" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => void sendWarranty()} disabled={busy === 'warranty' || description.trim().length < 10}>
                {busy === 'warranty' ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />} Enviar pedido de assistência
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="border border-[#FFD7BA] bg-[#FFF7F1] px-4 py-3 text-sm font-semibold text-[#9A3E00]">{message}</p> : null}
    </div>
  )
}
