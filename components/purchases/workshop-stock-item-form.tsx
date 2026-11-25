'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import {
  isCountedStockUnit,
  workshopStockUnitLabel,
  workshopStockUnits,
  type WorkshopStockItemInput,
  type WorkshopStockItemView,
  type WorkshopStockUnit,
} from '@/lib/workshop-stock'
import { workshopStockPresets, type WorkshopStockPreset } from '@/lib/workshop-stock-presets'
import { parseWorkshopStockQuantity, workshopStockInputNumber } from './workshop-stock-form-quantity'

type ItemType = WorkshopStockItemInput['itemType']

const itemTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'OTHER', label: 'Outro material' },
  { value: 'HARDWARE', label: 'Ferragem' },
  { value: 'MDF_SHEET', label: 'Chapa de MDF' },
  { value: 'MDF_OFFCUT', label: 'Retalho de MDF' },
]

const unitOptions = workshopStockUnits.map((unit) => ({
  value: unit,
  label: unit === 'm2' ? 'Metro quadrado (m²)' : workshopStockUnitLabel(unit),
}))

const hardwarePresets = workshopStockPresets.filter((preset) => preset.itemType === 'HARDWARE')
const hardwareOptions = hardwarePresets.map(({ name }) => ({ value: name, label: name }))

function mdfUnit(itemType: ItemType): WorkshopStockUnit | undefined {
  if (itemType === 'MDF_SHEET') return 'chapa'
  if (itemType === 'MDF_OFFCUT') return 'unidade'
}

function initialDraft(item?: WorkshopStockItemView, preset?: WorkshopStockPreset) {
  const material = item ?? preset
  return {
    name: material?.name ?? '',
    category: material?.category ?? '',
    itemType: material?.itemType ?? 'OTHER' as ItemType,
    unit: material?.unit ?? 'unidade' as WorkshopStockUnit,
    code: item?.code ?? '',
    brand: item?.brand ?? '',
    location: item?.location ?? '',
    finish: item?.finish ?? '',
    minimumStock: workshopStockInputNumber(item?.minimumStock),
    unitsPerPackage: workshopStockInputNumber(item?.unitsPerPackage),
    thicknessMm: workshopStockInputNumber(item?.thicknessMm),
    lengthMm: workshopStockInputNumber(item?.lengthMm),
    widthMm: workshopStockInputNumber(item?.widthMm),
  }
}

type ItemDraft = ReturnType<typeof initialDraft>

export function WorkshopStockItemForm({
  item,
  preset,
  busy,
  onSubmit,
  onCancel,
}: {
  item?: WorkshopStockItemView
  preset?: WorkshopStockPreset
  busy: boolean
  onSubmit: (input: WorkshopStockItemInput) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => initialDraft(item, preset))
  const [hardwareType, setHardwareType] = useState(preset?.itemType === 'HARDWARE' ? preset.name : '')
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const isMdf = Boolean(mdfUnit(draft.itemType))
  const isOffcut = draft.itemType === 'MDF_OFFCUT'
  const availableTypes = itemTypeOptions.filter(({ value }) => (
    !item || value === item.itemType || !mdfUnit(value) || item.unit === mdfUnit(value)
  ))

  useEffect(() => {
    if (preset) nameInput.current?.focus()
  }, [preset])

  function updateField<Key extends keyof ItemDraft>(key: Key, value: ItemDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function chooseHardware(value: string) {
    setHardwareType(value)
    const hardware = hardwarePresets.find(({ name }) => name === value)
    if (!hardware) return
    setDraft((current) => ({ ...current, ...hardware }))
    setError('')
  }

  function changeItemType(itemType: ItemType) {
    setHardwareType('')
    setDraft((current) => {
      const suggestedCategory = mdfUnit(itemType) ? 'MDF' : itemType === 'HARDWARE' ? 'Ferragens' : ''
      const hasCustomCategory = current.category && !['MDF', 'Ferragens'].includes(current.category)
      return {
        ...current,
        itemType,
        category: hasCustomCategory ? current.category : suggestedCategory,
        unit: item?.unit ?? mdfUnit(itemType) ?? (mdfUnit(current.itemType) ? 'unidade' : current.unit),
      }
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const name = draft.name.trim()
    const minimumStock = parseWorkshopStockQuantity(draft.minimumStock)
    const unitsPerPackage = parseWorkshopStockQuantity(draft.unitsPerPackage)
    const thicknessMm = isMdf ? parseWorkshopStockQuantity(draft.thicknessMm) : null
    const lengthMm = isMdf ? parseWorkshopStockQuantity(draft.lengthMm) : null
    const widthMm = isMdf ? parseWorkshopStockQuantity(draft.widthMm) : null

    if (name.length < 2) return setError('Informe um nome para o material.')
    if (draft.minimumStock.trim() && minimumStock === null) return setError('Informe um estoque mínimo válido.')
    if (draft.unitsPerPackage.trim() && !unitsPerPackage) return setError('Informe um conteúdo por caixa maior que zero.')
    if (isCountedStockUnit(draft.unit) && [minimumStock, unitsPerPackage].some((value) => value !== null && !Number.isInteger(value))) {
      return setError('Use números inteiros para estoque mínimo e conteúdo por caixa desta unidade.')
    }
    if (isMdf) {
      if (draft.thicknessMm.trim() && !thicknessMm) return setError('Informe uma espessura maior que zero.')
      if (draft.lengthMm.trim() && (!lengthMm || !Number.isInteger(lengthMm))) return setError('Informe o comprimento em milímetros inteiros.')
      if (draft.widthMm.trim() && (!widthMm || !Number.isInteger(widthMm))) return setError('Informe a largura em milímetros inteiros.')
      if (isOffcut && (!thicknessMm || !lengthMm || !widthMm)) return setError('Informe a espessura, o comprimento e a largura do retalho.')
    }

    onSubmit({
      name,
      itemType: draft.itemType,
      unit: draft.unit,
      category: draft.category.trim() || null,
      code: draft.code.trim() || null,
      brand: draft.brand.trim() || null,
      location: draft.location.trim() || null,
      finish: isMdf ? draft.finish.trim() || null : null,
      minimumStock,
      unitsPerPackage,
      thicknessMm,
      lengthMm,
      widthMm,
    })
  }

  return (
    <form aria-label={item ? 'Editar material' : 'Novo material'} onSubmit={submit} className="space-y-5">
      {!item && (
        <Select label="Biblioteca de ferragens" placeholder="Escolha um tipo de ferragem" value={hardwareType} onChange={(event) => chooseHardware(event.target.value)} options={hardwareOptions} disabled={busy} />
      )}
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Input ref={nameInput} label="Nome do material" value={draft.name} onChange={(event) => updateField('name', event.target.value)} maxLength={120} placeholder="Ex.: Corrediça invisível 450 mm" required />
        <Select label="Tipo de material" value={draft.itemType} onChange={(event) => changeItemType(event.target.value as ItemType)} options={availableTypes} />
        <Input label="Categoria (opcional)" value={draft.category} onChange={(event) => updateField('category', event.target.value)} maxLength={80} placeholder="Ex.: Ferragens" />
        <Select label="Unidade" value={draft.unit} onChange={(event) => updateField('unit', event.target.value as WorkshopStockUnit)} options={unitOptions} disabled={Boolean(item) || isMdf} />
        <Input label="Código interno" value={draft.code} onChange={(event) => updateField('code', event.target.value)} maxLength={80} />
        <Input label="Marca" value={draft.brand} onChange={(event) => updateField('brand', event.target.value)} maxLength={120} />
      </fieldset>
      {isMdf && (
        <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-[#121212]">Medidas e acabamento</legend>
          <Input label="Padrão ou acabamento" value={draft.finish} onChange={(event) => updateField('finish', event.target.value)} maxLength={120} placeholder="Ex.: Branco TX" />
          <Input label="Espessura (mm)" value={draft.thicknessMm} inputMode="decimal" onChange={(event) => updateField('thicknessMm', event.target.value)} required={isOffcut} />
          <Input label="Comprimento (mm)" value={draft.lengthMm} inputMode="numeric" onChange={(event) => updateField('lengthMm', event.target.value)} required={isOffcut} />
          <Input label="Largura (mm)" value={draft.widthMm} inputMode="numeric" onChange={(event) => updateField('widthMm', event.target.value)} required={isOffcut} />
        </fieldset>
      )}
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-[#121212]">Local e reposição</legend>
        <Input label="Localização" value={draft.location} onChange={(event) => updateField('location', event.target.value)} maxLength={120} placeholder="Ex.: Gaveta B3" />
        <Input label="Estoque mínimo" value={draft.minimumStock} inputMode={isCountedStockUnit(draft.unit) ? 'numeric' : 'decimal'} onChange={(event) => updateField('minimumStock', event.target.value)} />
        <Input label="Conteúdo por caixa" value={draft.unitsPerPackage} inputMode={isCountedStockUnit(draft.unit) ? 'numeric' : 'decimal'} onChange={(event) => updateField('unitsPerPackage', event.target.value)} helperText={`Quantidade em ${workshopStockUnitLabel(draft.unit)} por caixa.`} />
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-10" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="min-h-10" loading={busy}>{item ? 'Salvar material' : 'Cadastrar material'}</Button>
      </div>
    </form>
  )
}
