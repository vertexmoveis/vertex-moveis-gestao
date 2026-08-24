'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSignature,
  Loader2,
  MessageCircle,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

type ProjectContract = {
  id: string
  version: number
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID' | 'EXPIRED'
  url: string | null
  sentAt: string | null
  viewedAt: string | null
  lastReminderAt: string | null
  reminderCount: number
  expiresAt: string | null
  signedAt: string | null
  voidedAt: string | null
  signatoryName: string | null
  signatureMethod: string | null
  signatureRecordedAt: string | null
  createdAt: string
}

async function fetchContracts(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/contracts`, { cache: 'no-store' })
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível carregar os contratos.')
  }
  return Array.isArray(payload) ? payload as ProjectContract[] : []
}

const STATUS: Record<ProjectContract['status'], { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700' },
  SENT: { label: 'Aguardando aceite', className: 'bg-amber-50 text-amber-800' },
  SIGNED: { label: 'Aceito', className: 'bg-emerald-50 text-emerald-700' },
  VOID: { label: 'Cancelado', className: 'bg-red-50 text-red-700' },
  EXPIRED: { label: 'Expirado', className: 'bg-slate-100 text-slate-600' },
}

export function ProjectContractsCard({
  projectId,
  projectName,
  clientName,
  whatsapp,
  isAdmin,
  requirement,
  waivedReason,
  waivedBy,
  revisionRequiredAt,
  revisionChanges,
  onWorkflowChange,
}: {
  projectId: string
  projectName: string
  clientName: string
  whatsapp: string | null
  isAdmin: boolean
  requirement: 'REQUIRED' | 'OPTIONAL_LEGACY' | 'WAIVED'
  waivedReason: string | null
  waivedBy: string | null
  revisionRequiredAt: string | null
  revisionChanges: string[] | null
  onWorkflowChange: () => void
}) {
  const [contracts, setContracts] = useState<ProjectContract[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [policyBusy, setPolicyBusy] = useState(false)
  const [showWaiver, setShowWaiver] = useState(false)
  const [waiverReason, setWaiverReason] = useState('')
  const [reminderReady, setReminderReady] = useState(true)

  const load = useCallback(async () => {
    try {
      const rows = await fetchContracts(projectId)
      setContracts(rows)
      const lastReminderAt = rows[0]?.lastReminderAt
      setReminderReady(!lastReminderAt || new Date(lastReminderAt).getTime() + 24 * 60 * 60 * 1000 <= Date.now())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os contratos.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const refresh = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const current = contracts[0] || null
  const phone = useMemo(() => (whatsapp || '').replace(/\D/g, ''), [whatsapp])
  const whatsappHref = current?.url && phone
    ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(
        `Olá, ${clientName}! Preparei o contrato do projeto ${projectName}. Você pode conferir e registrar o aceite por este link:\n${current.url}`,
      )}`
    : null
  const nextReminderAt = current?.lastReminderAt
    ? new Date(new Date(current.lastReminderAt).getTime() + 24 * 60 * 60 * 1000)
    : null
  const canRemind = reminderReady
  const policyLabel = requirement === 'REQUIRED'
    ? 'Obrigatório para liberar a produção'
    : requirement === 'OPTIONAL_LEGACY'
      ? 'Opcional para este projeto antigo'
      : 'Dispensado pelo administrador'

  const create = async () => {
    if (
      current?.status === 'SENT'
      && !window.confirm('Já existe um contrato aguardando aceite. Criar uma nova versão e cancelar o link atual?')
    ) return

    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/projects/${projectId}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível criar o contrato.')
      return
    }
    setMessage('Nova versão criada. O link está pronto para envio.')
    await load()
    onWorkflowChange()
  }

  const copy = async () => {
    if (!current?.url) return
    await navigator.clipboard.writeText(current.url)
    setMessage('Link do contrato copiado.')
  }

  const cancel = async () => {
    if (!current || !window.confirm('Cancelar este contrato? O cliente não poderá mais aceitá-lo.')) return
    setBusy(true)
    setMessage('')
    const response = await fetch(
      `/api/projects/${projectId}/contracts?contractId=${encodeURIComponent(current.id)}`,
      { method: 'DELETE' },
    )
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível cancelar o contrato.')
      return
    }
    setMessage('Contrato cancelado.')
    await load()
    onWorkflowChange()
  }

  const updatePolicy = async (
    nextRequirement: 'REQUIRED' | 'OPTIONAL_LEGACY' | 'WAIVED',
  ) => {
    setPolicyBusy(true)
    setMessage('')
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractRequirement: nextRequirement,
        ...(nextRequirement === 'WAIVED' ? { contractWaiverReason: waiverReason.trim() } : {}),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setPolicyBusy(false)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível alterar a regra do contrato.')
      return
    }
    setShowWaiver(false)
    setWaiverReason('')
    setMessage('Regra do contrato atualizada e registrada no histórico.')
    onWorkflowChange()
  }

  const registerReminder = async () => {
    if (!current || !canRemind) return
    const response = await fetch(`/api/projects/${projectId}/contracts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: current.id }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível registrar o lembrete.')
      return
    }
    setMessage('Lembrete registrado no histórico do projeto.')
    await load()
    onWorkflowChange()
  }

  return (
    <Card id="contrato" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSignature size={16} className="text-[#FF6B00]" />
            <div>
              <h3 className="text-sm font-semibold text-[#121212]">Contrato digital</h3>
              <p className="mt-1 text-xs text-[#777]">Versão congelada, link seguro e aceite registrado</p>
            </div>
          </div>
          {!loading ? (
            <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => void create()}>
              <Plus size={14} />
              {current ? 'Nova versão' : 'Criar contrato'}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {revisionRequiredAt ? (
          <div className="border-l-2 border-red-500 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-800">Nova versão necessária</p>
            <p className="mt-1 text-[11px] leading-4 text-red-700">
              O contrato anterior foi invalidado após alteração de {revisionChanges?.length ? revisionChanges.join(', ') : 'dados comerciais'}.
              Gere uma nova versão e envie ao cliente.
            </p>
          </div>
        ) : null}
        <div className={`border-l-2 px-3 py-2.5 ${requirement === 'REQUIRED' ? 'border-blue-500 bg-blue-50/70' : 'border-amber-500 bg-amber-50/70'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#555]" />
              <div>
                <p className="text-xs font-semibold text-[#222]">{policyLabel}</p>
                {requirement === 'WAIVED' ? (
                  <p className="mt-1 text-[11px] leading-4 text-[#666]">
                    {waivedReason || 'Sem justificativa registrada'}{waivedBy ? ` · por ${waivedBy}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                {requirement !== 'REQUIRED' ? (
                  <button type="button" disabled={policyBusy} onClick={() => void updatePolicy('REQUIRED')} className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50">
                    Tornar obrigatório
                  </button>
                ) : null}
                {requirement !== 'OPTIONAL_LEGACY' ? (
                  <button type="button" disabled={policyBusy} onClick={() => void updatePolicy('OPTIONAL_LEGACY')} className="text-[11px] font-semibold text-[#666] hover:underline disabled:opacity-50">
                    Marcar como antigo
                  </button>
                ) : null}
                {requirement !== 'WAIVED' ? (
                  <button type="button" disabled={policyBusy} onClick={() => setShowWaiver((value) => !value)} className="text-[11px] font-semibold text-amber-800 hover:underline disabled:opacity-50">
                    Dispensar contrato
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {showWaiver && isAdmin ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={waiverReason}
                onChange={(event) => setWaiverReason(event.target.value)}
                maxLength={500}
                placeholder="Motivo da dispensa (obrigatório)"
                className="h-9 min-w-0 flex-1 border border-amber-300 bg-white px-3 text-xs outline-none focus:border-[#FF6B00]"
              />
              <Button type="button" size="sm" loading={policyBusy} disabled={waiverReason.trim().length < 5} onClick={() => void updatePolicy('WAIVED')}>
                Confirmar dispensa
              </Button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="flex min-h-20 items-center justify-center">
            <Loader2 size={18} className="animate-spin text-[#777]" />
          </div>
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#121212]">Versão {current.version}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS[current.status].className}`}>
                    {STATUS[current.status].label}
                  </span>
                </div>
                {current.signedAt ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    {current.signatureMethod === 'IN_PERSON' ? 'Assinado presencialmente por' : 'Aceito digitalmente por'} {current.signatoryName || 'cliente'} em{' '}
                    {new Intl.DateTimeFormat('pt-BR', current.signatureMethod === 'IN_PERSON'
                      ? { dateStyle: 'short', timeZone: 'UTC' }
                      : { dateStyle: 'short', timeStyle: 'short' }).format(new Date(current.signedAt))}
                  </p>
                ) : current.status === 'SENT' ? (
                  <div className="mt-1 space-y-0.5 text-xs text-[#777]">
                    {current.viewedAt ? (
                      <p className="font-medium text-blue-700">
                        Visualizado pelo cliente em {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(current.viewedAt))}
                      </p>
                    ) : <p>Ainda não visualizado pelo cliente</p>}
                    {current.expiresAt ? (
                      <p>Link válido até {new Intl.DateTimeFormat('pt-BR').format(new Date(current.expiresAt))}</p>
                    ) : null}
                    {current.lastReminderAt ? (
                      <p>
                        Última cobrança em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(current.lastReminderAt))}
                        {' · '}{current.reminderCount} lembrete{current.reminderCount !== 1 ? 's' : ''}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {current.status === 'SIGNED'
                ? <CheckCircle2 size={20} className="text-emerald-600" />
                : current.status === 'VOID' || current.status === 'EXPIRED'
                  ? <XCircle size={20} className="text-slate-500" />
                  : <FileSignature size={20} className="text-amber-600" />}
            </div>

            {current.url ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]"
                >
                  <Copy size={14} />
                  Copiar link
                </button>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]"
                >
                  <ExternalLink size={14} />
                  Abrir
                </a>
                {whatsappHref && current.status === 'SENT' ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!canRemind}
                    onClick={(event) => {
                      if (!canRemind) {
                        event.preventDefault()
                        setMessage(`Aguarde até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(nextReminderAt!)} para registrar outro lembrete.`)
                        return
                      }
                      void registerReminder()
                    }}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${canRemind ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'cursor-not-allowed border-[#E5E5E5] text-[#AAA]'}`}
                  >
                    <MessageCircle size={14} />
                    {current.reminderCount > 0 ? 'Cobrar aceite' : 'Enviar no WhatsApp'}
                  </a>
                ) : null}
                {current.status === 'SIGNED' || current.status === 'SENT' ? (
                  <a
                    href={`/api/projects/${projectId}/contracts/${current.id}/document`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]"
                  >
                    <FileSignature size={14} />
                    {current.status === 'SIGNED' ? 'Contrato assinado em PDF' : 'Visualizar contrato em PDF'}
                  </a>
                ) : null}
                {current.status === 'SENT' ? (
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Cancelar link
                  </button>
                ) : null}
              </div>
            ) : null}
            {contracts.length > 1 ? (
              <p className="text-xs text-[#777]">
                {contracts.length - 1} versão{contracts.length - 1 !== 1 ? 'ões' : ''} anterior{contracts.length - 1 !== 1 ? 'es' : ''} preservada{contracts.length - 1 !== 1 ? 's' : ''} no histórico.
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D9D9D9] p-4 text-center">
            <p className="text-sm font-semibold text-[#121212]">Nenhum contrato criado</p>
            <p className="mt-1 text-xs leading-5 text-[#777]">
              Gere o contrato quando valores, prazo e parcelamento estiverem confirmados.
            </p>
            <Button type="button" size="sm" loading={busy} onClick={() => void create()} className="mt-3">
              <FileSignature size={14} />
              Criar contrato
            </Button>
          </div>
        )}
        {message ? <p role="status" className="text-xs text-[#666]">{message}</p> : null}
      </CardBody>
    </Card>
  )
}
