'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { deliveryForecastMonthLabel, isDeliveryForecastMonth } from '@/lib/delivery-forecast'

export function ProjectDeliveryForecast({ projectId, month, canWrite, onUpdated }: {
  projectId: string; month: string | null; canWrite: boolean; onUpdated: () => void
}) {
  const [value, setValue] = useState(month || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(next: string | null) {
    if (!canWrite || busy) return
    if (next && !isDeliveryForecastMonth(next)) { setMessage('Escolha um mês válido.'); return }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryForecastMonth: next }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a previsão.')
      setMessage('Previsão atualizada.')
      onUpdated()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a previsão.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-lg border border-[#E3E3E3] bg-white p-4 sm:p-5" aria-label="Previsão de entrega por mês">
    <div><h2 className="text-sm font-semibold">Previsão de entrega por mês</h2><p className="mt-1 text-xs text-[#777]">Use quando o mês está previsto e o dia ainda será combinado.</p></div>
    <p className="text-sm font-medium">{deliveryForecastMonthLabel(month) || 'Nenhuma previsão por mês informada.'}</p>
    {canWrite ? <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void save(value || null) }}>
      <label className="text-xs text-[#666]">Mês previsto<input type="month" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} className="mt-1 block h-10 rounded-md border border-[#DDD] bg-white px-3 text-sm" /></label>
      <Button type="submit" loading={busy}>Salvar previsão</Button>
      {month ? <Button type="button" variant="outline" disabled={busy} onClick={() => void save(null)}>Remover previsão por mês</Button> : null}
    </form> : null}
    {message ? <p role="status" className="text-xs text-[#666]">{message}</p> : null}
  </section>
}
