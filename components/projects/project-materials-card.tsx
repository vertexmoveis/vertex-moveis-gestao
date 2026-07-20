'use client'

import { PackagePlus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { calculateProjectCostSummary, type ProjectCostSummary } from '@/lib/project-costs'

type ProjectMaterial = {
  id: string
  materialId: string | null
  materialName: string
  finish: string | null
  unit: 'm2' | 'metro' | 'unidade'
  estimatedQuantity: number
  purchasedQuantity: number
  estimatedCost: number | null
  actualCost: number | null
  supplier: string | null
  status: 'PENDING' | 'ORDERED' | 'RECEIVED'
  notes: string | null
}

type CatalogMaterial = {
  id: string
  name: string
  defaultFinish: string | null
  unit: 'm2' | 'metro' | 'unidade'
  unitCost: number
}

const MATERIAL_STATUS = {
  PENDING: { label: 'Precisa comprar', className: 'bg-amber-50 text-amber-700' },
  ORDERED: { label: 'Pedido feito', className: 'bg-blue-50 text-blue-700' },
  RECEIVED: { label: 'Recebido', className: 'bg-emerald-50 text-emerald-700' },
} as const

function unitLabel(unit: ProjectMaterial['unit']) {
  return unit === 'm2' ? 'm²' : unit === 'metro' ? 'm' : 'un.'
}

function numberValue(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function ProjectMaterialsCard({
  projectId,
  projectValue,
  baseCost,
  canManage,
  onCostSummaryChange,
}: {
  projectId: string
  projectValue: number | null
  baseCost: number | null
  canManage: boolean
  onCostSummaryChange?: (summary: ProjectCostSummary) => void
}) {
  const [materials, setMaterials] = useState<ProjectMaterial[]>([])
  const [catalog, setCatalog] = useState<CatalogMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [newMaterialId, setNewMaterialId] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      fetch(`/api/projects/${projectId}/materials`).then((response) => response.ok ? response.json() : []),
      fetch('/api/settings/materials?active=1').then((response) => response.ok ? response.json() : []),
    ]).then(([projectMaterials, catalogMaterials]) => {
      if (!active) return
      setMaterials(Array.isArray(projectMaterials) ? projectMaterials : [])
      setCatalog(Array.isArray(catalogMaterials) ? catalogMaterials : [])
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('Não foi possível carregar a lista de materiais.')
      setLoading(false)
    })
    return () => { active = false }
  }, [projectId])

  const totals = useMemo(() => {
    const estimated = materials.reduce((sum, item) => sum + (item.estimatedCost || 0), 0)
    const actual = materials.reduce((sum, item) => sum + (item.actualCost || 0), 0)
    const bought = materials.filter((item) => item.status === 'RECEIVED').length
    return { estimated, actual, bought }
  }, [materials])
  const costSummary = useMemo(() => calculateProjectCostSummary(baseCost, materials), [baseCost, materials])

  useEffect(() => {
    onCostSummaryChange?.(costSummary)
  }, [costSummary, onCostSummaryChange])

  const saveMaterial = async (material: ProjectMaterial) => {
    if (!canManage) return
    setSavingId(material.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/materials/${material.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId(null)
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar o material.')
    setMaterials((current) => current.map((item) => item.id === material.id ? data : item))
  }

  const updateMaterial = <K extends keyof ProjectMaterial>(id: string, field: K, value: ProjectMaterial[K]) => {
    setMaterials((current) => current.map((material) => material.id === id ? { ...material, [field]: value } : material))
  }

  const addMaterial = async () => {
    const selected = catalog.find((material) => material.id === newMaterialId)
    if (!selected) return
    setSavingId('new')
    setError('')
    const response = await fetch(`/api/projects/${projectId}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialId: selected.id,
        materialName: selected.name,
        finish: selected.defaultFinish,
        unit: selected.unit,
        estimatedQuantity: 0,
        purchasedQuantity: 0,
        estimatedCost: 0,
        actualCost: null,
        supplier: null,
        status: 'PENDING',
        notes: null,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId(null)
    if (!response.ok) return setError(data?.error || 'Não foi possível adicionar o material.')
    setMaterials((current) => [...current, data])
    setNewMaterialId('')
  }

  const removeMaterial = async (material: ProjectMaterial) => {
    if (!canManage || !window.confirm(`Excluir ${material.materialName} da lista?`)) return
    const response = await fetch(`/api/projects/${projectId}/materials/${material.id}`, { method: 'DELETE' })
    if (!response.ok) return setError('Não foi possível excluir o material.')
    setMaterials((current) => current.filter((item) => item.id !== material.id))
  }

  const realMargin = projectValue === null ? null : projectValue - costSummary.adjustedCost

  return (
    <Card id="materiais" className="scroll-mt-28">
      <CardHeader>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#121212]">Compras e materiais</h3>
              <p className="mt-1 text-xs text-[#9E9E9E]">{totals.bought}/{materials.length} itens recebidos</p>
            </div>
            {canManage ? <Link href="/dashboard/purchases" className="shrink-0 text-xs font-semibold text-[#FF6B00] hover:underline">Lista geral</Link> : null}
          </div>
          {canManage ? (
            <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2">
              <select value={newMaterialId} onChange={(event) => setNewMaterialId(event.target.value)} className="h-8 min-w-0 w-full rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]">
                <option value="">Adicionar material</option>
                {catalog.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
              <Button type="button" size="sm" className="h-8 w-8 px-0" onClick={() => void addMaterial()} loading={savingId === 'new'} disabled={!newMaterialId} title="Adicionar material">
                <PackagePlus size={14} />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        {canManage ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
            <div className="rounded-lg bg-[#FAFAFA] p-3"><p className="text-[10px] text-[#9E9E9E]">Materiais previstos</p><p className="mt-1 font-bold text-[#121212]">{formatCurrency(totals.estimated)}</p></div>
            <div className="rounded-lg bg-blue-50 p-3"><p className="text-[10px] text-blue-700">Custo ajustado</p><p className="mt-1 font-bold text-blue-700">{formatCurrency(costSummary.adjustedCost)}</p><p className="mt-1 text-[10px] text-blue-700/70">{costSummary.trackedMaterials}/{costSummary.totalMaterials} custos reais</p></div>
            <div className="rounded-lg bg-emerald-50 p-3"><p className="text-[10px] text-emerald-700">Lucro ajustado</p><p className="mt-1 font-bold text-emerald-700">{realMargin === null ? '-' : formatCurrency(realMargin)}</p></div>
          </div>
        ) : null}

        {loading ? <div className="h-28 animate-pulse rounded-lg bg-[#F5F5F5]" /> : materials.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#9E9E9E]">Nenhum material previsto para este projeto.</p>
        ) : (
          <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
            {materials.map((material) => (
              <div key={material.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#121212]">{material.materialName}</p>
                    {material.finish ? <p className="text-xs text-[#777]">{material.finish}</p> : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${MATERIAL_STATUS[material.status].className}`}>{MATERIAL_STATUS[material.status].label}</span>
                </div>
                {canManage ? (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                    <Input label={`Previsto (${unitLabel(material.unit)})`} inputMode="decimal" value={String(material.estimatedQuantity)} onChange={(event) => updateMaterial(material.id, 'estimatedQuantity', numberValue(event.target.value))} />
                    <Input label={`Comprado (${unitLabel(material.unit)})`} inputMode="decimal" value={String(material.purchasedQuantity)} onChange={(event) => updateMaterial(material.id, 'purchasedQuantity', numberValue(event.target.value))} />
                    <Input label="Custo previsto" inputMode="decimal" value={String(material.estimatedCost || 0)} onChange={(event) => updateMaterial(material.id, 'estimatedCost', numberValue(event.target.value))} />
                    <Input label="Custo real" inputMode="decimal" value={material.actualCost === null ? '' : String(material.actualCost)} onChange={(event) => updateMaterial(material.id, 'actualCost', event.target.value === '' ? null : numberValue(event.target.value))} placeholder="R$ 0,00" />
                    <Input label="Fornecedor" value={material.supplier || ''} onChange={(event) => updateMaterial(material.id, 'supplier', event.target.value || null)} placeholder="Nome do fornecedor" />
                    <Select label="Status da compra" value={material.status} onChange={(event) => updateMaterial(material.id, 'status', event.target.value as ProjectMaterial['status'])} options={Object.entries(MATERIAL_STATUS).map(([value, item]) => ({ value, label: item.label }))} />
                  </div>
                ) : (
                  <p className="text-xs text-[#777]">{material.estimatedQuantity.toFixed(2)} {unitLabel(material.unit)} · {MATERIAL_STATUS[material.status].label}</p>
                )}
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg bg-[#FAFAFA] px-3 py-2 text-[11px] text-[#777]">
                  <span>Falta comprar: <strong className="text-[#121212]">{Math.max(material.estimatedQuantity - material.purchasedQuantity, 0).toFixed(2)} {unitLabel(material.unit)}</strong></span>
                  {material.actualCost !== null ? <span>Diferença: <strong className={material.actualCost > (material.estimatedCost || 0) ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(material.actualCost - (material.estimatedCost || 0))}</strong></span> : null}
                </div>
                {canManage ? (
                  <div className="flex justify-end gap-2 border-t border-[#F0F0F0] pt-3">
                    <Button type="button" size="sm" variant="outline" loading={savingId === material.id} onClick={() => void saveMaterial(material)}><Save size={13} /> Salvar</Button>
                    <button type="button" title="Excluir material" onClick={() => void removeMaterial(material)} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
