'use client'

import { ArrowLeft, CheckCircle2, Copy, Edit3, FileText, FolderOpen, MessageCircle, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { QuoteForm, type QuotePayload } from '@/components/quotes/quote-form'
import {
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_DIFFICULTY_LABELS,
  QUOTE_STATUS_BG,
  QUOTE_STATUS_LABELS,
  getQuoteItemPricePerM2,
  getQuotePaymentSummary,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  safeQuoteCalculationMode,
  safeQuoteDifficulty,
  type QuoteStatus,
} from '@/lib/quotes'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { QuoteData } from '@/types/quotes'

type ClientOption = {
  id: string
  name: string
}

type ClientResponse = {
  id: string
  name: string
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOptionsLoading, setEditOptionsLoading] = useState(false)
  const [editOptionsError, setEditOptionsError] = useState('')
  const [error, setError] = useState('')
  const [approvalUrl, setApprovalUrl] = useState('')
  const [approvalMessage, setApprovalMessage] = useState('')
  const [approvalFeedback, setApprovalFeedback] = useState('')

  const loadQuote = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/quotes/${params.id}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Orçamento não encontrado.')
      setQuote(data)
    } catch (loadError) {
      setQuote(null)
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o orçamento.')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    let active = true
    fetch(`/api/quotes/${params.id}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!active) return
        if (!response.ok || !data?.id) {
          setQuote(null)
          setError(data?.error || 'Orçamento não encontrado.')
          return
        }
        setQuote(data)
      })
      .catch(() => {
        if (!active) return
        setQuote(null)
        setError('Não foi possível carregar o orçamento.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [params.id])

  const openEdit = async () => {
    setModalOpen(true)
    if (clients.length > 0) return

    setEditOptionsLoading(true)
    setEditOptionsError('')
    try {
      const response = await fetch('/api/clients?options=1')
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error('Não foi possível carregar os clientes.')
      setClients(Array.isArray(data) ? data.map((client: ClientResponse) => ({ id: client.id, name: client.name })) : [])
    } catch (loadError) {
      setEditOptionsError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os clientes.')
    } finally {
      setEditOptionsLoading(false)
    }
  }

  const environments = useMemo(() => {
    if (!quote) return []
    return Array.from(new Set(quote.items.map((item) => item.environment).filter(Boolean)))
  }, [quote])

  const handleUpdate = async (payload: QuotePayload) => {
    const response = await fetch(`/api/quotes/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível salvar o orçamento.')
    }
    setQuote(data)
    if (data.approvalReset) {
      setApprovalUrl('')
      setApprovalMessage('')
      setApprovalFeedback('A proposta mudou. O link anterior foi cancelado e será necessário enviá-la novamente ao cliente.')
    }
    setModalOpen(false)
  }

  const updateStatus = async (status: QuoteStatus) => {
    setSaving(true)
    const response = await fetch(`/api/quotes/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await response.json()
    if (response.ok) {
      setQuote(data)
    }
    setSaving(false)
  }

  const convertToProject = async () => {
    setSaving(true)
    setError('')
    const response = await fetch(`/api/quotes/${params.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível transformar em projeto.')
      return
    }
    router.push(`/dashboard/projects/${data.project.id}`)
  }

  const deleteQuote = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.')) return

    setSaving(true)
    setError('')
    const response = await fetch(`/api/quotes/${params.id}`, {
      method: 'DELETE',
    })
    setSaving(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data?.error || 'Não foi possível excluir o orçamento.')
      return
    }

    router.push('/dashboard/quotes')
  }

  const sendApprovalRequest = async (reminder = false) => {
    if (!quote) return

    const canOpenWhatsApp = Boolean(quote.client?.whatsapp || quote.client?.phone)
    const messageWindow = canOpenWhatsApp ? window.open('', '_blank') : null
    setSaving(true)
    setError('')
    setApprovalMessage('')
    setApprovalFeedback('')

    const response = await fetch(`/api/quotes/${params.id}/approval-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      messageWindow?.close()
      setError(data?.error || 'Não foi possível preparar a aprovação do cliente.')
      return
    }

    setApprovalUrl(data.approvalUrl || '')
    setApprovalMessage(data.message || '')
    setApprovalFeedback(
      data.whatsAppUrl
        ? reminder ? 'Mensagem de retorno preparada no WhatsApp com o orçamento e o link de aprovação.' : 'Mensagem preparada no WhatsApp com o orçamento e o link de aprovação.'
        : 'Link de aprovação criado. Copie-o para enviar ao cliente.'
    )
    setQuote((current) => current ? { ...current, status: data.quoteStatus || current.status } : current)

    if (data.whatsAppUrl) {
      if (messageWindow) {
        messageWindow.location.href = data.whatsAppUrl
      } else {
        window.open(data.whatsAppUrl, '_blank')
      }
    } else {
      messageWindow?.close()
    }
  }

  const copyApprovalUrl = async () => {
    if (!approvalUrl) return
    try {
      await navigator.clipboard.writeText(approvalUrl)
      setApprovalFeedback('Link de aprovação copiado.')
    } catch {
      setApprovalFeedback('Copie o link exibido abaixo para enviar ao cliente.')
    }
  }

  const copyApprovalMessage = async () => {
    if (!approvalMessage) return
    try {
      await navigator.clipboard.writeText(approvalMessage)
      setApprovalFeedback('Mensagem copiada. Cole no WhatsApp para enviar ao cliente.')
    } catch {
      setApprovalFeedback('Não foi possível copiar a mensagem automaticamente.')
    }
  }

  const whatsappUrl = useMemo(() => {
    const client = quote?.client
    if (!client || typeof window === 'undefined') return ''
    const contactNumber = client.whatsapp || client.phone
    if (!contactNumber) return ''
    const phone = contactNumber.replace(/\D/g, '')
    const whatsAppNumber = phone.startsWith('55') ? phone : `55${phone}`
    const message = [
      `Olá, ${client.name}!`,
      '',
      `Segue o orçamento ${quote.title} no valor de ${formatCurrency(quote.total)}.`,
      `Para conferir e aprovar, abra a proposta: ${window.location.origin}/api/quotes/${quote.id}/proposal`,
      '',
      'Se estiver tudo certo, me responda com "aprovado" para iniciarmos o projeto.',
    ].join('\n')
    return `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(message)}`
  }, [quote])

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Orçamento" subtitle="Carregando..." />
        <div className="flex-1 p-6">
          <div className="h-40 animate-pulse rounded-xl border border-[#E8E8E8] bg-white" />
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Orçamento" subtitle="Não encontrado" />
        <div className="flex-1 space-y-3 p-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={() => void loadQuote()}>Tentar novamente</Button>
        </div>
      </div>
    )
  }

  const paymentSummary = getQuotePaymentSummary(quote)
  const quoteLocked = quote.status === 'SOLD' || Boolean(quote.convertedProject)

  return (
    <div className="flex h-full flex-col">
      <Header title={quote.title} subtitle={`${quote.client?.name || 'Cliente em orçamento'} • Código ${quoteDisplayCode(quote)}`} />

      <div className="flex-1 space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/dashboard/quotes" className="inline-flex items-center gap-2 text-sm text-[#777] hover:text-[#121212]">
            <ArrowLeft size={16} />
            Voltar para Orçamentos
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void openEdit()} disabled={quoteLocked} title={quoteLocked ? 'Orçamento já transformado em projeto' : 'Editar orçamento'}>
              <Edit3 size={16} />
              Editar
            </Button>
            <Button variant="danger" loading={saving} disabled={quoteLocked} onClick={deleteQuote} title={quoteLocked ? 'O orçamento vendido faz parte do histórico' : 'Excluir orçamento'}>
              <Trash2 size={16} />
              Excluir
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/quotes/${quote.id}/proposal`, '_blank')}>
              <FileText size={16} />
              Proposta/PDF
            </Button>
            <Button variant="outline" loading={saving} disabled={quoteLocked} onClick={() => void sendApprovalRequest(quote.status === 'WAITING_APPROVAL')}>
              <Send size={16} />
              {quote.status === 'WAITING_APPROVAL' ? 'Pedir retorno do cliente' : 'Enviar para aprovação'}
            </Button>
            {whatsappUrl && (
              <Button variant="outline" onClick={() => window.open(whatsappUrl, '_blank')}>
                <MessageCircle size={16} />
                WhatsApp
              </Button>
            )}
            {quote.convertedProject ? (
              <Button onClick={() => router.push(`/dashboard/projects/${quote.convertedProject?.id}`)}>
                <FolderOpen size={16} />
                Ver Projeto
              </Button>
            ) : (
              <Button loading={saving} onClick={convertToProject}>
                <CheckCircle2 size={16} />
                Transformar em Projeto
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#E8E8E8] bg-white shadow-sm">
              <div className="border-b border-[#F0F0F0] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Resumo</p>
              </div>
              <div className="space-y-4 px-5 py-4">
                <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', QUOTE_STATUS_BG[quote.status])}>
                  {QUOTE_STATUS_LABELS[quote.status]}
                </span>
                <div>
                  <p className="text-xs text-[#9E9E9E]">Cliente</p>
                  <p className="font-semibold text-[#121212]">{quote.client?.name || 'Cliente em orçamento'}</p>
                  {quote.client?.phone && <p className="text-sm text-[#777]">{quote.client.phone}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#FAFAFA] p-3">
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Total</p>
                    <p className="text-lg font-bold text-[#121212]">{formatCurrency(quote.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Lucro previsto</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(quote.profit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Custo</p>
                    <p className="font-semibold text-[#121212]">{formatCurrency(quote.costTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Validade</p>
                    <p className="font-semibold text-[#121212]">{quote.validUntil ? formatDate(quote.validUntil) : 'Sem validade'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#9E9E9E]">Ambientes</p>
                  <p className="text-sm text-[#121212]">{environments.length ? environments.join(', ') : '-'}</p>
                </div>
                <div className="border-t border-[#F0F0F0] pt-3">
                  <p className="text-xs text-[#9E9E9E]">Pagamento</p>
                  <p className="text-sm font-semibold text-[#121212]">{paymentSummary}</p>
                  {quote.paymentMethod === 'CARD' && (quote.cardDownPayment || 0) > 0 && (
                    <p className="mt-1 text-xs text-blue-700">
                      Entrada prevista: {formatCurrency(quote.cardDownPayment || 0)}
                    </p>
                  )}
                  {quote.paymentMethod === 'CARD' && (quote.cardFeeAmount || 0) > 0 && (
                    <p className="mt-1 text-xs text-[#777]">
                      Taxa da operadora ({quote.cardFeePercent || 0}%): {formatCurrency(quote.cardFeeAmount || 0)} incluída no custo
                    </p>
                  )}
                  {(quote.manualDiscount || 0) > 0 && (
                    <p className="mt-1 text-xs text-[#777]">Desconto comercial: {formatCurrency(quote.manualDiscount || 0)}</p>
                  )}
                  {(quote.paymentDiscount || 0) > 0 && (
                    <p className="mt-1 text-xs text-emerald-700">Desconto Pix: {formatCurrency(quote.paymentDiscount || 0)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E8E8E8] bg-white shadow-sm">
              <div className="border-b border-[#F0F0F0] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Aprovação</p>
              </div>
              <div className="space-y-2 px-5 py-4">
                <Button
                  type="button"
                  className="w-full justify-start"
                  loading={saving}
                  disabled={quoteLocked}
                  onClick={() => void sendApprovalRequest(quote.status === 'WAITING_APPROVAL')}
                >
                  <Send size={16} />
                  {quote.status === 'WAITING_APPROVAL' ? 'Pedir retorno do cliente' : 'Enviar para aprovação'}
                </Button>
                {approvalFeedback && <p className="rounded-lg bg-[#FFF3EA] px-3 py-2 text-xs text-[#A64200]">{approvalFeedback}</p>}
                {approvalMessage && (
                  <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">Mensagem pronta para o cliente</p>
                      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copyApprovalMessage()}>
                        <Copy size={14} />
                        Copiar
                      </Button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#555]">{approvalMessage}</p>
                  </div>
                )}
                {approvalUrl && (
                  <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">Link de aprovação</p>
                    <a href={approvalUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-[#FF6B00] hover:underline">{approvalUrl}</a>
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void copyApprovalUrl()}>
                      <Copy size={14} />
                      Copiar link
                    </Button>
                  </div>
                )}
                {(['SENT', 'WAITING_APPROVAL', 'APPROVED', 'LOST'] as QuoteStatus[]).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={quote.status === value ? 'primary' : 'outline'}
                    className="w-full justify-start"
                    loading={saving && quote.status !== value}
                    disabled={quoteLocked}
                    onClick={() => updateStatus(value)}
                  >
                    {QUOTE_STATUS_LABELS[value]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-[#E8E8E8] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#F0F0F0] px-5 py-4">
                <div>
                  <h2 className="font-semibold text-[#121212]">Móveis do orçamento</h2>
                  <p className="text-xs text-[#9E9E9E]">{quote.items.length} item{quote.items.length !== 1 ? 's' : ''} cadastrado{quote.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-[#F0F0F0]">
                {quote.items.map((item) => {
                  const calculationMode = safeQuoteCalculationMode(item.calculationMode)
                  const calculationPrice = calculationMode === 'AREA_M2'
                    ? getQuoteItemPricePerM2(item)
                    : item.manualPrice || 0
                  const calculationUnit = calculationMode === 'AREA_M2'
                    ? '/m²'
                    : calculationMode === 'LINEAR_METER' ? '/m linear' : '/un.'
                  const calculationAmount = calculationMode === 'AREA_M2'
                    ? `${(item.areaM2 || 0).toFixed(2)} m²`
                    : calculationMode === 'LINEAR_METER'
                      ? `${((item.width / 100) * item.quantity).toFixed(2)} m linear`
                      : `${item.quantity} un.`

                  return (
                  <div key={item.id || `${item.environment}-${item.description}`} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-[#121212]">{item.environment}</p>
                        <p className="mt-1 text-sm text-[#555]">{item.description}</p>
                        <p className="mt-1 text-xs text-[#9E9E9E]">
                          {quoteCentimetersToMillimeters(item.width)} x {quoteCentimetersToMillimeters(item.height)} mm
                          {item.quantity > 1 ? ` • Qtd. ${item.quantity}` : ''}
                          {' • '}
                          {formatCurrency(calculationPrice)}{calculationUnit}
                        </p>
                        {(item.material || item.finish) && (
                          <p className="mt-1 text-xs text-[#777]">{[item.material, item.finish].filter(Boolean).join(' • ')}</p>
                        )}
                        <p className="mt-1 text-xs text-[#777]">
                          Dificuldade: {QUOTE_DIFFICULTY_LABELS[safeQuoteDifficulty(item.difficulty)]}
                        </p>
                        {item.accessories && item.accessories.length > 0 && (
                          <p className="mt-1 text-xs text-[#777]">Adicionais: {item.accessories.join(', ')}</p>
                        )}
                        <p className="mt-1 text-xs text-[#9E9E9E]">{QUOTE_CALCULATION_MODE_LABELS[calculationMode]}</p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="font-bold text-[#121212]">{formatCurrency(item.totalPrice || 0)}</p>
                        <p className="text-xs text-[#9E9E9E]">{calculationAmount}</p>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {(quote.customerNotes || quote.notes) && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {quote.customerNotes && (
                  <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Mensagem para o cliente</p>
                    <p className="whitespace-pre-line text-sm text-[#555]">{quote.customerNotes}</p>
                  </div>
                )}
                {quote.notes && (
                  <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Observações internas</p>
                    <p className="whitespace-pre-line text-sm text-[#555]">{quote.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Editar Orçamento" size="xl" className="max-w-6xl">
        {editOptionsLoading ? (
          <div className="h-72 animate-pulse rounded-lg bg-[#F5F5F5]" />
        ) : editOptionsError ? (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{editOptionsError}</p>
            <Button variant="outline" onClick={() => void openEdit()}>Tentar novamente</Button>
          </div>
        ) : (
          <QuoteForm clients={clients} initialData={quote} onSubmit={handleUpdate} onCancel={() => setModalOpen(false)} />
        )}
      </Modal>
    </div>
  )
}
