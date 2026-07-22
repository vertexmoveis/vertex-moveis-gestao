'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getQuoteFurnitureOptions,
  searchQuoteFurnitureOptions,
  type QuoteFurnitureOption,
} from '@/lib/quotes'
import { cn } from '@/lib/utils'

export type RecentFurnitureSelection = {
  environment: string
  type: string
  model: string
}

type FurniturePickerProps = {
  environment: string
  furnitureType: string
  furnitureModel: string
  recentSelections?: RecentFurnitureSelection[]
  onSelect: (selection: { type: string; model: string }) => void
}

type VisibleFurnitureOption = QuoteFurnitureOption & { groupLabel: string }

export function FurniturePicker({
  environment,
  furnitureType,
  furnitureModel,
  recentSelections = [],
  onSelect,
}: FurniturePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const allOptions = useMemo(() => getQuoteFurnitureOptions(environment), [environment])
  const visibleOptions = useMemo<VisibleFurnitureOption[]>(() => {
    const filtered = searchQuoteFurnitureOptions(environment, query)
    if (query.trim()) return filtered.map((option) => ({ ...option, groupLabel: option.type }))

    const byKey = new Map(allOptions.map((option) => [`${option.type}::${option.model}`, option]))
    const recent = recentSelections.flatMap((selection) => {
      if (selection.environment !== environment) return []
      const option = byKey.get(`${selection.type}::${selection.model}`)
      return option ? [{ ...option, groupLabel: 'Usados recentemente' }] : []
    })
    const recentIds = new Set(recent.map((option) => option.id))

    return [
      ...recent,
      ...allOptions.filter((option) => !recentIds.has(option.id)).map((option) => ({ ...option, groupLabel: option.type })),
    ]
  }, [allOptions, environment, query, recentSelections])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const choose = (option: VisibleFurnitureOption) => {
    onSelect({ type: option.type, model: option.model })
    setOpen(false)
    setQuery('')
  }

  const toggleOpen = () => {
    if (open) {
      setOpen(false)
      return
    }
    setQuery('')
    setHighlightedIndex(0)
    setOpen(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter' && visibleOptions[highlightedIndex]) {
      event.preventDefault()
      choose(visibleOptions[highlightedIndex])
    }
  }

  let previousGroup = ''

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-col gap-1.5">
      <label className="text-sm font-medium text-[#121212]">Móvel</label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-left text-sm text-[#121212] outline-none transition-colors focus:ring-2 focus:ring-[#FF6B00]"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{furnitureModel}</span>
          <span className="block truncate text-[11px] text-[#777]">{furnitureType}</span>
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-[#777] transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-[#D9D9D9] bg-white shadow-xl">
          <div className="border-b border-[#ECECEC] p-2">
            <div className="flex items-center gap-2 rounded-md border border-[#D9D9D9] px-3 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]">
              <Search size={15} className="shrink-0 text-[#777]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Buscar armário, gabinete, painel..."
                aria-label="Buscar móvel"
                role="combobox"
                aria-controls="quote-furniture-options"
                aria-expanded="true"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#121212] outline-none placeholder:text-[#999]"
              />
            </div>
          </div>

          <div id="quote-furniture-options" role="listbox" className="max-h-72 overflow-y-auto py-1">
            {visibleOptions.length ? visibleOptions.map((option, index) => {
              const showGroup = option.groupLabel !== previousGroup
              previousGroup = option.groupLabel
              const selected = option.type === furnitureType && option.model === furnitureModel
              return (
                <div key={`${option.groupLabel}-${option.id}`}>
                  {showGroup ? (
                    <div className="sticky top-0 bg-[#F7F7F7] px-3 py-1.5 text-[10px] font-bold uppercase text-[#777]">
                      {option.groupLabel}
                    </div>
                  ) : null}
                  <button
                    ref={(element) => { optionRefs.current[index] = element }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => choose(option)}
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                      highlightedIndex === index ? 'bg-[#FFF3E8]' : 'hover:bg-[#F7F7F7]',
                      selected && 'font-semibold text-[#C74F00]',
                    )}
                  >
                    <span>{option.model}</span>
                    {selected ? <Check size={15} className="shrink-0" /> : null}
                  </button>
                </div>
              )
            }) : (
              <p className="px-4 py-6 text-center text-sm text-[#777]">Nenhum móvel encontrado.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
