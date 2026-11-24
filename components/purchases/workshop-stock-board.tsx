'use client'

import { PackagePlus, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import {
  isCountedStockUnit,
  workshopStockUnitLabel,
  workshopStockUnits,
  type WorkshopStockItemView,
  type WorkshopStockUnit,
} from '@/lib/workshop-stock'

const unitNames: Record<WorkshopStockUnit, string> = {
  unidade: 'Unidade',
  chapa: 'Chapa',
  metro: 'Metro',
  m2: 'Metro quadrado (m²)',
}
const unitOptions = workshopStockUnits.map((unit) => ({ value: unit, label: unitNames[unit] }))
const quantityFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 12 })
const nameOrder = new Intl.Collator('pt-BR')

type PendingPurchase = { requestId: string; quantity: number }

function purchaseRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  // The stock form also runs over HTTP on the workshop's local network.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function readPendingPurchase(itemId: string): PendingPurchase | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(`vertex:workshop-stock:${itemId}`) || 'null')
    if (value && typeof value.requestId === 'string' && typeof value.quantity === 'number') return value
  } catch {
    // Retries in this page still use the in-memory request.
  }
}

function storePendingPurchase(itemId: string, value?: PendingPurchase) {
  try {
    const key = `vertex:workshop-stock:${itemId}`
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch {
    // Storage can be blocked by browser settings.
  }
}

async function stockRequest<T>(fallback: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/workshop-stock', options).catch(() => { throw new Error(fallback) })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || fallback)
  return data
}

export function WorkshopStockBoard() {
  const [items, setItems] = useState<WorkshopStockItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState<WorkshopStockUnit>('unidade')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState<'create' | 'purchase' | null>(null)
  const [createError, setCreateError] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const [notice, setNotice] = useState('')
  const inFlight = useRef(false)
  const pendingPurchases = useRef(new Map<string, PendingPurchase>())

  useEffect(() => {
    const controller = new AbortController()
    stockRequest<{ items: WorkshopStockItemView[] }>('Não foi possível carregar o estoque.', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setItems(data.items)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('Não foi possível carregar o estoque.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt])

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    if (name.trim().length < 2) {
      setCreateError('Informe o nome do material.')
      return
    }

    inFlight.current = true
    setBusy('create')
    setCreateError('')
    setNotice('')
    try {
      const { item } = await stockRequest<{ item: WorkshopStockItemView }>('Não foi possível cadastrar o material.', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_ITEM', name: name.trim(), category: category.trim() || undefined, unit }),
      })
      setItems((current) => [...current.filter((existing) => existing.id !== item.id), item])
      setName('')
      setCategory('')
      setSearch('')
      setNotice(`${item.name} foi cadastrado.`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Não foi possível cadastrar o material.')
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const togglePurchase = (itemId: string) => {
    const pending = pendingPurchases.current.get(itemId) ?? readPendingPurchase(itemId)
    setSelectedId((current) => current === itemId ? null : itemId)
    setQuantity(pending ? String(pending.quantity).replace('.', ',') : '')
    setPurchaseError('')
  }

  const recordPurchase = async (event: FormEvent<HTMLFormElement>, stockItem: WorkshopStockItemView) => {
    event.preventDefault()
    if (inFlight.current) return
    const normalizedQuantity = quantity.trim().replace(',', '.')
    const amount = Number(normalizedQuantity)
    const counted = isCountedStockUnit(stockItem.unit)
    if (!/^(?:\d+|\d*\.\d{1,3})$/.test(normalizedQuantity) || amount <= 0 || amount > 1_000_000 || (counted && !Number.isInteger(amount))) {
      setPurchaseError(counted ? 'Informe uma quantidade inteira entre 1 e 1.000.000.' : 'Informe uma quantidade entre 0,001 e 1.000.000, com até três casas decimais.')
      return
    }

    inFlight.current = true
    setBusy('purchase')
    setPurchaseError('')
    setNotice('')
    try {
      const previous = pendingPurchases.current.get(stockItem.id) ?? readPendingPurchase(stockItem.id)
      const pending = previous?.quantity === amount ? previous : { requestId: purchaseRequestId(), quantity: amount }
      pendingPurchases.current.set(stockItem.id, pending)
      storePendingPurchase(stockItem.id, pending)
      const { item } = await stockRequest<{ item: WorkshopStockItemView }>('Não foi possível confirmar a compra. Tente novamente com a mesma quantidade.', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECORD_PURCHASE', itemId: stockItem.id, ...pending }),
      })
      if (item?.id !== stockItem.id) throw new Error('Não foi possível confirmar a compra. Tente novamente com a mesma quantidade.')

      pendingPurchases.current.delete(item.id)
      storePendingPurchase(item.id)
      setItems((current) => current.map((existing) => existing.id === item.id ? item : existing))
      setSelectedId(null)
      setQuantity('')
      setNotice(`Compra de ${item.name} registrada.`)
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Não foi possível confirmar a compra. Tente novamente com a mesma quantidade.')
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const query = search.trim().toLocaleLowerCase('pt-BR')
  const visibleItems = items.filter((item) => `${item.name} ${item.category || ''}`.toLocaleLowerCase('pt-BR').includes(query))
    .sort((left, right) => nameOrder.compare(left.name, right.name))
  const formsDisabled = busy !== null || loading || Boolean(loadError)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader><h2 className="text-base font-semibold text-[#121212]">Cadastrar material</h2></CardHeader>
        <CardBody>
          <form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_auto] lg:items-end">
            <Input label="Nome do material" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ex.: Dobradiça curva" required disabled={formsDisabled} />
            <Input label="Categoria (opcional)" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="Ex.: Ferragens" disabled={formsDisabled} />
            <Select label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value as WorkshopStockUnit)} options={unitOptions} disabled={formsDisabled} />
            <Button type="submit" className="min-h-10 self-end" loading={busy === 'create'} disabled={formsDisabled}><Plus size={16} aria-hidden="true" /> Cadastrar material</Button>
            {createError ? <p role="alert" className="text-sm text-red-700 sm:col-span-full">{createError}</p> : null}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#121212]">Materiais em estoque</h2>
          <Input type="search" aria-label="Buscar material" placeholder="Buscar material ou categoria" icon={<Search size={16} aria-hidden="true" />} value={search} onChange={(event) => setSearch(event.target.value)} />
        </CardHeader>
        {notice ? <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">{notice}</p> : null}
        {loading ? <p role="status" className="px-5 py-6 text-sm text-[#555]">Carregando estoque…</p> : null}
        {loadError ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-6">
            <p role="alert" className="text-sm text-red-700">{loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => { setLoadError(''); setLoading(true); setLoadAttempt((attempt) => attempt + 1) }}>Tentar novamente</Button>
          </div>
        ) : null}
        {!loading && !loadError && visibleItems.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#555]">{items.length ? 'Nenhum material encontrado.' : 'Nenhum material cadastrado.'}</p>
        ) : null}
        {visibleItems.length > 0 ? (
          <ul className="divide-y divide-[#EFEFEF]">
            {visibleItems.map((item) => {
              const pluralUnit = item.stockQuantity !== 1 && item.unit !== 'm2'
              const unitLabel = `${workshopStockUnitLabel(item.unit)}${pluralUnit ? 's' : ''}`
              const selected = selectedId === item.id
              return (
                <li key={item.id} className="space-y-3 px-5 py-4">
                  <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                    <div className="min-w-0 break-words">
                      <h3 className="text-sm font-semibold text-[#121212]">{item.name}</h3>
                      {item.category ? <p className="mt-1 text-xs text-[#555]">{item.category}</p> : null}
                    </div>
                    <div className="text-right sm:text-left">
                      <p className="text-xs text-[#555]">Saldo</p>
                      <p className="text-sm font-bold tabular-nums text-[#121212]">{quantityFormat.format(item.stockQuantity)} {unitLabel}</p>
                    </div>
                    <Button type="button" className="col-span-full min-h-10 sm:col-auto" variant="outline" aria-expanded={selected} onClick={() => togglePurchase(item.id)} disabled={busy !== null}>
                      <PackagePlus size={16} aria-hidden="true" /> {selected ? 'Fechar compra' : 'Registrar compra'}
                    </Button>
                  </div>
                  {selected ? (
                    <form onSubmit={(event) => void recordPurchase(event, item)} aria-label={`Registrar compra de ${item.name}`} className="grid gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Input label="Quantidade comprada" helperText={unitNames[item.unit]} inputMode={isCountedStockUnit(item.unit) ? 'numeric' : 'decimal'} value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={busy !== null} />
                      <Button type="submit" className="min-h-10" loading={busy === 'purchase'} disabled={busy !== null}>Confirmar compra</Button>
                      {purchaseError ? <p role="alert" className="text-sm text-red-700 sm:col-span-full">{purchaseError}</p> : null}
                    </form>
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
