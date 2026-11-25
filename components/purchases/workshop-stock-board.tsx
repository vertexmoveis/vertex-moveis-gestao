'use client'

import { ArrowDownToLine, ArrowUpFromLine, History, PackagePlus, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import {
  formatWorkshopStockQuantity,
  workshopStockItemTypes,
  workshopStockItemTypeLabels,
  type WorkshopStockItemInput,
  type WorkshopStockItemType,
  type WorkshopStockItemView,
  type WorkshopStockMovementInput,
  type WorkshopStockMovementKind,
} from '@/lib/workshop-stock'
import { WorkshopStockHistory } from './workshop-stock-history'
import { WorkshopStockItemForm } from './workshop-stock-item-form'
import { WorkshopStockMovementForm, WorkshopStockPurchaseForm } from './workshop-stock-movement-form'
import { WorkshopStockRequestError, workshopStockRequest } from './workshop-stock-request'

type StockPanel =
  | { type: 'create' }
  | { type: 'batch' }
  | { type: 'edit' | 'history'; itemId: string }
  | { type: 'movement'; itemId: string; initialKind: WorkshopStockMovementKind }

type StockMovement = WorkshopStockMovementInput | { action: 'REVERSE_MOVEMENT'; movementId: string; reason: string }
type StockMutation =
  | ({ action: 'CREATE_ITEM' } & WorkshopStockItemInput)
  | ({ action: 'UPDATE_ITEM'; itemId: string } & WorkshopStockItemInput)
  | { action: 'SET_ITEM_ACTIVE'; itemId: string; active: boolean }
  | StockMovement

type StockMutationResult = { item?: WorkshopStockItemView; items?: WorkshopStockItemView[] }
type PendingMovement = { requestId: string; payload: string }

const availabilityOptions = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'LOW', label: 'Para repor' },
  { value: 'EMPTY', label: 'Zerados' },
  { value: 'INACTIVE', label: 'Inativos' },
]
const itemTypeOptions = [
  { value: '', label: 'Todos os tipos' },
  ...workshopStockItemTypes.map((type) => ({ value: type, label: workshopStockItemTypeLabels[type] })),
]
const nameOrder = new Intl.Collator('pt-BR')

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

function displayItemType(item: WorkshopStockItemView): WorkshopStockItemType {
  if (item.itemType !== 'OTHER') return item.itemType
  const category = normalizeSearch(item.category || '')
  if (category.includes('ferragem') || category.includes('ferragens')) return 'HARDWARE'
  if (item.unit === 'chapa' && normalizeSearch(`${item.category || ''} ${item.name}`).includes('mdf')) return 'MDF_SHEET'
  return 'OTHER'
}

function needsRestock(item: WorkshopStockItemView) {
  return item.minimumStock !== null && item.stockQuantity <= item.minimumStock
}

function itemDetails(item: WorkshopStockItemView) {
  const size = item.lengthMm && item.widthMm
    ? `${formatWorkshopStockQuantity(item.lengthMm)} × ${formatWorkshopStockQuantity(item.widthMm)} mm`
    : null
  const thickness = item.thicknessMm ? `${formatWorkshopStockQuantity(item.thicknessMm)} mm de espessura` : null
  return [
    item.category,
    item.brand,
    item.finish,
    item.code ? `Cód. ${item.code}` : null,
    size,
    thickness,
  ].filter(Boolean).join(' · ')
}

function requestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  // Keep movements available over HTTP on the workshop's local network.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function movementSlot(input: StockMutation) {
  if (input.action === 'RECORD_PURCHASE_BATCH') return 'recebimento'
  if (input.action === 'RECORD_MOVEMENT') return `${input.itemId}:${input.kind}`
  if (input.action === 'REVERSE_MOVEMENT') return `estorno:${input.movementId}`
  return null
}

function readPendingMovement(key: string): PendingMovement | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (value && typeof value.requestId === 'string' && typeof value.payload === 'string') return value
  } catch {
    // If storage is unavailable, the active page retains pending requests in memory.
  }
}

function savePendingMovement(key: string, value?: PendingMovement) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch {
    // Browser settings can block storage access.
  }
}

export function WorkshopStockBoard() {
  const [items, setItems] = useState<WorkshopStockItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [itemType, setItemType] = useState('')
  const [availability, setAvailability] = useState('ACTIVE')
  const [panel, setPanel] = useState<StockPanel | null>(null)
  const [busy, setBusy] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [notice, setNotice] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  const inFlight = useRef(false)
  const pendingMovements = useRef(new Map<string, PendingMovement>())

  useEffect(() => {
    const controller = new AbortController()
    workshopStockRequest<{ items: WorkshopStockItemView[] }>('', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setItems(data.items)
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setLoadError(failure.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt])

  function retryLoading() {
    setLoadError('')
    setLoading(true)
    setLoadAttempt((previous) => previous + 1)
  }

  function openPanel(next: StockPanel | null) {
    if (inFlight.current) return
    setPanel(next)
    setOperationError('')
  }

  async function updateStock(input: StockMutation, success: string, keepHistory = false) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setOperationError('')
    setNotice('')

    const slot = movementSlot(input)
    const key = slot ? `vertex:workshop-stock-movement:${slot}` : null
    try {
      let body = input as StockMutation & { requestId?: string }
      if (key) {
        const payload = JSON.stringify(input)
        const previous = pendingMovements.current.get(key) ?? readPendingMovement(key)
        const pending = previous?.payload === payload ? previous : { requestId: requestId(), payload }
        pendingMovements.current.set(key, pending)
        savePendingMovement(key, pending)
        body = { ...input, requestId: pending.requestId }
      }

      const result = await workshopStockRequest<StockMutationResult>('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const updated = result.items ?? (result.item ? [result.item] : [])
      if (!updated.length) throw new Error('Não foi possível confirmar a alteração. Tente de novo.')

      if (key) {
        pendingMovements.current.delete(key)
        savePendingMovement(key)
      }
      setItems((previous) => {
        const incoming = new Map(updated.map((item) => [item.id, item]))
        return [...previous.filter((item) => !incoming.has(item.id)), ...incoming.values()]
      })
      if (input.action === 'CREATE_ITEM') {
        setSearch('')
        setItemType('')
        setAvailability('ACTIVE')
      }
      if (keepHistory) setHistoryVersion((previous) => previous + 1)
      else setPanel(null)
      setNotice(success)
    } catch (failure) {
      setOperationError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.')
      if (failure instanceof WorkshopStockRequestError && failure.status === 409) {
        const latest = await workshopStockRequest<{ items: WorkshopStockItemView[] }>().catch(() => null)
        if (latest) setItems(latest.items)
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const query = normalizeSearch(search)
  const activeItems = items.filter((item) => item.active).sort((left, right) => nameOrder.compare(left.name, right.name))
  const visibleItems = items.filter((item) => {
    if (item.active === (availability === 'INACTIVE')) return false
    if (availability === 'LOW' && !needsRestock(item)) return false
    if (availability === 'EMPTY' && item.stockQuantity !== 0) return false
    const type = displayItemType(item)
    if (itemType && type !== itemType) return false
    const description = `${item.name} ${workshopStockItemTypeLabels[type]} ${itemDetails(item)} ${item.location || ''}`
    return !query || normalizeSearch(description).includes(query)
  }).sort((left, right) => nameOrder.compare(left.name, right.name))
  const actionsDisabled = busy || loading || Boolean(loadError)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#121212]">Materiais em estoque</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-10" disabled={actionsDisabled || !activeItems.length} onClick={() => openPanel({ type: 'batch' })}>
                <PackagePlus size={16} aria-hidden="true" /> Receber compra
              </Button>
              <Button type="button" className="min-h-10" disabled={actionsDisabled} onClick={() => openPanel({ type: 'create' })}>
                <Plus size={16} aria-hidden="true" /> Novo material
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr]">
            <div className="col-span-2 md:col-span-1">
              <Input type="search" label="Buscar material" placeholder="Nome, código, marca ou localização" icon={<Search size={16} aria-hidden="true" />} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select label="Tipo de material" value={itemType} onChange={(event) => setItemType(event.target.value)} options={itemTypeOptions} />
            <Select label="Mostrar" value={availability} onChange={(event) => setAvailability(event.target.value)} options={availabilityOptions} />
          </div>
        </CardHeader>

        {notice ? <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">{notice}</p> : null}
        {panel?.type === 'create' || panel?.type === 'batch' ? (
          <CardBody className="space-y-3 border-b border-[#E8E8E8] bg-[#FAFAFA]">
            <h3 className="text-sm font-semibold text-[#121212]">{panel.type === 'create' ? 'Novo material' : 'Receber compra'}</h3>
            {panel.type === 'create' ? (
              <WorkshopStockItemForm
                busy={busy}
                onCancel={() => openPanel(null)}
                onSubmit={(input) => void updateStock({ action: 'CREATE_ITEM', ...input }, `${input.name} foi cadastrado.`)}
              />
            ) : (
              <WorkshopStockPurchaseForm
                items={activeItems}
                busy={busy}
                onCancel={() => openPanel(null)}
                onSubmit={(input) => void updateStock(input, 'Compra registrada e saldos atualizados.')}
              />
            )}
            {operationError ? <p role="alert" className="text-sm text-red-700">{operationError}</p> : null}
          </CardBody>
        ) : null}

        {loading ? <p role="status" className="px-5 py-6 text-sm text-[#555]">Carregando estoque…</p> : null}
        {loadError ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-6">
            <p role="alert" className="text-sm text-red-700">{loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={retryLoading}>Tentar novamente</Button>
          </div>
        ) : null}
        {!loading && !loadError && !visibleItems.length ? (
          <p className="px-5 py-8 text-center text-sm text-[#555]">{items.length ? 'Nenhum material para esses filtros.' : 'Nenhum material cadastrado.'}</p>
        ) : null}
        {visibleItems.length ? (
          <ul className="divide-y divide-[#EFEFEF]">
            {visibleItems.map((item) => {
              const rowPanel = panel && 'itemId' in panel && panel.itemId === item.id ? panel : null
              const details = itemDetails(item)
              const isLow = needsRestock(item)
              return (
                <li key={item.id} className="space-y-3 px-5 py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-[#121212]">{item.name}</h3>
                      {details ? <p className="mt-1 break-words text-xs text-[#555]">{details}</p> : null}
                      {item.location ? <p className="mt-1 break-words text-xs text-[#555]">Localização · {item.location}</p> : null}
                    </div>
                    <div className="text-right lg:text-left">
                      <p className="text-xs text-[#555]">Saldo</p>
                      <p className="text-sm font-bold tabular-nums text-[#121212]">{formatWorkshopStockQuantity(item.stockQuantity, item.unit)}</p>
                      {item.active && item.stockQuantity === 0 ? <p className="mt-0.5 text-xs font-medium text-[#8F2E14]">Zerado</p> : null}
                      {item.active && item.stockQuantity > 0 && isLow ? <p className="mt-0.5 text-xs font-medium text-[#8F2E14]">Para repor</p> : null}
                      {item.minimumStock !== null ? <p className="mt-0.5 text-xs text-[#555]">Mínimo {formatWorkshopStockQuantity(item.minimumStock, item.unit)}</p> : null}
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-2 lg:col-span-1 lg:justify-end">
                      {item.active ? (
                        <>
                          <Button type="button" variant="outline" className="min-h-10" disabled={actionsDisabled} onClick={() => openPanel({ type: 'movement', itemId: item.id, initialKind: 'PURCHASE' })}>
                            <ArrowDownToLine size={15} aria-hidden="true" /> Entrada
                          </Button>
                          <Button type="button" variant="outline" className="min-h-10" disabled={actionsDisabled} onClick={() => openPanel({ type: 'movement', itemId: item.id, initialKind: 'WITHDRAWAL' })}>
                            <ArrowUpFromLine size={15} aria-hidden="true" /> Retirada
                          </Button>
                        </>
                      ) : null}
                      <Button type="button" variant="ghost" className="min-h-10" disabled={actionsDisabled} aria-expanded={rowPanel?.type === 'history'} onClick={() => openPanel(rowPanel?.type === 'history' ? null : { type: 'history', itemId: item.id })}>
                        <History size={15} aria-hidden="true" /> Histórico
                      </Button>
                      <Button type="button" variant="ghost" className="min-h-10" disabled={actionsDisabled} aria-expanded={rowPanel?.type === 'edit'} onClick={() => openPanel(rowPanel?.type === 'edit' ? null : { type: 'edit', itemId: item.id })}>
                        <Pencil size={15} aria-hidden="true" /> Editar
                      </Button>
                    </div>
                  </div>
                  {rowPanel ? (
                    <div className="space-y-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 sm:p-4">
                      {rowPanel.type === 'movement' ? (
                        <WorkshopStockMovementForm
                          key={`${item.id}:${rowPanel.initialKind}`}
                          item={item}
                          initialKind={rowPanel.initialKind}
                          busy={busy}
                          onCancel={() => openPanel(null)}
                          onSubmit={(input) => void updateStock(input, `Movimentação de ${item.name} registrada.`)}
                        />
                      ) : null}
                      {rowPanel.type === 'history' ? (
                        <WorkshopStockHistory
                          key={`${item.id}:${historyVersion}`}
                          item={item}
                          busy={busy}
                          onReverse={(movementId, reason) => void updateStock({ action: 'REVERSE_MOVEMENT', movementId, reason }, 'Estorno registrado e saldo atualizado.', true)}
                        />
                      ) : null}
                      {rowPanel.type === 'edit' ? (
                        <>
                          <h4 className="text-sm font-semibold text-[#121212]">Editar material</h4>
                          <WorkshopStockItemForm
                            key={item.id}
                            item={item}
                            busy={busy}
                            onCancel={() => openPanel(null)}
                            onSubmit={(input) => void updateStock({ action: 'UPDATE_ITEM', itemId: item.id, ...input }, 'Cadastro atualizado.')}
                          />
                          <Button type="button" variant="outline" disabled={busy} onClick={() => void updateStock(
                            { action: 'SET_ITEM_ACTIVE', itemId: item.id, active: !item.active },
                            item.active ? 'Material movido para Inativos.' : 'Material reativado.',
                          )}>{item.active ? 'Inativar material' : 'Reativar material'}</Button>
                        </>
                      ) : null}
                      {operationError ? <p role="alert" className="text-sm text-red-700">{operationError}</p> : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
