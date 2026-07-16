'use client'

import { Check, ExternalLink, PackageCheck, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type PurchaseStatus = 'PENDING' | 'ORDERED' | 'RECEIVED'

export type PurchaseMaterial = {
  id: string
  projectId: string
  materialId: string | null
  materialName: string
  finish: string | null
  unit: 'm2' | 'metro' | 'unidade'
  estimatedQuantity: number
  purchasedQuantity: number
  estimatedCost: number
  actualCost: number | null
  supplier: string | null
  status: PurchaseStatus
  notes: string | null
  project: { id: string; name: string; room: string | null; client: { name: string } }
}

const STATUS = {
  PENDING: { label: 'Precisa comprar', className: 'bg-amber-50 text-amber-800' },
  ORDERED: { label: 'Pedido feito', className: 'bg-blue-50 text-blue-700' },
  RECEIVED: { label: 'Recebido', className: 'bg-emerald-50 text-emerald-700' },
} as const

function unitLabel(unit: PurchaseMaterial['unit']) {
  return unit === 'm2' ? 'm²' : unit === 'metro' ? 'm' : 'un.'
}

export function PurchasesBoard({ initialMaterials, limited }: { initialMaterials: PurchaseMaterial[]; limited: boolean }) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [filter, setFilter] = useState<'ALL' | PurchaseStatus>('ALL')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const visible = useMemo(
    () => materials.filter((material) => filter === 'ALL' || material.status === filter),
    [filter, materials]
  )
  const summary = useMemo(() => ({
    pending: materials.filter((material) => material.status === 'PENDING').length,
    ordered: materials.filter((material) => material.status === 'ORDERED').length,
    estimated: materials.reduce((total, material) => total + material.estimatedCost, 0),
    actual: materials.reduce((total, material) => total + (material.actualCost || 0), 0),
  }), [materials])

  const updateStatus = async (material: PurchaseMaterial, status: PurchaseStatus) => {
    setSavingId(material.id)
    setError('')
    const response = await fetch(`/api/projects/${material.projectId}/materials/${material.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialId: material.materialId,
        materialName: material.materialName,
        finish: material.finish,
        unit: material.unit,
        estimatedQuantity: material.estimatedQuantity,
        purchasedQuantity: material.purchasedQuantity,
        estimatedCost: material.estimatedCost,
        actualCost: material.actualCost,
        supplier: material.supplier,
        notes: material.notes,
        status,
      }),
    })
    const updated = await response.json().catch(() => null)
    setSavingId(null)
    if (!response.ok) return setError(updated?.error || 'Não foi possível atualizar o material.')
    setMaterials((current) => status === 'RECEIVED'
      ? current.filter((item) => item.id !== material.id)
      : current.map((item) => item.id === material.id ? { ...item, ...updated } : item)
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Para comprar" value={summary.pending} />
        <Summary label="Pedidos abertos" value={summary.ordered} />
        <Summary label="Custo previsto" value={formatCurrency(summary.estimated)} />
        <Summary label="Custo real lançado" value={formatCurrency(summary.actual)} tone="blue" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'PENDING', 'ORDERED'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${filter === status ? 'border-[#FF6B00] bg-[#FFF3EA] text-[#D95800]' : 'border-[#E8E8E8] bg-white text-[#555] hover:bg-[#FAFAFA]'}`}
          >
            {status === 'ALL' ? 'Todos' : STATUS[status].label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#9E9E9E]">{visible.length} item{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {limited ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Mostrando os 160 itens mais recentes. Finalize ou filtre materiais antigos nos projetos para manter a lista leve.</p> : null}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#D9D9D9] bg-white py-16 text-center">
          <PackageCheck size={36} className="mb-3 text-emerald-600" />
          <p className="text-sm font-semibold text-[#121212]">Nenhuma compra pendente</p>
          <p className="mt-1 text-xs text-[#777]">Os materiais recebidos continuam registrados dentro de cada projeto.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
          <div className="divide-y divide-[#F0F0F0]">
            {visible.map((material) => {
              const remaining = Math.max(material.estimatedQuantity - material.purchasedQuantity, 0)
              const nextStatus = material.status === 'PENDING' ? 'ORDERED' : material.status === 'ORDERED' ? 'RECEIVED' : null
              return (
                <div key={material.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#121212]">{material.materialName}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS[material.status].className}`}>{STATUS[material.status].label}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#777]">{material.project.name} · {material.project.client.name}{material.project.room ? ` · ${material.project.room}` : ''}</p>
                    <p className="mt-1 text-xs text-[#9E9E9E]">
                      Falta: {remaining.toFixed(2)} {unitLabel(material.unit)} · Previsto: {formatCurrency(material.estimatedCost)}{material.supplier ? ` · ${material.supplier}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {material.actualCost !== null ? <span className="text-xs font-semibold text-blue-700">Real: {formatCurrency(material.actualCost)}</span> : null}
                    <Link href={`/dashboard/projects/${material.projectId}#materiais`} title="Abrir compras do projeto" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#555] hover:bg-[#F5F5F5]">
                      <ExternalLink size={14} />
                    </Link>
                    {nextStatus ? (
                      <Button type="button" size="sm" loading={savingId === material.id} onClick={() => void updateStatus(material, nextStatus)}>
                        {nextStatus === 'ORDERED' ? <ShoppingCart size={13} /> : <Check size={13} />}
                        {nextStatus === 'ORDERED' ? 'Pedido feito' : 'Recebido'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Summary({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'blue' }) {
  return (
    <div className={`rounded-lg p-4 ${tone === 'blue' ? 'bg-blue-50' : 'border border-[#E8E8E8] bg-white'}`}>
      <p className={`text-[10px] ${tone === 'blue' ? 'text-blue-700' : 'text-[#9E9E9E]'}`}>{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === 'blue' ? 'text-blue-700' : 'text-[#121212]'}`}>{value}</p>
    </div>
  )
}
