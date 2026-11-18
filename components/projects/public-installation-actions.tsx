'use client'

import { useState } from 'react'
import { CalendarCheck2, Loader2, MessageSquareText } from 'lucide-react'

type InstallationAction = 'CONFIRM' | 'REQUEST_CHANGE'

export function PublicInstallationActions({
  token,
  status,
}: {
  token: string
  status: string
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState<InstallationAction | null>(null)
  const [confirmed, setConfirmed] = useState(status === 'CONFIRMED')
  const [changeRequested, setChangeRequested] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const submit = async (action: InstallationAction) => {
    setLoading(action)
    setFeedback('')
    setError('')

    const response = await fetch(`/api/public/project-portals/${encodeURIComponent(token)}/installation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(action === 'REQUEST_CHANGE' ? { note: note.trim() } : {}),
      }),
    })
    const data = await response.json().catch(() => null)
    setLoading(null)

    if (!response.ok) {
      setError(data?.error || 'Não foi possível registrar sua resposta. Tente novamente.')
      return
    }

    if (action === 'CONFIRM') setConfirmed(true)
    if (action === 'REQUEST_CHANGE') {
      setChangeRequested(true)
      setNote('')
    }
    setFeedback(data?.message || 'Resposta registrada com sucesso.')
  }

  return (
    <div className="mt-6 border-t border-[#E8E5E0] pt-5">
      {confirmed ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold leading-6 text-emerald-800">
          <CalendarCheck2 size={20} className="shrink-0" aria-hidden="true" /> Data confirmada por você
        </div>
      ) : (
        <button
          type="button"
          disabled={Boolean(loading) || changeRequested}
          onClick={() => void submit('CONFIRM')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-3 text-sm font-bold text-[#1C211B] outline-none transition-colors hover:bg-[#F57821] active:bg-[#EE6A0C] focus-visible:ring-2 focus-visible:ring-[#C75200] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'CONFIRM' ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> : <CalendarCheck2 size={18} className="shrink-0" aria-hidden="true" />}
          Confirmar data da instalação
        </button>
      )}

      {!confirmed && !changeRequested ? (
        <div className="mt-5 rounded-2xl bg-[#FAF9F6] p-4">
          <label htmlFor="installation-change-note" className="text-sm font-semibold text-[#484D43]">
            Precisa de outra data?
          </label>
          <textarea
            id="installation-change-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explique quais dias ou horários funcionam melhor para você."
            className="mt-3 min-h-24 w-full resize-y rounded-xl border border-[#E2DED7] bg-white px-3 py-3 text-base leading-6 text-[#191B18] outline-none placeholder:text-[#6C7067] focus:border-[#C75200] focus:ring-2 focus:ring-[#C75200]/20 sm:text-sm"
          />
          <button
            type="button"
            disabled={Boolean(loading) || note.trim().length < 5}
            onClick={() => void submit('REQUEST_CHANGE')}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D5CFC5] bg-white px-4 py-3 text-sm font-semibold text-[#484D43] outline-none transition-colors hover:border-[#BDB6AA] hover:bg-[#F5F3EE] focus-visible:ring-2 focus-visible:ring-[#C75200] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === 'REQUEST_CHANGE' ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> : <MessageSquareText size={18} className="shrink-0" aria-hidden="true" />}
            Pedir alteração da data
          </button>
        </div>
      ) : null}

      {changeRequested ? (
        <div role="status" className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
          Seu pedido foi enviado. A Vertex entrará em contato para combinar uma nova data.
        </div>
      ) : null}
      {feedback ? <p role="status" className="mt-4 text-sm font-medium leading-6 text-emerald-700">{feedback}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p> : null}
    </div>
  )
}
