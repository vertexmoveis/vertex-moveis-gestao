'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileDown, Loader2, ShieldCheck } from 'lucide-react'

export function ContractAcceptanceActions({
  token,
  initialSignedAt,
  initialSignatoryName,
  defaultSignatoryName,
  disabledMessage,
}: {
  token: string
  initialSignedAt: string | null
  initialSignatoryName: string | null
  defaultSignatoryName?: string
  disabledMessage?: string | null
}) {
  const [name, setName] = useState(defaultSignatoryName || '')
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
    window.setTimeout(() => window.location.reload(), 700)
  }

  if (signedAt) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 sm:p-6">
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
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/public/contracts/${token}/document`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 text-base font-bold text-white hover:bg-[#E05A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2"
          >
            <FileDown size={16} />
            Abrir contrato assinado em PDF
          </a>
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#FFF1E8] text-[#FF6B00]">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#121212]">Assinatura do cliente</h2>
          <p className="mt-1 text-sm leading-6 text-[#666]">
            Depois de ler o PDF acima, confirme seu nome e aceite as condições para assinar o contrato.
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
            className="mt-2 min-h-14 w-full rounded-lg border border-[#CFCFCF] px-4 text-base font-normal outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
          />
        </label>
        <label className="text-sm font-semibold text-[#121212]">
          CPF ou documento <span className="font-normal text-[#777]">(opcional)</span>
          <input
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="mt-2 min-h-14 w-full rounded-lg border border-[#CFCFCF] px-4 text-base font-normal outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-[#DCDCDC] bg-[#FAFAFA] p-4 text-sm leading-6 text-[#333] sm:p-5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6B00]"
        />
        Li este documento e concordo com o projeto, os valores, o prazo e as condições descritas.
      </label>
      {message ? (
        <p role="status" className={`text-sm ${message.includes('sucesso') ? 'text-emerald-700' : 'text-red-700'}`}>
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !accepted || name.trim().length < 3}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 text-base font-bold text-white hover:bg-[#E05A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-64"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Assinar e aceitar contrato
        </button>
      </div>
    </div>
  )
}
