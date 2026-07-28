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
  expiresAt: string | null
  signedAt: string | null
  voidedAt: string | null
  signatoryName: string | null
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
}: {
  projectId: string
  projectName: string
  clientName: string
  whatsapp: string | null
}) {
  const [contracts, setContracts] = useState<ProjectContract[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      setContracts(await fetchContracts(projectId))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os contratos.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    let canceled = false
    void fetchContracts(projectId)
      .then((rows) => {
        if (!canceled) setContracts(rows)
      })
      .catch((error) => {
        if (!canceled) {
          setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os contratos.')
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [projectId])

  const current = contracts[0] || null
  const phone = useMemo(() => (whatsapp || '').replace(/\D/g, ''), [whatsapp])
  const whatsappHref = current?.url && phone
    ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(
        `Olá, ${clientName}! Preparei o contrato do projeto ${projectName}. Você pode conferir e registrar o aceite por este link:\n${current.url}`,
      )}`
    : null

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
                    Aceito por {current.signatoryName || 'cliente'} em{' '}
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(current.signedAt))}
                  </p>
                ) : current.expiresAt && current.status === 'SENT' ? (
                  <p className="mt-1 text-xs text-[#777]">
                    Link válido até {new Intl.DateTimeFormat('pt-BR').format(new Date(current.expiresAt))}
                  </p>
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
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <MessageCircle size={14} />
                    Enviar no WhatsApp
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
