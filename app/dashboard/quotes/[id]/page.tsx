'use client'

import { ArrowLeft, CheckCircle2, Copy, Edit3, FileText, FolderOpen, GitBranch, MessageCircle, Plus, Printer, Send, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { QuoteForm, type QuotePayload } from '@/components/quotes/quote-form'
import { QuoteEnvironmentImages } from '@/components/quotes/quote-environment-images'
import {
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_DIFFICULTY_LABELS,
  QUOTE_PRICE_PROFILE_LABELS,
  QUOTE_STATUS_BG,
  QUOTE_STATUS_LABELS,
  getQuoteItemPricePerM2,
  getQuotePaymentSummary,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  safeQuoteCalculationMode,
  safeQuoteDifficulty,
  safeQuotePriceProfile,
  type QuoteStatus,
} from '@/lib/quotes'
import {
  QUOTE_VARIATION_LABELS,
  QUOTE_VARIATION_TYPES,
  quoteVariationDefaultName,
  type QuoteVariationType,
} from '@/lib/quote-variations'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { QuoteData } from '@/types/quotes'
import { PAYMENT_METHODS } from '@/lib/payment-methods'

type ClientOption = {
  id: string
  name: string
}

type ClientResponse = {
  id: string
  name: string
}

function todayInputValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
  const [comparisonQuoteIds, setComparisonQuoteIds] = useState<string[]>([])
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [variantType, setVariantType] = useState<QuoteVariationType>('WOODGRAIN')
  const [variantName, setVariantName] = useState(quoteVariationDefaultName('WOODGRAIN'))
  const [variantSaving, setVariantSaving] = useState(false)
  const [variantError, setVariantError] = useState('')
  const [convertOpen, setConvertOpen] = useState(false)
  const [paymentConfirmedAt, setPaymentConfirmedAt] = useState(todayInputValue())
  const [entryPaymentMethod, setEntryPaymentMethod] = useState('PIX')

  const applyLoadedQuote = useCallback((data: QuoteData) => {
    setQuote(data)
    const candidates = data.comparisonCandidates || []
    const activeRequest = data.activeApprovalRequest
    const candidateIds = new Set(candidates.map((candidate) => candidate.id))
    const legacyLinkedQuoteIds = activeRequest
      ? [activeRequest.quoteId, activeRequest.comparisonQuoteId].filter((id): id is string => Boolean(id) && id !== data.id)
      : []
    const linkedQuoteIds = (activeRequest?.quoteIds || legacyLinkedQuoteIds)
      .filter((id) => id !== data.id && candidateIds.has(id))
    const groupedQuoteIds = (data.groupVariants || [])
      .filter((variant) => variant.id !== data.id && candidateIds.has(variant.id))
      .sort((a, b) => a.variationOrder - b.variationOrder)
      .map((variant) => variant.id)
      .slice(0, 2)

    setComparisonQuoteIds((current) => {
      if (linkedQuoteIds.length > 0) return linkedQuoteIds.slice(0, 2)
      const validCurrent = current.filter((id) => candidateIds.has(id)).slice(0, 2)
      if (validCurrent.length > 0) return validCurrent
      return groupedQuoteIds
    })
    if (activeRequest?.token) {
      setApprovalUrl(`${window.location.origin}/proposta/${activeRequest.token}`)
    }
  }, [])

  const loadQuote = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/quotes/${params.id}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Orçamento não encontrado.')
      applyLoadedQuote(data)
    } catch (loadError) {
      setQuote(null)
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o orçamento.')
    } finally {
      setLoading(false)
    }
  }, [applyLoadedQuote, params.id])

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
        applyLoadedQuote(data)
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
  }, [applyLoadedQuote, params.id])

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
    return Array.from(new Set(quote.items.map((item) => item.environmentName || item.environment).filter(Boolean)))
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
    applyLoadedQuote(data)
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

  const openConversion = () => {
    if (!quote) return
    if (quote.status !== 'APPROVED') {
      setError('O orçamento precisa estar aprovado antes de virar projeto.')
      return
    }
    if (!quote.approvalRecord || quote.approvalRecord.invalidatedAt) {
      setError('O cliente precisa aprovar a versão atual pelo link antes de criar o projeto.')
      return
    }
    setPaymentConfirmedAt(todayInputValue())
    setEntryPaymentMethod('PIX')
    setConvertOpen(true)
  }

  const convertToProject = async () => {
    if (!quote) return
    setSaving(true)
    setError('')
    const response = await fetch(`/api/quotes/${params.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentConfirmedAt,
        entryPaymentMethod: quote.paymentMethod === 'CARD' && Number(quote.cardDownPayment || 0) > 0
          ? entryPaymentMethod
          : undefined,
      }),
    })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível transformar em projeto.')
      return
    }
    setConvertOpen(false)
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
      body: JSON.stringify({
        reminder,
        comparisonQuoteIds,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      messageWindow?.close()
      const details = Array.isArray(data?.missingFields) ? ` ${data.missingFields.join(' ')}` : ''
      setError(`${data?.error || 'Não foi possível preparar a aprovação do cliente.'}${details}`)
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
    if (!client || !approvalUrl || typeof window === 'undefined') return ''
    const contactNumber = client.whatsapp || client.phone
    if (!contactNumber) return ''
    const phone = contactNumber.replace(/\D/g, '')
    const whatsAppNumber = phone.startsWith('55') ? phone : `55${phone}`
    const message = [
      `Olá, ${client.name}!`,
      '',
      `Segue o orçamento ${quote.title} no valor de ${formatCurrency(quote.total)}.`,
      `Para conferir o orçamento simples em PDF e aprovar, abra: ${approvalUrl}`,
      '',
      'Se precisar ajustar algum detalhe, pode me responder por aqui.',
    ].join('\n')
    return `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(message)}`
  }, [approvalUrl, quote])

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

  const openVariantModal = () => {
    if (!quote) return
    const usedTypes = new Set((quote.groupVariants || []).map((variant) => variant.variationType))
    const nextType = QUOTE_VARIATION_TYPES.find((type) => !usedTypes.has(type)) || 'CUSTOM'
    setVariantType(nextType)
    setVariantName(quoteVariationDefaultName(nextType))
    setVariantError('')
    setVariantModalOpen(true)
  }

  const createVariant = async () => {
    if (!quote) return
    setVariantSaving(true)
    setVariantError('')
    const response = await fetch(`/api/quotes/${quote.id}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: variantType,
        name: variantName.trim() || quoteVariationDefaultName(variantType),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setVariantSaving(false)

    if (!response.ok || !data?.id) {
      setVariantError(data?.error || 'Não foi possível criar a variação.')
      return
    }

    setVariantModalOpen(false)
    router.push(`/dashboard/quotes/${data.id}`)
  }

  const conversionEntry = quote.paymentMethod === 'CARD'
    ? Math.max(Number(quote.cardDownPayment) || 0, 0)
    : quote.total
  const conversionBalance = Math.max(quote.total - conversionEntry, 0)
  const conversionInstallments = quote.paymentMethod === 'CARD'
    ? Math.max(Math.floor(Number(quote.cardInstallments) || 0), 0)
    : 0
  const invalidCardTerms = quote.paymentMethod === 'CARD' && (
    conversionEntry > quote.total ||
    (conversionBalance > 0 && (conversionInstallments < 1 || !quote.firstInstallmentDate)) ||
    (conversionEntry > 0 && !entryPaymentMethod)
  )
  const invalidPaymentTerms = quote.paymentMethod === 'TO_DEFINE' || invalidCardTerms
  const invalidPaymentDate = !paymentConfirmedAt || paymentConfirmedAt > todayInputValue()

  const paymentSummary = getQuotePaymentSummary(quote)
  const quoteLocked = quote.status === 'SOLD' || Boolean(quote.convertedProject)
  const selectedComparisons = (quote.comparisonCandidates || []).filter((candidate) => comparisonQuoteIds.includes(candidate.id))
  const approvalQuoteCount = 1 + selectedComparisons.length
  const approvalActionLabel = quote.status === 'WAITING_APPROVAL'
    ? 'Pedir retorno do cliente'
    : selectedComparisons.length > 0
      ? `Enviar ${approvalQuoteCount} propostas`
      : 'Enviar para aprovação'
  const sortedGroupVariants = [...(quote.groupVariants || [])].sort((a, b) => a.variationOrder - b.variationOrder)
  const canCreateVariant = !quoteLocked && sortedGroupVariants.length < 3

  const toggleComparisonQuote = (quoteId: string) => {
    setComparisonQuoteIds((current) => {
      if (current.includes(quoteId)) return current.filter((id) => id !== quoteId)
      if (current.length >= 2) return current
      return [...current, quoteId]
    })
  }

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
            <Button variant="outline" onClick={() => window.open(`/api/quotes/${quote.id}/proposal?modelo=simples`, '_blank')}>
              <Printer size={16} />
              Orçamento do cliente
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/quotes/${quote.id}/proposal`, '_blank')}>
              <FileText size={16} />
              Proposta detalhada
            </Button>
            {quote.approvalRecord?.token ? (
              <Button variant="outline" onClick={() => window.open(`/api/public/quote-approvals/${quote.approvalRecord?.token}/certificate`, '_blank')}>
                <ShieldCheck size={16} />
                Comprovante
              </Button>
            ) : null}
            <Button variant="outline" loading={saving} disabled={quoteLocked} onClick={() => void sendApprovalRequest(quote.status === 'WAITING_APPROVAL')}>
              <Send size={16} />
              {approvalActionLabel}
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
              <Button
                loading={saving}
                disabled={quote.status !== 'APPROVED' || !quote.approvalRecord || Boolean(quote.approvalRecord.invalidatedAt)}
                onClick={openConversion}
                title={quote.status === 'APPROVED' && quote.approvalRecord && !quote.approvalRecord.invalidatedAt ? 'Confirmar pagamento e criar projeto' : 'Aguarde o aceite do cliente pelo link'}
              >
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

        {sortedGroupVariants.length > 0 && (
          <section className="border-y border-[#E8E8E8] bg-white">
            <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#121212]">
                  <GitBranch size={16} className="text-[#FF6B00]" />
                  Opções deste orçamento
                </div>
                <p className="mt-1 text-xs text-[#777]">
                  As medidas e os ambientes são compartilhados; acabamento e preço ficam separados em cada opção.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canCreateVariant}
                title={sortedGroupVariants.length >= 3 ? 'Este orçamento já possui o limite de três opções' : quoteLocked ? 'Orçamento já transformado em projeto' : 'Criar outra opção com as mesmas medidas'}
                onClick={openVariantModal}
              >
                <Plus size={15} />
                Nova opção
              </Button>
            </div>
            <div className="grid border-t border-[#F0F0F0] sm:grid-cols-2 xl:grid-cols-3">
              {sortedGroupVariants.map((variant) => {
                const isCurrent = variant.id === quote.id
                return (
                  <Link
                    key={variant.id}
                    href={`/dashboard/quotes/${variant.id}`}
                    className={cn(
                      'min-w-0 border-b border-[#F0F0F0] px-4 py-3 transition-colors sm:border-r xl:border-b-0',
                      isCurrent ? 'bg-[#FFF5ED]' : 'hover:bg-[#FAFAFA]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn('truncate text-sm font-semibold', isCurrent ? 'text-[#C94F00]' : 'text-[#121212]')}>
                          {variant.variationName}
                        </p>
                        <p className="mt-1 text-xs text-[#777]">{formatCurrency(variant.total)}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold', QUOTE_STATUS_BG[variant.status])}>
                        {QUOTE_STATUS_LABELS[variant.status]}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
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
                <div>
                  <p className="text-xs text-[#9E9E9E]">Variação</p>
                  <p className="font-semibold text-[#121212]">{quote.variationName}</p>
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
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Prazo de entrega</p>
                    <p className="font-semibold text-[#121212]">{quote.deliveryBusinessDays || 30} dias úteis</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9E9E9E]">Primeiro vencimento</p>
                    <p className="font-semibold text-[#121212]">{quote.firstInstallmentDate ? formatDate(quote.firstInstallmentDate) : 'A combinar'}</p>
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
                {quote.readiness?.ready && quote.readiness.warnings?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={15} /> Pode enviar agora</div>
                    <ul className="mt-2 space-y-1">
                      {quote.readiness.warnings.map((warning) => <li key={warning.key}>• {warning.label} Você pode completar depois.</li>)}
                    </ul>
                  </div>
                ) : quote.readiness?.ready ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                    <span>Dados conferidos. A proposta está pronta para envio.</span>
                  </div>
                ) : quote.readiness?.issues?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={15} /> Complete antes de enviar</div>
                    <ul className="mt-2 space-y-1">
                      {quote.readiness.issues.map((issue) => <li key={issue.key}>• {issue.label}</li>)}
                    </ul>
                  </div>
                ) : null}
                {quote.comparisonCandidates?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#555]">Opções no mesmo link</p>
                    <div className="divide-y divide-[#ECECEC] rounded-lg border border-[#E3E3E3]">
                      <div className="flex items-center justify-between gap-3 bg-[#FAFAFA] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#121212]">{quote.variationName}</p>
                          <p className="text-xs text-[#777]">{formatCurrency(quote.total)} · opção atual</p>
                        </div>
                        <input type="checkbox" checked readOnly aria-label={`${quote.variationName} incluída`} className="h-4 w-4 accent-[#FF6B00]" />
                      </div>
                      {quote.comparisonCandidates.map((candidate) => {
                        const checked = comparisonQuoteIds.includes(candidate.id)
                        const limitReached = !checked && comparisonQuoteIds.length >= 2
                        return (
                          <label
                            key={candidate.id}
                            className={cn(
                              'flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5',
                              limitReached && 'cursor-not-allowed opacity-50'
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#121212]">{candidate.variationName || candidate.title}</p>
                              <p className="truncate text-xs text-[#777]">
                                {candidate.groupId === quote.groupId ? 'Mesmo orçamento' : candidate.title} · {formatCurrency(candidate.total)}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving || limitReached}
                              onChange={() => toggleComparisonQuote(candidate.id)}
                              className="h-4 w-4 shrink-0 accent-[#FF6B00]"
                            />
                          </label>
                        )
                      })}
                    </div>
                    <p className="rounded-lg border border-[#FFD6B8] bg-[#FFF7F1] px-3 py-2 text-xs leading-5 text-[#8F3B00]">
                      {selectedComparisons.length > 0
                        ? `O cliente receberá um único link com ${approvalQuoteCount} opções e escolherá apenas uma para aprovar.`
                        : 'Marque até duas opções adicionais para o cliente comparar no mesmo link.'}
                    </p>
                  </div>
                ) : null}
                {quote.activeApprovalRequest ? (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${quote.activeApprovalRequest.viewedAt ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-[#E4E4E4] bg-[#FAFAFA] text-[#666]'}`}>
                    <p className="font-semibold">{quote.activeApprovalRequest.viewedAt ? 'Cliente visualizou o orçamento' : 'Aguardando primeira visualização'}</p>
                    <p className="mt-1">
                      {quote.activeApprovalRequest.viewedAt
                        ? `${quote.activeApprovalRequest.viewCount || 1} ${(quote.activeApprovalRequest.viewCount || 1) === 1 ? 'abertura' : 'aberturas'} · última em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(quote.activeApprovalRequest.viewedAt))}`
                        : 'O link foi enviado, mas ainda não foi aberto.'}
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="w-full justify-start"
                  loading={saving}
                  disabled={quoteLocked}
                  onClick={() => void sendApprovalRequest(quote.status === 'WAITING_APPROVAL')}
                >
                  <Send size={16} />
                  {approvalActionLabel}
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
                {quote.approvalRecord ? (
                  <div className={`rounded-lg border p-3 text-xs ${quote.approvalRecord.invalidatedAt ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                    <p className="font-semibold">{quote.approvalRecord.invalidatedAt ? 'Aceite histórico de' : 'Aprovado por'} {quote.approvalRecord.responseName || quote.client?.name}</p>
                    <p className="mt-1">Registrado em {quote.approvalRecord.approvedAt ? formatDate(quote.approvalRecord.approvedAt) : '-'}</p>
                    {quote.approvalRecord.invalidatedAt ? <p className="mt-1">Esta versão foi substituída após uma alteração no orçamento.</p> : null}
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => window.open(`/api/public/quote-approvals/${quote.approvalRecord?.token}/certificate`, '_blank')}>
                      <ShieldCheck size={14} /> Comprovante
                    </Button>
                  </div>
                ) : null}
                {(['SENT', 'WAITING_APPROVAL', 'LOST'] as QuoteStatus[]).map((value) => (
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
                  <p className="text-xs text-[#9E9E9E]">{quote.items.length} {quote.items.length === 1 ? 'item cadastrado' : 'itens cadastrados'}</p>
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
                        <p className="font-semibold text-[#121212]">{item.environmentName || item.environment}</p>
                        <p className="mt-1 text-sm text-[#555]">{item.description}</p>
                        {item.placement && (
                          <p className="mt-1 text-xs font-medium text-[#555]">Posição: {item.placement}</p>
                        )}
                        <p className="mt-1 text-xs text-[#9E9E9E]">
                          {quoteCentimetersToMillimeters(item.width)} x {quoteCentimetersToMillimeters(item.height)} mm
                          {item.quantity > 1 ? ` • Qtd. ${item.quantity}` : ''}
                          {' • '}
                          {formatCurrency(calculationPrice)}{calculationUnit}
                        </p>
                        <p className="mt-1 text-xs text-[#777]">
                          {[item.material || 'MDF', QUOTE_PRICE_PROFILE_LABELS[safeQuotePriceProfile(item.priceProfile)], item.finish || 'Interno não informado'].join(' • ')}
                        </p>
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

            <QuoteEnvironmentImages
              quoteId={quote.id}
              groupId={quote.groupId}
              environments={quote.items.map((item) => item.environmentName || item.environment)}
              images={quote.environmentImages || []}
              disabled={quoteLocked}
              onChange={(environmentImages) => setQuote((current) => {
                if (!current) return current
                const approvalWasInvalidated = ['SENT', 'WAITING_APPROVAL', 'APPROVED'].includes(current.status)
                return {
                  ...current,
                  environmentImages,
                  status: approvalWasInvalidated ? 'DRAFT' : current.status,
                  approvalRecord: approvalWasInvalidated ? null : current.approvalRecord,
                  activeApprovalRequest: approvalWasInvalidated ? undefined : current.activeApprovalRequest,
                }
              })}
            />

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

      <Modal open={variantModalOpen} onClose={() => setVariantModalOpen(false)} title="Criar nova opção" size="sm">
        <div className="space-y-4">
          <div className="rounded-lg border border-[#FFD6B8] bg-[#FFF7F1] px-4 py-3 text-sm text-[#7A3500]">
            As medidas, os ambientes e os móveis serão copiados de <strong>{quote.variationName}</strong>. Você poderá editar acabamento, preço e pagamento sem alterar a opção atual.
          </div>
          <Select
            label="Tipo de variação"
            value={variantType}
            onChange={(event) => {
              const nextType = event.target.value as QuoteVariationType
              setVariantType(nextType)
              setVariantName(quoteVariationDefaultName(nextType))
            }}
            options={QUOTE_VARIATION_TYPES.map((type) => ({
              value: type,
              label: QUOTE_VARIATION_LABELS[type],
            }))}
          />
          <Input
            label="Nome mostrado ao cliente"
            value={variantName}
            maxLength={60}
            onChange={(event) => setVariantName(event.target.value)}
            placeholder="Ex.: Madeirado externo"
          />
          {variantError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{variantError}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-[#ECECEC] pt-4">
            <Button type="button" variant="outline" onClick={() => setVariantModalOpen(false)}>Cancelar</Button>
            <Button type="button" loading={variantSaving} disabled={!variantName.trim()} onClick={() => void createVariant()}>
              <Plus size={16} />
              Criar opção
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title="Confirmar venda e criar projeto" size="md">
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Orçamento aprovado</p>
            <p className="mt-1 text-xs leading-5">Os {quote.deliveryBusinessDays || 30} dias úteis de entrega começarão na data de confirmação abaixo.</p>
          </div>
          <Input
            label="Data da confirmação do pagamento"
            type="date"
            max={todayInputValue()}
            value={paymentConfirmedAt}
            onChange={(event) => setPaymentConfirmedAt(event.target.value)}
          />
          {quote.paymentMethod === 'CARD' ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-sm text-[#333]">
                <p className="font-semibold">Condição aprovada pelo cliente</p>
                <p className="mt-1 text-xs leading-5">{paymentSummary}</p>
                {quote.firstInstallmentDate && conversionBalance > 0 ? (
                  <p className="mt-1 text-xs text-[#666]">Primeiro vencimento: {formatDate(quote.firstInstallmentDate)}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-[#888]">Entrada e parcelas serão copiadas sem alteração.</p>
              </div>
              {conversionEntry > 0 ? (
                <Select
                  label="Como a entrada foi recebida"
                  options={PAYMENT_METHODS.map((method) => ({ value: method.value, label: method.label }))}
                  value={entryPaymentMethod}
                  onChange={(event) => setEntryPaymentMethod(event.target.value)}
                />
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs text-[#666]">O pagamento via Pix será registrado pelo valor total de {formatCurrency(quote.total)}.</p>
          )}
          {quote.paymentMethod === 'TO_DEFINE' ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Edite o orçamento e defina a forma de pagamento antes de criar o projeto.
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[#ECECEC] pt-4">
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>Cancelar</Button>
            <Button type="button" loading={saving} disabled={invalidPaymentDate || invalidPaymentTerms} onClick={() => void convertToProject()}>
              <CheckCircle2 size={16} /> Criar projeto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
