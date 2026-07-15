'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, LocateFixed, MapPin, RefreshCw, Route, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { InteractiveClientMap } from '@/components/dashboard/interactive-client-map'

type ClientMapClient = {
  id: string
  name: string
  address: string | null
  latitude?: number | null
  longitude?: number | null
  projectsCount: number
}

type Coordinates = {
  lat: number
  lon: number
}

type LocatedClient = ClientMapClient & {
  coordinates: Coordinates | null
  distanceKm: number | null
  status: 'ready' | 'missing-address' | 'not-found' | 'loading'
}

const SAVED_VERTEX_LOCATION_KEY = 'vertex:dashboard-map-origin'
const DEFAULT_VERTEX_ADDRESS = process.env.NEXT_PUBLIC_VERTEX_ADDRESS || 'Rua Saturno 6, Cotia, SP, 06702-170'
const DEFAULT_VERTEX_COORDINATES = { lat: -23.5957009, lon: -46.9297487 }

function normalizeAddress(address: string) {
  return address
    .replace(/\bN[uú]mero:\s*/gi, '')
    .replace(/\bN[ºo°]?\s*(\d+)/gi, '$1')
    .replace(/\bComplemento:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDefaultVertexAddress(address: string) {
  const normalized = normalizeAddress(address).toLowerCase()
  return normalized.includes('rua saturno') && normalized.includes('cotia')
}

function distanceKm(from: Coordinates, to: Coordinates) {
  const radiusKm = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lon - from.lon)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const normalizedAddress = normalizeAddress(address)

  if (isDefaultVertexAddress(normalizedAddress)) {
    return DEFAULT_VERTEX_COORDINATES
  }

  const response = await fetch(`/api/geocode?q=${encodeURIComponent(normalizedAddress)}`)
  if (!response.ok) return null

  const data = (await response.json()) as {
    coordinates?: Coordinates | null
  }

  const lat = Number(data.coordinates?.lat)
  const lon = Number(data.coordinates?.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

async function saveClientCoordinates(clientId: string, coordinates: Coordinates) {
  await fetch(`/api/clients/${clientId}/coordinates`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coordinates),
  }).catch(() => null)
}

function formatDistance(value: number | null) {
  if (value === null) return 'Sem km'
  if (value < 1) return `${Math.round(value * 1000)} m`
  return `${value.toFixed(value < 10 ? 1 : 0)} km`
}

export function ClientMap({ clients }: { clients: ClientMapClient[] }) {
  const [vertexAddress, setVertexAddress] = useState(DEFAULT_VERTEX_ADDRESS)
  const [addressDraft, setAddressDraft] = useState(DEFAULT_VERTEX_ADDRESS)
  const [vertexLocation, setVertexLocation] = useState<Coordinates | null>(DEFAULT_VERTEX_COORDINATES)
  const [locatedClients, setLocatedClients] = useState<LocatedClient[]>(
    clients.map((client) => ({
      ...client,
      coordinates: null,
      distanceKm: null,
      status: client.address ? 'loading' : 'missing-address',
    }))
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(SAVED_VERTEX_LOCATION_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as { address?: string; coordinates?: Coordinates }
      window.setTimeout(() => {
        if (parsed.address) {
          setVertexAddress(parsed.address)
          setAddressDraft(parsed.address)
        }
        if (parsed.coordinates) setVertexLocation(parsed.coordinates)
      }, 0)
    } catch {
      window.localStorage.removeItem(SAVED_VERTEX_LOCATION_KEY)
    }
  }, [])

  useEffect(() => {
    if (vertexLocation || !vertexAddress.trim()) return

    let cancelled = false
    geocodeAddress(vertexAddress)
      .then((coordinates) => {
        if (!cancelled && coordinates) setVertexLocation(coordinates)
      })
      .catch(() => {
        if (!cancelled && isDefaultVertexAddress(vertexAddress)) setVertexLocation(DEFAULT_VERTEX_COORDINATES)
      })

    return () => {
      cancelled = true
    }
  }, [vertexAddress, vertexLocation])

  useEffect(() => {
    let cancelled = false

    async function locateClients() {
      setLoading(true)
      const results: LocatedClient[] = []

      for (const client of clients) {
        if (!client.address) {
          results.push({ ...client, coordinates: null, distanceKm: null, status: 'missing-address' })
          continue
        }

        const cachedCoordinates =
          Number.isFinite(client.latitude) && Number.isFinite(client.longitude)
            ? { lat: Number(client.latitude), lon: Number(client.longitude) }
            : null
        const coordinates = cachedCoordinates || (await geocodeAddress(client.address).catch(() => null))
        if (cancelled) return

        if (!cachedCoordinates && coordinates) {
          saveClientCoordinates(client.id, coordinates)
        }

        results.push({
          ...client,
          coordinates,
          distanceKm: vertexLocation && coordinates ? distanceKm(vertexLocation, coordinates) : null,
          status: coordinates ? 'ready' : 'not-found',
        })

        setLocatedClients([...results, ...clients.slice(results.length).map((nextClient) => ({
          ...nextClient,
          coordinates: null,
          distanceKm: null,
          status: nextClient.address ? 'loading' as const : 'missing-address' as const,
        }))])

        await new Promise((resolve) => setTimeout(resolve, 250))
      }

      setLocatedClients(results)
      setLoading(false)
    }

    locateClients()

    return () => {
      cancelled = true
    }
  }, [clients, vertexLocation])

  const readyClients = useMemo(
    () =>
      locatedClients
        .filter((client) => client.coordinates)
        .sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE)),
    [locatedClients]
  )

  const unresolvedCount = locatedClients.filter((client) => client.status === 'missing-address' || client.status === 'not-found').length

  const saveVertexAddress = async () => {
    const address = addressDraft.trim()
    if (!address) {
      setMessage('Digite o endereço da Vertex.')
      return
    }

    setMessage('Buscando endereço da Vertex...')
    const coordinates = await geocodeAddress(address)
    if (!coordinates) {
      setMessage('Não encontrei esse endereço. Tente rua, número, bairro e cidade.')
      return
    }

    window.localStorage.setItem(SAVED_VERTEX_LOCATION_KEY, JSON.stringify({ address, coordinates }))
    setVertexAddress(address)
    setVertexLocation(coordinates)
    setMessage('Endereço da Vertex salvo neste computador.')
  }

  const routeHref = useCallback((client: LocatedClient) => {
    const origin = vertexLocation ? `${vertexLocation.lat},${vertexLocation.lon}` : vertexAddress
    const destination = client.coordinates ? `${client.coordinates.lat},${client.coordinates.lon}` : client.address || client.name
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
  }, [vertexAddress, vertexLocation])

  return (
    <div className="grid grid-cols-1 gap-5 xl:h-[620px] xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-stretch">
      <InteractiveClientMap
        vertexAddress={vertexAddress}
        vertexLocation={vertexLocation || DEFAULT_VERTEX_COORDINATES}
        clients={readyClients}
        routeHref={routeHref}
      />

      <div className="flex min-h-[420px] flex-col xl:min-h-0 xl:overflow-hidden">
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={addressDraft}
            onChange={(event) => setAddressDraft(event.target.value)}
            placeholder="Endereço da Vertex"
            className="min-w-0 flex-1 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm text-[#121212] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#FF6B00]"
          />
          <Button type="button" variant="outline" className="px-3" onClick={saveVertexAddress} title="Salvar endereço da Vertex">
            <Save size={15} />
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="justify-center" onClick={saveVertexAddress}>
            <LocateFixed size={15} />
            Usar endereço
          </Button>
          <Button type="button" variant="outline" className="justify-center" onClick={() => window.location.reload()}>
            <RefreshCw size={15} />
            Atualizar
          </Button>
        </div>

        <div className="mb-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
          <p className="text-xs text-[#6B7280]">
            {readyClients.length} cliente{readyClients.length !== 1 ? 's' : ''} no mapa
            {unresolvedCount > 0 ? `, ${unresolvedCount} sem localização precisa` : ''}
            {loading ? ', atualizando...' : ''}
          </p>
          {message && <p className="mt-1 text-xs font-medium text-[#FF6B00]">{message}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#E8E8E8]">
          {locatedClients.length === 0 ? (
            <div className="p-5 text-center text-sm text-[#9E9E9E]">Nenhum cliente cadastrado.</div>
          ) : (
            <div className="divide-y divide-[#F0F0F0]">
              {locatedClients
                .slice()
                .sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE))
                .map((client, index) => (
                  <div key={client.id} className="flex items-start gap-3 p-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        client.status === 'ready' ? 'bg-[#121212] text-white' : 'bg-[#F0F0F0] text-[#9E9E9E]'
                      )}
                    >
                      {client.status === 'ready' ? index + 1 : <MapPin size={13} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#121212]">{client.name}</p>
                        <span className="flex-shrink-0 text-xs font-semibold text-[#FF6B00]">
                          {client.status === 'loading' ? '...' : formatDistance(client.distanceKm)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[#6B7280]">
                        {client.address || 'Sem endereço cadastrado'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#9E9E9E]">
                          {client.projectsCount} projeto{client.projectsCount !== 1 ? 's' : ''}
                        </span>
                        <a
                          href={routeHref(client)}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium text-[#FF6B00] hover:underline',
                            client.status !== 'ready' && 'pointer-events-none text-[#BDBDBD]'
                          )}
                        >
                          <Route size={13} />
                          Rota
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
