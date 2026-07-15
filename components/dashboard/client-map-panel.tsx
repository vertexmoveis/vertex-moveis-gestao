'use client'

import dynamic from 'next/dynamic'
import { ChevronDown, MapPinned, RefreshCw, Users } from 'lucide-react'
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
  const requestRef = useRef<AbortController | null>(null)
  const clientsWithAddress = clients.filter((client) => client.address).length

  const loadMapClients = useCallback(async () => {
    if (loaded || loading) return
    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/clients/map', { signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar o mapa.')
      setClients(Array.isArray(payload.clients) ? payload.clients : [])
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
  }, [loaded, loading])

  useEffect(() => () => requestRef.current?.abort(), [])

  const toggleMap = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void loadMapClients()
  }

  const summary = loaded
    ? `${clientsWithAddress} de ${clients.length} cliente${clients.length !== 1 ? 's' : ''} com endereço para calcular distância.`
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

      {open && loading && (
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
      {open && loaded && <LazyClientMap clients={clients} />}
    </div>
  )
}
