'use client'

import dynamic from 'next/dynamic'
import { ChevronDown, MapPinned, RefreshCw, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ClientMapPanelClient = {
  id: string
  name: string
  address: string | null
  latitude?: number | null
  longitude?: number | null
  projectsCount: number
}

type ClientMapMeta = {
  scope: 'active' | 'all'
  query: string
  total: number
  returned: number
  limit: number
  truncated: boolean
}

const LazyClientMap = dynamic(() => import('@/components/dashboard/client-map').then((mod) => mod.ClientMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] text-sm text-[#9E9E9E]">
      Carregando mapa...
    </div>
  ),
})

export function ClientMapPanel() {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientMapPanelClient[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const [query, setQuery] = useState('')
  const [meta, setMeta] = useState<ClientMapMeta | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const clientsWithAddress = clients.filter((client) => client.address).length

  const loadMapClients = useCallback(async () => {
    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({ scope, limit: '200' })
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/clients/map?${params.toString()}`, { signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar o mapa.')
      setClients(Array.isArray(payload.clients) ? payload.clients : [])
      setMeta(payload.meta || null)
      setLoaded(true)
    } catch (requestError) {
      if ((requestError as { name?: string })?.name !== 'AbortError') {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o mapa.')
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }, [query, scope])

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void loadMapClients()
    }, query ? 350 : 0)
    return () => window.clearTimeout(timer)
  }, [loadMapClients, open, query])

  const toggleMap = () => {
    setOpen((current) => !current)
  }

  const summary = loaded
    ? `${clientsWithAddress} de ${meta?.total ?? clients.length} cliente${(meta?.total ?? clients.length) !== 1 ? 's' : ''} com endereço para calcular distância.`
    : 'Os clientes e as ruas serão carregados somente quando você abrir o mapa.'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#FF6B00]">
            <MapPinned size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#121212]">Mapa carregado sob demanda</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">{summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaded && (
            <div className="hidden items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] sm:flex">
              <Users size={13} />
              {clients.length} clientes
            </div>
          )}
          <Button type="button" variant={open ? 'secondary' : 'primary'} onClick={toggleMap}>
            <MapPinned size={15} />
            {open ? 'Ocultar mapa' : 'Ver mapa'}
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#E8E8E8] bg-white p-3 sm:flex-row sm:items-center">
          <div className="inline-flex h-10 shrink-0 rounded-lg border border-[#D9D9D9] bg-[#F7F7F7] p-1">
            <button
              type="button"
              onClick={() => setScope('active')}
              aria-pressed={scope === 'active'}
              className={cn(
                'min-w-28 rounded-md px-3 text-xs font-semibold transition-colors',
                scope === 'active' ? 'bg-white text-[#121212] shadow-sm' : 'text-[#777] hover:text-[#121212]'
              )}
            >
              Em andamento
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              aria-pressed={scope === 'all'}
              className={cn(
                'min-w-20 rounded-md px-3 text-xs font-semibold transition-colors',
                scope === 'all' ? 'bg-white text-[#121212] shadow-sm' : 'text-[#777] hover:text-[#121212]'
              )}
            >
              Todos
            </button>
          </div>
          <label className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente, rua, bairro ou CEP"
              aria-label="Buscar clientes no mapa"
              className="h-10 w-full rounded-lg border border-[#D9D9D9] bg-white pl-9 pr-3 text-sm text-[#121212] outline-none focus:border-[#FF6B00]"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 px-3"
            onClick={() => void loadMapClients()}
            loading={loading}
            title="Atualizar clientes do mapa"
            aria-label="Atualizar clientes do mapa"
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      )}
      {open && loading && !loaded && (
        <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] text-sm text-[#9E9E9E]">
          Carregando clientes do mapa...
        </div>
      )}
      {open && error && (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void loadMapClients()
            }}
          >
            <RefreshCw size={14} />
            Tentar novamente
          </Button>
        </div>
      )}
      {open && loaded && meta?.truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Mostrando {meta.returned} de {meta.total} clientes. Refine a busca para localizar os demais.
        </div>
      )}
      {open && loaded && <LazyClientMap clients={clients} />}
    </div>
  )
}
