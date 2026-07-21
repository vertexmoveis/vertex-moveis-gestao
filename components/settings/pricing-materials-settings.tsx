'use client'

import { Pencil, Plus, Power, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { QUOTE_CALCULATION_MODE_LABELS, QUOTE_ENVIRONMENT_OPTIONS, QUOTE_PRICE_PROFILE_LABELS, QUOTE_PRICE_PROFILES, type QuoteCalculationMode, type QuotePriceProfile } from '@/lib/quotes'
import type { QuotePriceRule } from '@/lib/quote-price-rules'
import { formatCurrency } from '@/lib/utils'

type MaterialCatalogItem = {
  id: string
  name: string
  category: string | null
  defaultFinish: string | null
  unit: string
  unitCost: number
  supplier: string | null
  active: boolean
  updatedAt: string
}

type PriceRuleDraft = {
  name: string
  environment: string
  furnitureType: string
  furnitureModel: string
  priceProfile: string
  calculationMode: QuoteCalculationMode
  pricePerM2: string
  materialCostPerM2: string
  validFrom: string
  validUntil: string
  active: boolean
}

type MaterialDraft = {
  name: string
  category: string
  defaultFinish: string
  unit: string
  unitCost: string
  supplier: string
  active: boolean
}

function dateInput(value?: string | Date | null) {
  if (!value) return ''
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)
}

function defaultPriceRule(): PriceRuleDraft {
  return {
    name: '',
    environment: '',
    furnitureType: '',
    furnitureModel: '',
    priceProfile: '',
    calculationMode: 'AREA_M2',
    pricePerM2: '',
    materialCostPerM2: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: '',
    active: true,
  }
}

function ruleToDraft(rule: QuotePriceRule): PriceRuleDraft {
  return {
    name: rule.name,
    environment: rule.environment || '',
    furnitureType: rule.furnitureType || '',
    furnitureModel: rule.furnitureModel || '',
    priceProfile: rule.priceProfile || '',
    calculationMode: rule.calculationMode,
    pricePerM2: String(rule.pricePerM2),
    materialCostPerM2: rule.materialCostPerM2 === null || rule.materialCostPerM2 === undefined ? '' : String(rule.materialCostPerM2),
    validFrom: dateInput(rule.validFrom),
    validUntil: dateInput(rule.validUntil),
    active: rule.active !== false,
  }
}

function defaultMaterial(): MaterialDraft {
  return { name: '', category: '', defaultFinish: '', unit: 'm2', unitCost: '', supplier: '', active: true }
}

function materialToDraft(material: MaterialCatalogItem): MaterialDraft {
  return {
    name: material.name,
    category: material.category || '',
    defaultFinish: material.defaultFinish || '',
    unit: material.unit,
    unitCost: String(material.unitCost),
    supplier: material.supplier || '',
    active: material.active,
  }
}

function sortRules(items: QuotePriceRule[]) {
  return [...items].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, 'pt-BR'))
}

function sortMaterials(items: MaterialCatalogItem[]) {
  return [...items].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'))
}

export function PricingMaterialsSettings({
  initialPriceRules,
  initialMaterials,
}: {
  initialPriceRules: QuotePriceRule[]
  initialMaterials: MaterialCatalogItem[]
}) {
  const [rules, setRules] = useState(() => sortRules(initialPriceRules))
  const [materials, setMaterials] = useState(() => sortMaterials(initialMaterials))
  const [priceRuleDraft, setPriceRuleDraft] = useState<PriceRuleDraft>(defaultPriceRule)
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(defaultMaterial)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
  const [saving, setSaving] = useState<'rule' | 'material' | null>(null)
  const [error, setError] = useState('')

  const activeRuleCount = useMemo(() => rules.filter((rule) => rule.active !== false).length, [rules])
  const activeMaterialCount = useMemo(() => materials.filter((material) => material.active).length, [materials])

  const saveRule = async () => {
    setSaving('rule')
    setError('')
    const response = await fetch(editingRuleId ? `/api/settings/price-rules/${editingRuleId}` : '/api/settings/price-rules', {
      method: editingRuleId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...priceRuleDraft,
        pricePerM2: Number(priceRuleDraft.pricePerM2),
        materialCostPerM2: priceRuleDraft.materialCostPerM2 === '' ? null : Number(priceRuleDraft.materialCostPerM2),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(null)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível salvar a regra.')
      return
    }
    setRules((current) => sortRules(editingRuleId
      ? current.map((rule) => rule.id === data.id ? data : rule)
      : [...current, data]
    ))
    setEditingRuleId(null)
    setPriceRuleDraft(defaultPriceRule())
  }

  const saveMaterial = async () => {
    setSaving('material')
    setError('')
    const response = await fetch(editingMaterialId ? `/api/settings/materials/${editingMaterialId}` : '/api/settings/materials', {
      method: editingMaterialId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...materialDraft, unitCost: Number(materialDraft.unitCost || 0) }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(null)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível salvar o material.')
      return
    }
    setMaterials((current) => sortMaterials(editingMaterialId
      ? current.map((material) => material.id === data.id ? data : material)
      : [...current, data]
    ))
    setEditingMaterialId(null)
    setMaterialDraft(defaultMaterial())
  }

  const toggleRule = async (rule: QuotePriceRule) => {
    if (!rule.id) return
    const response = await fetch(`/api/settings/price-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ruleToDraft(rule), active: rule.active === false }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar a regra.')
    setRules((current) => sortRules(current.map((item) => item.id === data.id ? data : item)))
  }

  const toggleMaterial = async (material: MaterialCatalogItem) => {
    const response = await fetch(`/api/settings/materials/${material.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...materialToDraft(material), active: !material.active, unitCost: material.unitCost }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar o material.')
    setMaterials((current) => sortMaterials(current.map((item) => item.id === data.id ? data : item)))
  }

  const deleteRule = async (rule: QuotePriceRule) => {
    if (!rule.id || !window.confirm(`Excluir a regra "${rule.name}"?`)) return
    const response = await fetch(`/api/settings/price-rules/${rule.id}`, { method: 'DELETE' })
    if (!response.ok) return setError('Não foi possível excluir a regra.')
    setRules((current) => current.filter((item) => item.id !== rule.id))
  }

  const deleteMaterial = async (material: MaterialCatalogItem) => {
    if (!window.confirm(`Excluir o material "${material.name}"?`)) return
    const response = await fetch(`/api/settings/materials/${material.id}`, { method: 'DELETE' })
    if (!response.ok) return setError('Não foi possível excluir este material.')
    setMaterials((current) => current.filter((item) => item.id !== material.id))
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Tabela de preços</h2>
              <p className="mt-1 text-xs text-[#777]">{activeRuleCount} regra{activeRuleCount !== 1 ? 's' : ''} ativa{activeRuleCount !== 1 ? 's' : ''}</p>
            </div>
            {editingRuleId ? (
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingRuleId(null); setPriceRuleDraft(defaultPriceRule()) }}>
                <X size={14} /> Cancelar edição
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Nome da regra" value={priceRuleDraft.name} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Cozinha premium" />
            <Select label="Ambiente" value={priceRuleDraft.environment} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, environment: event.target.value }))} placeholder="Todos" options={QUOTE_ENVIRONMENT_OPTIONS.map((value) => ({ value, label: value }))} />
            <Input label="Tipo de móvel" value={priceRuleDraft.furnitureType} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, furnitureType: event.target.value }))} placeholder="Ex.: Guarda-roupa" />
            <Input label="Modelo" value={priceRuleDraft.furnitureModel} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, furnitureModel: event.target.value }))} placeholder="Ex.: Painel ripado" />
            <Select label="Padrão" value={priceRuleDraft.priceProfile} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, priceProfile: event.target.value }))} placeholder="Todos" options={QUOTE_PRICE_PROFILES.map((value) => ({ value, label: QUOTE_PRICE_PROFILE_LABELS[value] }))} />
            <Select label="Cálculo" value={priceRuleDraft.calculationMode} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, calculationMode: event.target.value as QuoteCalculationMode }))} options={Object.entries(QUOTE_CALCULATION_MODE_LABELS).map(([value, label]) => ({ value, label }))} />
            <Input label="Preço de venda" inputMode="decimal" value={priceRuleDraft.pricePerM2} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, pricePerM2: event.target.value }))} placeholder="R$ 0,00" />
            <Input label="Custo por m²" inputMode="decimal" value={priceRuleDraft.materialCostPerM2} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, materialCostPerM2: event.target.value }))} placeholder="Opcional" />
            <Input label="Válida a partir de" type="date" value={priceRuleDraft.validFrom} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, validFrom: event.target.value }))} />
            <Input label="Válida até" type="date" value={priceRuleDraft.validUntil} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, validUntil: event.target.value }))} />
            <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212]">
              <input type="checkbox" checked={priceRuleDraft.active} onChange={(event) => setPriceRuleDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-[#FF6B00]" />
              Regra ativa
            </label>
            <Button type="button" loading={saving === 'rule'} onClick={saveRule} className="self-end">
              {editingRuleId ? <Save size={14} /> : <Plus size={14} />}
              {editingRuleId ? 'Salvar regra' : 'Adicionar regra'}
            </Button>
          </div>

          <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
            {rules.map((rule) => (
              <div key={rule.id || rule.name} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[#121212]">{rule.name}</p>
                  <p className="mt-1 text-xs text-[#777]">{[rule.environment, rule.furnitureType, rule.furnitureModel, rule.priceProfile && QUOTE_PRICE_PROFILE_LABELS[rule.priceProfile as QuotePriceProfile]].filter(Boolean).join(' · ') || 'Todos os móveis'}</p>
                  <p className="mt-1 text-xs text-[#9E9E9E]">{QUOTE_CALCULATION_MODE_LABELS[rule.calculationMode]} · Custo {rule.materialCostPerM2 === null || rule.materialCostPerM2 === undefined ? 'do material' : formatCurrency(rule.materialCostPerM2)}</p>
                </div>
                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <p className="font-bold text-[#121212]">{formatCurrency(rule.pricePerM2)}</p>
                  <button type="button" title={rule.active === false ? 'Ativar regra' : 'Desativar regra'} onClick={() => void toggleRule(rule)} className={rule.active === false ? 'text-[#9E9E9E]' : 'text-emerald-600'}><Power size={16} /></button>
                  <button type="button" title="Editar regra" onClick={() => { setEditingRuleId(rule.id || null); setPriceRuleDraft(ruleToDraft(rule)); setError('') }} className="text-[#555] hover:text-[#121212]"><Pencil size={16} /></button>
                  <button type="button" title="Excluir regra" onClick={() => void deleteRule(rule)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Materiais</h2>
              <p className="mt-1 text-xs text-[#777]">{activeMaterialCount} {activeMaterialCount === 1 ? 'material ativo' : 'materiais ativos'}</p>
            </div>
            {editingMaterialId ? (
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingMaterialId(null); setMaterialDraft(defaultMaterial()) }}>
                <X size={14} /> Cancelar edição
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Material" value={materialDraft.name} onChange={(event) => setMaterialDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: MDF Ultra" />
            <Input label="Categoria" value={materialDraft.category} onChange={(event) => setMaterialDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Painel" />
            <Input label="Acabamento padrão" value={materialDraft.defaultFinish} onChange={(event) => setMaterialDraft((current) => ({ ...current, defaultFinish: event.target.value }))} placeholder="Ex.: Branco TX" />
            <Select label="Unidade" value={materialDraft.unit} onChange={(event) => setMaterialDraft((current) => ({ ...current, unit: event.target.value }))} options={[{ value: 'm2', label: 'm²' }, { value: 'metro', label: 'metro' }, { value: 'unidade', label: 'unidade' }]} />
            <Input label="Custo unitário" inputMode="decimal" value={materialDraft.unitCost} onChange={(event) => setMaterialDraft((current) => ({ ...current, unitCost: event.target.value }))} placeholder="R$ 0,00" />
            <Input label="Fornecedor" value={materialDraft.supplier} onChange={(event) => setMaterialDraft((current) => ({ ...current, supplier: event.target.value }))} placeholder="Opcional" />
            <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212]">
              <input type="checkbox" checked={materialDraft.active} onChange={(event) => setMaterialDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-[#FF6B00]" />
              Material ativo
            </label>
            <Button type="button" loading={saving === 'material'} onClick={saveMaterial} className="self-end">
              {editingMaterialId ? <Save size={14} /> : <Plus size={14} />}
              {editingMaterialId ? 'Salvar material' : 'Adicionar material'}
            </Button>
          </div>

          <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
            {materials.map((material) => (
              <div key={material.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[#121212]">{material.name}</p>
                  <p className="mt-1 text-xs text-[#777]">{[material.category, material.defaultFinish, material.supplier].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}</p>
                </div>
                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <p className="font-bold text-[#121212]">{formatCurrency(material.unitCost)}/{material.unit === 'm2' ? 'm²' : material.unit}</p>
                  <button type="button" title={material.active ? 'Desativar material' : 'Ativar material'} onClick={() => void toggleMaterial(material)} className={material.active ? 'text-emerald-600' : 'text-[#9E9E9E]'}><Power size={16} /></button>
                  <button type="button" title="Editar material" onClick={() => { setEditingMaterialId(material.id); setMaterialDraft(materialToDraft(material)); setError('') }} className="text-[#555] hover:text-[#121212]"><Pencil size={16} /></button>
                  <button type="button" title="Excluir material" onClick={() => void deleteMaterial(material)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
