'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2, Loader2, MessageCircle, Unlink } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

export function ProjectPortalCard({
  projectId,
  clientName,
  whatsapp,
}: {
  projectId: string
  clientName: string
  whatsapp: string | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}/portal`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        setUrl(payload.url || null)
        setLastViewedAt(payload.lastViewedAt || null)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const generate = async () => {
    setBusy(true)
    const response = await fetch(`/api/projects/${projectId}/portal`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (response.ok) {
      setUrl(payload.url)
      setLastViewedAt(null)
      setMessage('Link criado. Ele substitui qualquer link anterior.')
    } else {
      setMessage(payload.error || 'Não foi possível criar o link.')
    }
  }

  const revoke = async () => {
    if (!window.confirm('Desativar o link de acompanhamento deste projeto?')) return
    setBusy(true)
    const response = await fetch(`/api/projects/${projectId}/portal`, { method: 'DELETE' })
    setBusy(false)
    if (response.ok) {
      setUrl(null)
      setLastViewedAt(null)
      setMessage('Link desativado.')
    }
  }

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setMessage('Link copiado.')
  }

  const phone = (whatsapp || '').replace(/\D/g, '')
  const whatsappHref = url && phone
    ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(
        `Olá, ${clientName}! Você pode acompanhar o andamento do seu projeto da Vertex Móveis por este link:\n${url}`,
      )}`
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-[#FF6B00]" />
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Acompanhamento do cliente</h3>
            <p className="mt-1 text-xs text-[#777]">Andamento e prazo sem expor dados internos</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {loading ? (
          <div className="flex min-h-16 items-center justify-center"><Loader2 size={17} className="animate-spin" /></div>
        ) : url ? (
          <>
            <p className="break-all border border-[#E8E8E8] bg-[#FAFAFA] p-2 text-xs text-[#555]">{url}</p>
            {lastViewedAt ? (
              <p className="text-xs text-emerald-700">
                Visualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastViewedAt))}
              </p>
            ) : <p className="text-xs text-[#777]">O cliente ainda não abriu este link.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-2 border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]">
                <Copy size={14} /> Copiar
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]">
                <ExternalLink size={14} /> Abrir
              </a>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  <MessageCircle size={14} /> WhatsApp
                </a>
              ) : null}
              <button type="button" onClick={() => void revoke()} disabled={busy} title="Desativar link" className="inline-flex h-9 w-9 items-center justify-center border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Unlink size={14} />
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => void generate()} disabled={busy} className="inline-flex h-10 items-center gap-2 bg-[#FF6B00] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Criar link seguro
          </button>
        )}
        {message ? <p className="text-xs text-[#666]">{message}</p> : null}
      </CardBody>
    </Card>
  )
}
