'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

type LoginEvent = {
  id: string
  success: boolean
  reason: string | null
  userAgent: string | null
  createdAt: string
}

export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false)
  const [events, setEvents] = useState<LoginEvent[]>([])
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const response = await fetch('/api/settings/two-factor', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (response.ok) {
      setEnabled(payload.enabled === true)
      setEvents(payload.loginEvents || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/settings/two-factor', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return
        setEnabled(payload.enabled === true)
        setEvents(payload.loginEvents || [])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const request = async (payload: Record<string, string>) => {
    setBusy(true)
    setError('')
    setMessage('')
    const response = await fetch('/api/settings/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(result.error || 'Não foi possível concluir a operação.')
      return null
    }
    return result
  }

  const start = async () => {
    const result = await request({ action: 'start', password })
    if (!result) return
    setSecret(result.secret)
    setQrCode(result.qrCode)
    setPassword('')
    setMessage('Escaneie o QR Code e confirme com o código de 6 dígitos.')
  }

  const enable = async () => {
    const result = await request({ action: 'enable', code })
    if (!result) return
    setEnabled(true)
    setSecret('')
    setQrCode('')
    setCode('')
    setMessage('Autenticação em dois fatores ativada.')
    void load()
  }

  const disable = async () => {
    const result = await request({ action: 'disable', password, code })
    if (!result) return
    setEnabled(false)
    setPassword('')
    setCode('')
    setMessage('Proteção desativada. Entre novamente para continuar.')
    window.setTimeout(() => { window.location.href = '/login' }, 900)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {enabled ? <ShieldCheck size={20} className="text-emerald-600" /> : <ShieldOff size={20} className="text-[#777]" />}
          <div>
            <h2 className="text-sm font-semibold text-[#121212]">Segurança da conta</h2>
            <p className="mt-1 text-xs text-[#777]">Código do autenticador e histórico de acessos</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex min-h-20 items-center justify-center"><Loader2 size={18} className="animate-spin" /></div>
        ) : (
          <>
            <div className="border-l-4 border-[#FF6B00] bg-[#FFF7F1] p-3">
              <p className="text-sm font-semibold text-[#121212]">
                {enabled ? 'Autenticação em dois fatores ativa' : 'Ative uma segunda proteção para o login'}
              </p>
              <p className="mt-1 text-xs text-[#666]">
                {enabled ? 'Além da senha, o login exige um código de 6 dígitos.' : 'Compatível com Google Authenticator, Microsoft Authenticator e outros.'}
              </p>
            </div>

            {error ? <p className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

            {!enabled && !qrCode ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Confirme sua senha"
                  className="h-10 flex-1 border border-[#D9D9D9] px-3 text-sm outline-none focus:border-[#FF6B00]"
                />
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={busy || !password}
                  className="inline-flex h-10 items-center justify-center gap-2 bg-[#FF6B00] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  Configurar
                </button>
              </div>
            ) : null}

            {!enabled && qrCode ? (
              <div className="grid gap-4 border border-[#E8E8E8] p-4 sm:grid-cols-[220px_1fr]">
                <Image src={qrCode} alt="QR Code do autenticador" width={220} height={220} unoptimized className="h-auto w-full max-w-[220px]" />
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-[#121212]">Chave manual</p>
                    <code className="mt-1 block break-all bg-[#F5F5F5] p-2 text-xs">{secret}</code>
                  </div>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código de 6 dígitos"
                    className="h-10 w-full border border-[#D9D9D9] px-3 text-sm outline-none focus:border-[#FF6B00]"
                  />
                  <button
                    type="button"
                    onClick={() => void enable()}
                    disabled={busy || code.length !== 6}
                    className="inline-flex h-10 items-center gap-2 bg-[#FF6B00] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    Ativar proteção
                  </button>
                </div>
              </div>
            ) : null}

            {enabled ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Confirme sua senha"
                  className="h-10 border border-[#D9D9D9] px-3 text-sm outline-none focus:border-red-400"
                />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Código atual"
                  className="h-10 border border-[#D9D9D9] px-3 text-sm outline-none focus:border-red-400"
                />
                <button
                  type="button"
                  onClick={() => void disable()}
                  disabled={busy || !password || code.length !== 6}
                  className="inline-flex h-10 items-center justify-center gap-2 border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Desativar
                </button>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-[#777]">Acessos recentes</h3>
              {events.length === 0 ? (
                <p className="text-sm text-[#888]">Nenhum acesso registrado ainda.</p>
              ) : (
                <div className="divide-y divide-[#ECECEC] border border-[#E8E8E8]">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className={event.success ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                          {event.success ? 'Login autorizado' : 'Tentativa bloqueada'}
                        </p>
                        <p className="truncate text-[#777]">{event.userAgent || 'Navegador não informado'}</p>
                      </div>
                      <time className="shrink-0 text-[#777]">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.createdAt))}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
