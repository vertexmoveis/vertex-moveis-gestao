'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'

export function PublicApprovalActions({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'rejected' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const respond = async (decision: 'APPROVE' | 'REJECT') => {
    setStatus('loading')
    const response = await fetch(`/api/public/quote-approvals/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data?.error || 'Não foi possível registrar sua resposta.')
      setStatus('error')
      return
    }
    setMessage(decision === 'APPROVE' ? 'Aprovação registrada. A Vertex Móveis entrará em contato para os próximos passos.' : 'Resposta registrada. A Vertex Móveis entrará em contato.')
    setStatus(decision === 'APPROVE' ? 'approved' : 'rejected')
  }

  if (status === 'approved' || status === 'rejected') {
    const approved = status === 'approved'
    return <div className={`rounded-lg border px-4 py-3 text-sm ${approved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{message}</div>
  }

  return (
    <div className="space-y-3">
      {status === 'error' ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" disabled={status === 'loading'} onClick={() => void respond('APPROVE')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#E05A00] disabled:opacity-50"><CheckCircle2 size={16} /> Aprovar orçamento</button>
        <button type="button" disabled={status === 'loading'} onClick={() => void respond('REJECT')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"><XCircle size={16} /> Solicitar ajuste</button>
      </div>
    </div>
  )
}
