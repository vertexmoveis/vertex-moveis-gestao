'use client'

import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { normalizeWorkshopStockSearch, workshopStockItemTypeLabels } from '@/lib/workshop-stock'
import { workshopStockPresets, type WorkshopStockPreset } from '@/lib/workshop-stock-presets'

const previewSize = 6

export function WorkshopStockLibrary({
  query,
  itemType,
  disabled,
  onChoose,
}: {
  query: string
  itemType: string
  disabled: boolean
  onChoose: (preset: WorkshopStockPreset) => void
}) {
  const headingId = useId()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const matches = workshopStockPresets.filter((preset) => {
    if (itemType && preset.itemType !== itemType) return false
    const description = `${preset.name} ${preset.category} ${workshopStockItemTypeLabels[preset.itemType]}`
    return !query || normalizeWorkshopStockSearch(description).includes(query)
  })
  const visible = query || expanded ? matches : matches.slice(0, previewSize)

  return (
    <section aria-labelledby={headingId} className="space-y-3 border-b border-[#E8E8E8] bg-[#FAFAFA] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="text-sm font-semibold text-[#121212]">Biblioteca de materiais</h3>
        {!query && matches.length > previewSize ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9"
            aria-controls={listId}
            aria-expanded={expanded}
            onClick={() => setExpanded((previous) => !previous)}
          >
            {expanded ? 'Mostrar menos' : 'Ver biblioteca completa'}
          </Button>
        ) : null}
      </div>
      {visible.length ? (
        <>
          <p className="text-xs text-[#555]">Escolha um modelo para preencher o cadastro.</p>
          <ul id={listId} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {visible.map((preset) => (
              <li key={preset.name} className="min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-full min-h-10 w-full justify-start whitespace-normal px-2.5 py-2 text-left leading-tight"
                  disabled={disabled}
                  onClick={() => onChoose(preset)}
                >
                  <Plus size={14} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 break-words">{preset.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-[#555]">Nenhum modelo encontrado na biblioteca.</p>
      )}
    </section>
  )
}
