'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatWorkshopStockQuantity,
  workshopStockMovementLabels,
  type WorkshopStockItemView,
  type WorkshopStockMovementView,
} from '@/lib/workshop-stock'
import { workshopStockRequest } from './workshop-stock-request'

type MovementPage = {
  movements: WorkshopStockMovementView[]
  nextCursor: string | null
}

const movementDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function loadMovements(itemId: string, cursor?: string, signal?: AbortSignal) {
  const search = new URLSearchParams({ itemId })
  if (cursor) search.set('cursor', cursor)
  return workshopStockRequest<MovementPage>(`?${search}`, { signal })
}

export function WorkshopStockHistory({
  item,
  busy,
  onReverse,
}: {
  item: WorkshopStockItemView
  busy: boolean
  onReverse: (movementId: string, reason: string) => void
}) {
  const [movements, setMovements] = useState<WorkshopStockMovementView[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [reverseId, setReverseId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    loadMovements(item.id, undefined, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        setMovements(page.movements)
        setCursor(page.nextCursor)
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt, item.id])

  async function showMore() {
    if (!cursor || loading) return
    setLoading(true)
    setError('')
    try {
      const page = await loadMovements(item.id, cursor)
      setMovements((previous) => [...previous, ...page.movements])
      setCursor(page.nextCursor)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível carregar mais movimentações.')
    } finally {
      setLoading(false)
    }
  }

  function confirmReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !reverseId || !reason.trim()) return
    onReverse(reverseId, reason.trim())
  }

  return (
    <section aria-label={`Histórico de ${item.name}`} className="space-y-3">
      <h4 className="text-sm font-semibold text-[#121212]">Histórico do material</h4>
      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          {!movements.length ? (
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setLoading(true)
              setError('')
              setAttempt((previous) => previous + 1)
            }}>Tentar novamente</Button>
          ) : null}
        </div>
      ) : null}
      {!error && !loading && !movements.length ? <p className="text-sm text-[#555]">Nenhuma movimentação registrada.</p> : null}
      {movements.length ? (
        <ol className="divide-y divide-[#E8E8E8] rounded-lg border border-[#E8E8E8] bg-white">
          {movements.map((movement) => {
            const showReversal = reverseId === movement.id
            const canReverse = item.active && movement.kind !== 'REVERSAL' && !movement.reversed && movement.quantity !== 0
            return (
              <li key={movement.id} className="space-y-2 p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0 text-sm">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="font-semibold text-[#121212]">{workshopStockMovementLabels[movement.kind]}</p>
                      {movement.reversed ? <span className="text-xs text-[#666]">Estornado</span> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[#555]">
                      {movementDate.format(new Date(movement.createdAt))}
                      {movement.createdBy ? ` · ${movement.createdBy}` : ''}
                    </p>
                    {movement.supplier ? <p className="mt-1 break-words text-xs text-[#555]">Fornecedor · {movement.supplier}</p> : null}
                    {movement.reference ? <p className="mt-1 break-words text-xs text-[#555]">Referência · {movement.reference}</p> : null}
                    {movement.reason ? <p className="mt-1 break-words text-xs text-[#555]">{movement.reason}</p> : null}
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p className={`font-semibold ${movement.quantity < 0 ? 'text-[#8F2E14]' : 'text-[#16744E]'}`}>
                      {movement.quantity > 0 ? '+' : ''}{formatWorkshopStockQuantity(movement.quantity, item.unit)}
                    </p>
                    {movement.balanceAfter !== null ? (
                      <p className="mt-1 text-xs text-[#555]">Saldo {formatWorkshopStockQuantity(movement.balanceAfter, item.unit)}</p>
                    ) : null}
                  </div>
                </div>
                {canReverse && !showReversal ? (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
                    setReverseId(movement.id)
                    setReason('')
                  }}>Estornar</Button>
                ) : null}
                {showReversal ? (
                  <form onSubmit={confirmReversal} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <Input label="Motivo do estorno" value={reason} maxLength={240} required onChange={(event) => setReason(event.target.value)} disabled={busy} />
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setReverseId(null)}>Cancelar</Button>
                    <Button type="submit" disabled={busy || !reason.trim()} loading={busy}>Confirmar estorno</Button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
      {loading ? <p role="status" className="text-sm text-[#555]">Carregando movimentações…</p> : null}
      {cursor && !loading ? <Button type="button" size="sm" variant="outline" onClick={showMore}>Carregar mais</Button> : null}
    </section>
  )
}
