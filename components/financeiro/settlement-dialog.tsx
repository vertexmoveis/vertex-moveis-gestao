'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CreditCard, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { dateOnlyKeyInTimeZone } from '@/lib/date-only'
import type { PaymentMethod } from '@/lib/payment-methods'

type Receipt = { id: string; amount: number; fee: number; method: string; source: string; receivedAt: string; note: string | null; reversedAt?: string | null }
export type FinanceProject = {
  id: string
  name: string
  clientName: string
  paymentMethod: string
  value: number
  received: number
  remaining: number
  archivedAt?: string | null
  cardFeeAmount?: number
  creditStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  creditLimit: number | null
  creditAvailable?: number
  creditNotes: string | null
  payments: { id: string; type: string; installmentNumber: number; amount: number; received: number; remaining: number; dueDate: string; paidAt: string | null }[]
  receipts: Receipt[]
}
export type SettlementSelection = { project: FinanceProject; mode: 'RECEIVE' | 'RECEIVE_ENTRY' | 'CREDIT_REVIEW' | 'REVERSE'; receipt?: Receipt }
type Props = SettlementSelection & { onClose: () => void; onSaved: (message: string) => void }
const inputClass = 'mt-1 h-10 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-[#F5F5F5]'

export function SettlementDialog({ project, mode, receipt, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestId = useRef<string | null>(null)
  const cardProject = project.paymentMethod === 'CARD' || project.paymentMethod === 'CARTAO'
  const entry = mode === 'RECEIVE_ENTRY'
  const card = cardProject && !entry
  const boleto = project.paymentMethod === 'BOLETO'
  const creditReview = mode === 'CREDIT_REVIEW'
  const reversal = mode === 'REVERSE'
  const entryRemaining = project.payments.filter((payment) => payment.type === 'DOWN_PAYMENT').reduce((sum, payment) => sum + payment.remaining, 0)
  const maxReceivable = entry ? Math.min(project.remaining, entryRemaining) : project.remaining
  const [source, setSource] = useState<'DIRECT' | 'CARD' | 'BOLETO_ADVANCE'>(card ? 'CARD' : 'DIRECT')
  const [amount, setAmount] = useState(maxReceivable.toFixed(2))
  const [fee, setFee] = useState(card && project.cardFeeAmount ? (project.cardFeeAmount * project.remaining / Math.max(project.value, 1)).toFixed(2) : '0.00')
  const [method, setMethod] = useState<PaymentMethod>(card ? 'CARTAO' : boleto ? 'BOLETO' : project.paymentMethod === 'DINHEIRO' ? 'DINHEIRO' : 'PIX')
  const [receivedAt, setReceivedAt] = useState(() => dateOnlyKeyInTimeZone(new Date()))
  const [note, setNote] = useState(creditReview ? project.creditNotes || '' : '')
  const [creditStatus, setCreditStatus] = useState(project.creditStatus)
  const [creditLimit, setCreditLimit] = useState(project.creditLimit?.toFixed(2) || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const gross = Number(amount) || 0
  const feeValue = Number(fee) || 0
  const advance = source === 'BOLETO_ADVANCE'
  const advanceLimit = Math.min(project.remaining, Math.max(project.creditAvailable ?? project.creditLimit ?? 0, 0))
  const canAdvance = project.creditStatus === 'APPROVED' && advanceLimit > 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  function changeSource(nextSource: 'DIRECT' | 'BOLETO_ADVANCE') {
    setSource(nextSource)
    setFee('0.00')
    setAmount((nextSource === 'BOLETO_ADVANCE' ? advanceLimit : project.remaining).toFixed(2))
    setMethod(nextSource === 'BOLETO_ADVANCE' ? 'TRANSFERENCIA' : 'BOLETO')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError('')
    if (reversal && (!receipt || !note.trim())) { setError('Informe o motivo do estorno.'); return }
    if (!creditReview && !reversal && (!Number.isFinite(gross) || gross <= 0 || gross > maxReceivable + 0.005)) { setError('Informe um valor maior que zero e até o saldo em aberto.'); return }
    if (!creditReview && !reversal && (!Number.isFinite(feeValue) || feeValue < 0 || feeValue >= gross)) { setError('A taxa deve ser positiva ou zero e menor que o valor bruto.'); return }
    if (!creditReview && !reversal && advance && (!canAdvance || gross > advanceLimit + 0.005)) { setError('A antecipação precisa de crédito aprovado e deve respeitar o limite disponível.'); return }
    if (creditReview && creditStatus === 'APPROVED' && (!creditLimit || Number(creditLimit) <= 0 || !Number.isFinite(Number(creditLimit)))) { setError('Informe o limite aprovado pelo jurídico.'); return }
    setSubmitting(true)
    requestId.current ||= crypto.randomUUID()
    try {
      const response = await fetch('/api/financeiro/settlements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reversal ? {
          projectId: project.id, action: 'REVERSE', receiptId: receipt?.id, note: note.trim(),
        } : creditReview ? {
          projectId: project.id, action: 'CREDIT_REVIEW', creditStatus,
          creditLimit: creditStatus === 'APPROVED' ? Number(creditLimit) : null, note: note.trim() || null,
        } : {
          projectId: project.id, action: 'RECEIVE', requestId: requestId.current,
          amount: card ? project.remaining : gross, fee: feeValue, method, source, receivedAt, note: note.trim() || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar. Tente novamente.')
      onSaved(reversal ? 'Registro estornado. O saldo foi reaberto e o histórico foi preservado.' : creditReview ? 'Análise do jurídico registrada. O caixa será atualizado quando houver recebimento.' : card ? 'Repasse integral do cartão registrado. As parcelas do cliente estão acertadas para a empresa.' : 'Recebimento registrado e saldo atualizado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar. Tente novamente.')
    } finally { setSubmitting(false) }
  }

  const title = reversal ? 'Estornar registro de recebimento' : creditReview ? 'Registrar análise do jurídico' : entry ? 'Registrar entrada por outro meio' : card ? 'Registrar repasse integral do cartão' : advance ? 'Registrar antecipação de boleto' : 'Registrar recebimento'
  return <dialog ref={dialogRef} aria-labelledby="settlement-title" aria-describedby="settlement-description" onCancel={(event) => { event.preventDefault(); if (!submitting) onClose() }} onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }} className="fixed inset-0 z-[80] m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/45">
    <div className="flex items-start justify-between gap-3 border-b border-[#E8E8E8] p-5"><div><h2 id="settlement-title" className="text-base font-semibold">{title}</h2><p id="settlement-description" className="mt-1 text-xs text-[#666]">{project.clientName} · {project.name}</p></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Fechar" className="rounded-lg p-1.5 text-[#666] hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] disabled:opacity-40"><X size={18} /></button></div>
    <form onSubmit={submit} className="space-y-4 p-5">
      {reversal ? <p className="rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-900">Este estorno corrige o registro de {formatCurrency(receipt?.amount || 0)} e reabre o saldo do cliente. O histórico permanece disponível. Informe abaixo o motivo da correção.</p> : creditReview ? <>
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><ShieldCheck size={16} className="mb-1" />Registre aqui o retorno recebido do jurídico. O limite total é compartilhado entre os projetos deste cliente. O dinheiro entra no caixa quando o recebimento for registrado.</p>
        <label className="block text-xs font-medium" htmlFor="credit-status">Resultado da análise<select id="credit-status" value={creditStatus} onChange={(event) => setCreditStatus(event.target.value as FinanceProject['creditStatus'])} disabled={submitting} className={inputClass}><option value="PENDING">Aguardando análise</option><option value="APPROVED">Crédito aprovado</option><option value="REJECTED">Crédito não aprovado</option></select></label>
        {creditStatus === 'APPROVED' ? <label className="block text-xs font-medium" htmlFor="credit-limit">Limite total aprovado para o cliente (R$)<input id="credit-limit" type="number" min="0.01" step="0.01" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} disabled={submitting} required className={inputClass} /></label> : null}
      </> : <>
        {entry ? <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">Registre a entrada recebida por Pix, dinheiro ou transferência. Depois registre de uma vez o saldo repassado pelo cartão.</p> : null}
        {card ? <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900"><CreditCard size={16} className="mb-1" />Registre uma única vez o valor total repassado para a empresa. As parcelas combinadas com o cliente ficam quitadas no financeiro.</p> : null}
        {boleto ? <fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold">Origem do recebimento</legend><label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#E8E8E8] p-3 text-xs"><input type="radio" name="receipt-source" value="DIRECT" checked={!advance} onChange={() => changeSource('DIRECT')} disabled={submitting} className="mt-0.5 accent-[#FF6B00]" /><span><span className="block font-semibold">Pagamento do cliente</span><span className="mt-1 block text-[#666]">Valor pago pelo cliente que já entrou para a empresa.</span></span></label><label className={cn('flex items-start gap-2 rounded-lg border p-3 text-xs', canAdvance ? 'cursor-pointer border-[#E8E8E8]' : 'border-[#EEE] bg-[#FAFAFA] text-[#777]')}><input type="radio" name="receipt-source" value="BOLETO_ADVANCE" checked={advance} onChange={() => changeSource('BOLETO_ADVANCE')} disabled={submitting || !canAdvance} className="mt-0.5 accent-[#FF6B00]" /><span><span className="block font-semibold">Antecipação via jurídico</span><span className="mt-1 block text-[#666]">{canAdvance ? `Limite disponível para antecipar: ${formatCurrency(advanceLimit)}.` : 'Registre primeiro a aprovação do crédito e o limite informado pelo jurídico.'}</span></span></label></fieldset> : null}
        <div className="rounded-lg bg-[#F7F7F7] p-3 text-xs"><div className="flex justify-between gap-3"><span className="text-[#666]">Saldo em aberto</span><span className="font-semibold">{formatCurrency(project.remaining)}</span></div></div>
        <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-medium" htmlFor="receipt-amount">{card ? 'Repasse bruto integral (R$)' : 'Valor bruto recebido (R$)'}<input id="receipt-amount" type="number" min="0.01" max={advance ? advanceLimit : maxReceivable} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} readOnly={card} disabled={submitting} required className={cn(inputClass, card && 'bg-[#F5F5F5]')} /></label><label className="block text-xs font-medium" htmlFor="receipt-fee">Taxa descontada (R$)<input id="receipt-fee" type="number" min="0" max={Math.max(gross - 0.01, 0)} step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} disabled={submitting} required className={inputClass} /></label></div>
        {card && project.cardFeeAmount ? <p className="text-[11px] text-blue-800">A taxa sugerida é uma estimativa do cadastro. Ajuste para a taxa real do repasse.</p> : null}
        <p className="text-[11px] leading-relaxed text-[#666]">Confira a taxa real no comprovante. A taxa reduz o dinheiro que entra, sem deixar essa diferença como dívida do cliente.</p>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><span>Líquido que entrou</span><strong>{formatCurrency(Math.max(gross - feeValue, 0))}</strong></div>
        <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-medium" htmlFor="receipt-date">Data do recebimento<input id="receipt-date" type="date" max={dateOnlyKeyInTimeZone(new Date())} value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} disabled={submitting} required className={inputClass} /></label><label className="block text-xs font-medium" htmlFor="receipt-method">Forma de recebimento<select id="receipt-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} disabled={submitting || card} className={inputClass}>{card ? <option value="CARTAO">Cartão</option> : <><option value="PIX">Pix</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option>{boleto && !advance ? <option value="BOLETO">Boleto</option> : null}</>}</select></label></div>
        {!card && gross > 0 ? <p className="text-xs text-[#666]">Saldo após este recebimento: <strong className="text-[#121212]">{formatCurrency(Math.max(project.remaining - gross, 0))}</strong></p> : null}
      </>}
      <label className="block text-xs font-medium" htmlFor="receipt-note">{reversal ? 'Motivo do estorno' : creditReview ? 'Observações do jurídico' : 'Observação ou referência do comprovante'}<textarea id="receipt-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={submitting} required={reversal} maxLength={2000} rows={3} className="mt-1 w-full resize-y rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]" /></label>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-[#F0F0F0] pt-4"><Button type="button" variant="outline" disabled={submitting} onClick={onClose}>Cancelar</Button><Button type="submit" loading={submitting} variant={reversal ? 'danger' : 'primary'}>{reversal ? 'Estornar registro' : creditReview ? 'Salvar análise' : card ? 'Registrar repasse integral' : 'Registrar recebimento'}</Button></div>
    </form>
  </dialog>
}
