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
    <div className="mt-5 border-t border-[#ECECEC] pt-5">
      {confirmed ? (
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
          <CalendarCheck2 size={18} /> Data confirmada por você
        </div>
      ) : (
        <button
          type="button"
          disabled={Boolean(loading) || changeRequested}
          onClick={() => void submit('CONFIRM')}
          className="flex min-h-12 w-full items-center justify-center gap-2 bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'CONFIRM' ? <Loader2 size={18} className="animate-spin" /> : <CalendarCheck2 size={18} />}
          Confirmar data da instalação
        </button>
      )}

      {!confirmed && !changeRequested ? (
        <div className="mt-3">
          <label htmlFor="installation-change-note" className="text-xs font-semibold text-[#555]">
            Precisa de outra data?
          </label>
          <textarea
            id="installation-change-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explique quais dias ou horários funcionam melhor para você."
            className="mt-2 min-h-24 w-full resize-y border border-[#D9D9D9] bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6B00]"
          />
          <button
            type="button"
            disabled={Boolean(loading) || note.trim().length < 5}
            onClick={() => void submit('REQUEST_CHANGE')}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-[#CFCFCF] bg-white px-4 py-2.5 text-sm font-semibold text-[#333] transition-colors hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === 'REQUEST_CHANGE' ? <Loader2 size={17} className="animate-spin" /> : <MessageSquareText size={17} />}
            Pedir alteração da data
          </button>
        </div>
      ) : null}

      {changeRequested ? (
        <div className="bg-amber-50 px-3 py-3 text-sm text-amber-900">
          Seu pedido foi enviado. A Vertex entrará em contato para combinar uma nova data.
        </div>
      ) : null}
      {feedback ? <p className="mt-3 text-sm font-medium text-emerald-700">{feedback}</p> : null}
      {error ? <p role="alert" className="mt-3 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
