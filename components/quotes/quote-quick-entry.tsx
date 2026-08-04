'use client'

import { Copy, Plus, Trash2 } from 'lucide-react'
import { FurniturePicker, type RecentFurnitureSelection } from '@/components/quotes/furniture-picker'
import { Button } from '@/components/ui/button'
import { QUOTE_DIFFICULTY_LABELS, type QuoteDifficulty } from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'

export type QuoteQuickItem = {
  draftId: string
  environment: string
  environmentName: string
  furnitureType: string
  furnitureModel: string
  placement: string
  widthMm: string
  heightMm: string
  quantity: string
  difficulty: QuoteDifficulty
}

const fieldClass = 'h-10 w-full min-w-0 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'

export function QuoteQuickEntry({
  items,
  totals,
  environments,
  recentSelections,
  onEnvironmentChange,
  onEnvironmentNameChange,
  onFurnitureSelect,
  onFieldChange,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  items: QuoteQuickItem[]
  totals: number[]
  environments: string[]
  recentSelections: RecentFurnitureSelection[]
  onEnvironmentChange: (index: number, value: string) => void
  onEnvironmentNameChange: (index: number, value: string) => void
  onFurnitureSelect: (index: number, selection: { type: string; model: string }) => void
  onFieldChange: (index: number, field: 'placement' | 'widthMm' | 'heightMm' | 'quantity' | 'difficulty', value: string) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div className="overflow-hidden border border-[#DCDCDC] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#E8E8E8] bg-[#F4F4F4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#121212]">Entrada rápida</p>
          <p className="text-xs text-[#707070]">Preencha uma linha por móvel. Use Tab para avançar pelos campos.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd} disabled={items.length >= 80}>
          <Plus size={14} /> Móvel
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1320px]">
          <div className="grid grid-cols-[150px_180px_280px_180px_115px_115px_80px_140px_105px_72px] gap-2 border-b border-[#E8E8E8] bg-[#FAFAFA] px-3 py-2 text-[10px] font-bold uppercase text-[#777]">
            <span>Tipo de ambiente</span>
            <span>Nome do ambiente</span>
            <span>Móvel</span>
            <span>Posição</span>
            <span>Largura</span>
            <span>Altura</span>
            <span>Qtd.</span>
            <span>Dificuldade</span>
            <span className="text-right">Total</span>
            <span className="text-center">Ações</span>
          </div>
          <div className="divide-y divide-[#ECECEC]">
            {items.map((item, index) => (
              <div key={item.draftId} className="grid grid-cols-[150px_180px_280px_180px_115px_115px_80px_140px_105px_72px] items-center gap-2 px-3 py-3">
                <select aria-label={`Tipo do ambiente ${index + 1}`} value={item.environment} onChange={(event) => onEnvironmentChange(index, event.target.value)} className={fieldClass}>
                  {environments.map((environment) => <option key={environment} value={environment}>{environment}</option>)}
                </select>
                <input aria-label={`Nome do ambiente ${index + 1}`} value={item.environmentName} onChange={(event) => onEnvironmentNameChange(index, event.target.value)} className={fieldClass} />
                <FurniturePicker environment={item.environment} furnitureType={item.furnitureType} furnitureModel={item.furnitureModel} recentSelections={recentSelections} onSelect={(selection) => onFurnitureSelect(index, selection)} compact />
                <input aria-label={`Posição do móvel ${index + 1}`} value={item.placement} onChange={(event) => onFieldChange(index, 'placement', event.target.value)} placeholder="Parede da pia" className={fieldClass} />
                <input aria-label={`Largura do móvel ${index + 1} em milímetros`} value={item.widthMm} onChange={(event) => onFieldChange(index, 'widthMm', event.target.value)} inputMode="decimal" placeholder="700 mm" className={fieldClass} />
                <input aria-label={`Altura do móvel ${index + 1} em milímetros`} value={item.heightMm} onChange={(event) => onFieldChange(index, 'heightMm', event.target.value)} inputMode="decimal" placeholder="2600 mm" className={fieldClass} />
                <input aria-label={`Quantidade do móvel ${index + 1}`} value={item.quantity} onChange={(event) => onFieldChange(index, 'quantity', event.target.value)} inputMode="numeric" className={fieldClass} />
                <select aria-label={`Dificuldade do móvel ${index + 1}`} value={item.difficulty} onChange={(event) => onFieldChange(index, 'difficulty', event.target.value)} className={fieldClass}>
                  {Object.entries(QUOTE_DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <strong className="text-right text-sm text-[#121212]">{formatCurrency(totals[index] || 0)}</strong>
                <div className="flex justify-center gap-1">
                  <button type="button" title="Duplicar móvel" aria-label={`Duplicar móvel ${index + 1}`} onClick={() => onDuplicate(index)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555] hover:bg-[#F2F2F2]"><Copy size={15} /></button>
                  <button type="button" title="Remover móvel" aria-label={`Remover móvel ${index + 1}`} onClick={() => onRemove(index)} disabled={items.length === 1} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-25"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
