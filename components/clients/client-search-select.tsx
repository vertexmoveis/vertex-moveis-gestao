'use client'

import { Search, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type ClientSearchOption = { id: string; name: string }

export function ClientSearchSelect({
  value,
  onChange,
  initialOptions = [],
  label = 'Cliente',
  error,
}: {
  value: string
  onChange: (value: string) => void
  initialOptions?: ClientSearchOption[]
  label?: string
  error?: string
}) {
  const initialSelected = initialOptions.find((option) => option.id === value)
  const [query, setQuery] = useState(initialSelected?.name || '')
  const [options, setOptions] = useState(initialOptions)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = useMemo(() => options.find((option) => option.id === value), [options, value])

  useEffect(() => {
    if (!open && (!value || selected)) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams({ options: '1' })
      if (query.trim()) params.set('q', query.trim())
      if (value) params.set('selectedId', value)
      try {
        const response = await fetch(`/api/clients?${params.toString()}`, { signal: controller.signal })
        const data = await response.json().catch(() => [])
        if (response.ok && Array.isArray(data)) {
          setOptions(data)
          const selectedOption = data.find((option: ClientSearchOption) => option.id === value)
          if (selectedOption && !open) setQuery(selectedOption.name)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, selected, value])

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-[#121212]">{label}</label>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
        <input
          value={query}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current)
            setOpen(true)
          }}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
          onChange={(event) => {
            setQuery(event.target.value)
            if (value) onChange('')
            setOpen(true)
          }}
          placeholder="Digite o nome do cliente"
          autoComplete="off"
          className={`h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00] ${error ? 'border-red-400' : 'border-[#D9D9D9]'}`}
        />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {open ? (
        <div className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#D9D9D9] bg-white py-1 shadow-lg">
          {loading ? <p className="px-3 py-2 text-xs text-[#777]">Buscando...</p> : null}
          {!loading && options.length === 0 ? <p className="px-3 py-3 text-xs text-[#777]">Nenhum cliente encontrado.</p> : null}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.id)
                setQuery(option.name)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#FFF3EA] ${option.id === value ? 'bg-[#FFF3EA] font-semibold text-[#A64200]' : 'text-[#121212]'}`}
            >
              <UserRound size={14} className="shrink-0 text-[#9E9E9E]" />
              <span className="truncate">{option.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
