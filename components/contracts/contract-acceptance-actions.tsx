'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileDown, Loader2, Printer, ShieldCheck } from 'lucide-react'

export function ContractAcceptanceActions({
  token,
  initialSignedAt,
  initialSignatoryName,
  disabledMessage,
}: {
  token: string
  initialSignedAt: string | null
  initialSignatoryName: string | null
  disabledMessage?: string | null
}) {
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [signedAt, setSignedAt] = useState(initialSignedAt)
  const [signatoryName, setSignatoryName] = useState(initialSignatoryName)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetch(`/api/public/contracts/${token}`, { cache: 'no-store' }).catch(() => undefined)
  }, [token])

  const submit = async () => {
    setMessage('')
    setLoading(true)
    const response = await fetch(`/api/public/contracts/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatoryName: name,
        signatoryDocument: document,
        acceptedTerms: accepted,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível registrar o aceite.')
      return
    }
    setSignedAt(payload.signedAt)
    setSignatoryName(name)
    setMessage('Aceite registrado com sucesso.')
  }

  if (signedAt) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-bold">Contrato aceito</p>
              <p className="mt-1 text-sm">
                Aceite registrado por {signatoryName || 'cliente'} em{' '}
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(signedAt))}.
              </p>
            </div>
          </div>
        </div>
        <div className="print:hidden flex flex-wrap gap-2">
          <a
            href={`/api/public/contracts/${token}/document`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FF6B00] px-4 text-sm font-semibold text-white hover:bg-[#E05A00]"
          >
            <FileDown size={16} />
            Baixar contrato assinado
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] hover:bg-[#F5F5F5]"
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>
    )
  }

  if (disabledMessage) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {disabledMessage}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] hover:bg-[#F5F5F5]"
        >
          <Printer size={16} />
          Imprimir
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[#FF6B00]" size={20} />
        <div>
          <h2 className="font-bold text-[#121212]">Aceite do cliente</h2>
          <p className="mt-1 text-sm leading-6 text-[#666]">
            Este registro confirma que você leu e concordou com as condições apresentadas.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#121212]">
          Nome completo
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#D9D9D9] px-3 font-normal outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
          />
        </label>
        <label className="text-sm font-semibold text-[#121212]">
          CPF ou documento <span className="font-normal text-[#777]">(opcional)</span>
          <input
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#D9D9D9] px-3 font-normal outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 text-sm leading-6 text-[#444]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#FF6B00]"
        />
        Li este documento e concordo com o projeto, os valores, o prazo e as condições descritas.
      </label>
      {message ? (
        <p role="status" className={`text-sm ${message.includes('sucesso') ? 'text-emerald-700' : 'text-red-700'}`}>
          {message}
        </p>
      ) : null}
      <div className="print:hidden flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !accepted || name.trim().length < 3}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FF6B00] px-5 text-sm font-bold text-white hover:bg-[#E05A00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Aceitar contrato
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] hover:bg-[#F5F5F5]"
        >
          <Printer size={16} />
          Imprimir
        </button>
      </div>
    </div>
  )
}
