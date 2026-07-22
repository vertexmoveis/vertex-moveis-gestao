'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'

export function PublicApprovalActions({ token, clientName }: { token: string; clientName?: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'rejected' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [respondentName, setRespondentName] = useState(clientName || '')
  const [respondentDocument, setRespondentDocument] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [certificateUrl, setCertificateUrl] = useState('')

  const respond = async (decision: 'APPROVE' | 'REJECT') => {
    if (respondentName.trim().length < 3) {
      setMessage('Informe o nome completo de quem está respondendo.')
      setStatus('error')
      return
    }
    if (decision === 'APPROVE' && !acceptedTerms) {
      setMessage('Confirme que leu e aprova as condições da proposta.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const response = await fetch(`/api/public/quote-approvals/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          respondentName: respondentName.trim(),
          ...(decision === 'APPROVE'
            ? {
                ...(respondentDocument.trim() ? { respondentDocument: respondentDocument.trim() } : {}),
                acceptedTerms,
              }
            : {}),
          note: note.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data?.error || 'Não foi possível registrar sua resposta.')
        setStatus('error')
        return
      }
      setMessage(decision === 'APPROVE'
        ? 'Aprovação registrada. A Vertex Móveis entrará em contato para os próximos passos.'
        : 'Pedido de ajuste registrado. A Vertex Móveis entrará em contato.')
      setCertificateUrl(data?.certificateUrl || '')
      setStatus(decision === 'APPROVE' ? 'approved' : 'rejected')
    } catch {
      setMessage('Não foi possível conectar. Confira a internet e tente novamente.')
      setStatus('error')
    }
  }

  if (status === 'approved' || status === 'rejected') {
    const approved = status === 'approved'
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${approved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        <p>{message}</p>
        {approved && certificateUrl ? (
          <a href={certificateUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-emerald-300 bg-white px-3 font-semibold text-emerald-800 hover:bg-emerald-50">
            Abrir comprovante de aprovação
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {status === 'error' ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="approval-name" className="mb-1.5 block text-sm font-medium text-[#121212]">Nome completo</label>
          <input
            id="approval-name"
            value={respondentName}
            onChange={(event) => setRespondentName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            disabled={status === 'loading'}
            placeholder="Nome de quem está respondendo"
            className="min-h-11 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] outline-none focus:border-transparent focus:ring-2 focus:ring-[#FF6B00]"
          />
        </div>
        <div>
          <label htmlFor="approval-document" className="mb-1.5 block text-sm font-medium text-[#121212]">CPF ou CNPJ (opcional)</label>
          <input
            id="approval-document"
            value={respondentDocument}
            onChange={(event) => setRespondentDocument(event.target.value)}
            maxLength={30}
            inputMode="numeric"
            disabled={status === 'loading'}
            placeholder="Preencha somente se desejar"
            className="min-h-11 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] outline-none focus:border-transparent focus:ring-2 focus:ring-[#FF6B00]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="approval-note" className="mb-1.5 block text-sm font-medium text-[#121212]">Comentário ou ajuste (opcional)</label>
        <textarea
          id="approval-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          disabled={status === 'loading'}
          rows={3}
          placeholder="Conte o que gostaria de alterar ou deixe uma observação."
          className="w-full resize-y rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm text-[#121212] outline-none focus:border-transparent focus:ring-2 focus:ring-[#FF6B00]"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E8E8E8] bg-white px-3 py-3 text-sm leading-5 text-[#444]">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          disabled={status === 'loading'}
          className="mt-0.5 h-4 w-4 accent-[#FF6B00]"
        />
        <span>Li a proposta, conferi os móveis, valores, pagamento e prazo, e concordo com estas condições para aprovar o orçamento.</span>
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" disabled={status === 'loading'} onClick={() => void respond('APPROVE')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#E05A00] disabled:opacity-50"><CheckCircle2 size={16} /> Aprovar orçamento</button>
        <button type="button" disabled={status === 'loading'} onClick={() => void respond('REJECT')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"><XCircle size={16} /> Solicitar ajuste</button>
      </div>
    </div>
  )
}
