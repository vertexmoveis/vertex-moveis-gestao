'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  MapPin,
  PackageCheck,
  Save,
  Search,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { dateOnlyKey, formatDateOnly } from '@/lib/date-only'
import { inventoryUnitLabel } from '@/lib/inventory'
import { formatCurrency } from '@/lib/utils'

type SupplierPrice = {
  id: string
  supplier: string
  unitCost: number
  quotedAt: string
  notes: string | null
}

type InventoryMaterial = {
  id: string
  name: string
  category: string | null
  defaultFinish: string | null
  unit: string
  unitCost: number
  supplier: string | null
  stockQuantity: number
  reservedQuantity: number
  availableQuantity: number
  minimumStock: number
  location: string | null
  lowStock: boolean
  shortage: number
  updatedAt: string
  supplierPrices: SupplierPrice[]
}

type InventoryDraft = {
  stockQuantity: string
  minimumStock: string
  location: string
}

type SupplierDraft = {
  supplier: string
  unitCost: string
  quotedAt: string
  notes: string
  applyAsDefault: boolean
}

function materialDraft(material: InventoryMaterial): InventoryDraft {
  return {
    stockQuantity: String(material.stockQuantity),
    minimumStock: String(material.minimumStock),
    location: material.location || '',
  }
}

function emptySupplierDraft(material: InventoryMaterial): SupplierDraft {
  return {
    supplier: material.supplier || '',
    unitCost: material.unitCost > 0 ? String(material.unitCost) : '',
    quotedAt: dateOnlyKey(new Date()) || '',
    notes: '',
    applyAsDefault: true,
  }
}

async function fetchInventoryMaterials() {
  const response = await fetch('/api/inventory', { cache: 'no-store' })
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível carregar o estoque.')
  }
  return Array.isArray(payload) ? payload as InventoryMaterial[] : []
}

export function InventoryBoard() {
  const [materials, setMaterials] = useState<InventoryMaterial[]>([])
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({})
  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, SupplierDraft>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let canceled = false
    void fetchInventoryMaterials()
      .then((rows) => {
        if (canceled) return
        setMaterials(rows)
        setDrafts(Object.fromEntries(rows.map((material) => [material.id, materialDraft(material)])))
        setSupplierDrafts(Object.fromEntries(rows.map((material) => [material.id, emptySupplierDraft(material)])))
      })
      .catch((error) => {
        if (!canceled) {
          setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o estoque.')
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [])

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return materials.filter((material) => {
      if (lowOnly && !material.lowStock) return false
      if (!normalizedQuery) return true
      return [
        material.name,
        material.category,
        material.supplier,
        material.location,
      ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
    })
  }, [lowOnly, materials, query])

  const lowCount = useMemo(
    () => materials.filter((material) => material.lowStock).length,
    [materials],
  )
  const inventoryValue = useMemo(
    () => materials.reduce((sum, material) => sum + material.stockQuantity * material.unitCost, 0),
    [materials],
  )

  const replaceMaterial = (updated: InventoryMaterial) => {
    setMaterials((current) => current.map((material) => material.id === updated.id ? updated : material))
    setDrafts((current) => ({ ...current, [updated.id]: materialDraft(updated) }))
    setSupplierDrafts((current) => ({ ...current, [updated.id]: emptySupplierDraft(updated) }))
  }

  const saveInventory = async (material: InventoryMaterial) => {
    const draft = drafts[material.id]
    if (!draft) return
    setBusyId(material.id)
    setMessage('')
    const response = await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialId: material.id,
        stockQuantity: draft.stockQuantity,
        minimumStock: draft.minimumStock,
        location: draft.location,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId(null)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível salvar o estoque.')
      return
    }
    replaceMaterial(payload)
    setMessage(`${material.name} atualizado.`)
  }

  const saveSupplierPrice = async (material: InventoryMaterial) => {
    const draft = supplierDrafts[material.id]
    if (!draft) return
    setBusyId(`supplier:${material.id}`)
    setMessage('')
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId: material.id, ...draft }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusyId(null)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível registrar a cotação.')
      return
    }
    replaceMaterial(payload)
    setMessage(`Preço de ${material.name} registrado no histórico.`)
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-[#E8E8E8] bg-white">
        <Loader2 size={22} className="animate-spin text-[#FF6B00]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Materiais ativos" value={materials.length} />
        <Summary label="Abaixo do mínimo" value={lowCount} tone={lowCount > 0 ? 'warning' : 'success'} />
        <Summary label="Valor estimado em estoque" value={formatCurrency(inventoryValue)} />
        <Summary label="Reservas ativas" value={materials.reduce((sum, material) => sum + material.reservedQuantity, 0).toLocaleString('pt-BR')} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#E8E8E8] bg-white p-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar material</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar material, fornecedor ou localização"
            className="min-h-10 w-full rounded-lg border border-[#D9D9D9] pl-9 pr-3 text-sm outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
          />
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold text-[#444]">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => setLowOnly(event.target.checked)}
            className="h-4 w-4 accent-[#FF6B00]"
          />
          Somente reposição
        </label>
        <span className="text-xs text-[#777]">{visible.length} material{visible.length !== 1 ? 'is' : ''}</span>
      </div>

      {message ? <p role="status" className="rounded-lg bg-[#F5F5F5] px-3 py-2 text-sm text-[#555]">{message}</p> : null}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D9D9D9] bg-white py-14 text-center">
          <PackageCheck size={32} className="mx-auto text-emerald-600" />
          <p className="mt-2 text-sm font-semibold text-[#121212]">Nenhum material encontrado</p>
          <p className="mt-1 text-xs text-[#777]">Ajuste a busca ou o filtro de reposição.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((material) => {
            const draft = drafts[material.id] || materialDraft(material)
            const supplierDraft = supplierDrafts[material.id] || emptySupplierDraft(material)
            const expanded = expandedId === material.id
            const unit = inventoryUnitLabel(material.unit)

            return (
              <article key={material.id} className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFEFEF] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#121212]">{material.name}</h3>
                      {material.lowStock ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                          <AlertTriangle size={11} />
                          Repor {material.shortage.toFixed(2)} {unit}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Estoque suficiente</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#777]">
                      {[material.category, material.defaultFinish].filter(Boolean).join(' · ') || 'Sem categoria'}
                    </p>
                    <p className="mt-1 text-[11px] text-[#666]">
                      Disponível: <strong>{material.availableQuantity.toLocaleString('pt-BR')} {unit}</strong>
                      {material.reservedQuantity > 0 ? ` · ${material.reservedQuantity.toLocaleString('pt-BR')} ${unit} reservados` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#121212]">{formatCurrency(material.unitCost)} / {unit}</p>
                    <p className="mt-1 text-xs text-[#777]">{material.supplier || 'Sem fornecedor padrão'}</p>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
                    <Input
                      label={`Saldo (${unit})`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.stockQuantity}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [material.id]: { ...draft, stockQuantity: event.target.value },
                      }))}
                    />
                    <Input
                      label={`Mínimo (${unit})`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.minimumStock}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [material.id]: { ...draft, minimumStock: event.target.value },
                      }))}
                    />
                    <Input
                      label="Localização"
                      value={draft.location}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [material.id]: { ...draft, location: event.target.value },
                      }))}
                      placeholder="Ex.: Prateleira A2"
                      icon={<MapPin size={14} />}
                    />
                    <button
                      type="button"
                      title="Salvar estoque"
                      disabled={busyId === material.id}
                      onClick={() => void saveInventory(material)}
                      className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#121212] px-3 text-xs font-semibold text-white hover:bg-[#2A2A2A] disabled:opacity-50 sm:col-span-1"
                    >
                      {busyId === material.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : material.id)}
                    aria-expanded={expanded}
                    className="flex min-h-10 w-full items-center justify-between rounded-lg border border-[#E8E8E8] px-3 text-left text-xs font-semibold text-[#444] hover:bg-[#FAFAFA]"
                  >
                    <span className="inline-flex items-center gap-2"><History size={14} /> Preços e fornecedores</span>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {expanded ? (
                    <div className="space-y-4 rounded-lg bg-[#FAFAFA] p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Fornecedor"
                          value={supplierDraft.supplier}
                          onChange={(event) => setSupplierDrafts((current) => ({
                            ...current,
                            [material.id]: { ...supplierDraft, supplier: event.target.value },
                          }))}
                          icon={<Truck size={14} />}
                        />
                        <Input
                          label={`Custo por ${unit}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={supplierDraft.unitCost}
                          onChange={(event) => setSupplierDrafts((current) => ({
                            ...current,
                            [material.id]: { ...supplierDraft, unitCost: event.target.value },
                          }))}
                        />
                        <Input
                          label="Data da cotação"
                          type="date"
                          value={supplierDraft.quotedAt}
                          onChange={(event) => setSupplierDrafts((current) => ({
                            ...current,
                            [material.id]: { ...supplierDraft, quotedAt: event.target.value },
                          }))}
                        />
                        <Textarea
                          label="Observação"
                          value={supplierDraft.notes}
                          onChange={(event) => setSupplierDrafts((current) => ({
                            ...current,
                            [material.id]: { ...supplierDraft, notes: event.target.value },
                          }))}
                          className="min-h-10"
                        />
                      </div>
                      <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#555]">
                        <input
                          type="checkbox"
                          checked={supplierDraft.applyAsDefault}
                          onChange={(event) => setSupplierDrafts((current) => ({
                            ...current,
                            [material.id]: { ...supplierDraft, applyAsDefault: event.target.checked },
                          }))}
                          className="mt-0.5 h-4 w-4 accent-[#FF6B00]"
                        />
                        Usar este fornecedor e custo como padrão nos próximos orçamentos.
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        loading={busyId === `supplier:${material.id}`}
                        disabled={supplierDraft.supplier.trim().length < 2 || Number(supplierDraft.unitCost) <= 0}
                        onClick={() => void saveSupplierPrice(material)}
                      >
                        <Save size={14} />
                        Registrar cotação
                      </Button>

                      {material.supplierPrices.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                          {material.supplierPrices.map((price) => (
                            <div key={price.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEFEF] px-3 py-2.5 text-xs last:border-b-0">
                              <div>
                                <p className="font-semibold text-[#121212]">{price.supplier}</p>
                                <p className="mt-0.5 text-[#777]">{formatDateOnly(price.quotedAt)}{price.notes ? ` · ${price.notes}` : ''}</p>
                              </div>
                              <strong className="text-[#121212]">{formatCurrency(price.unitCost)} / {unit}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#777]">Nenhuma cotação anterior registrada.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Summary({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'success'
}) {
  const className = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-[#E8E8E8] bg-white text-[#121212]'
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}
