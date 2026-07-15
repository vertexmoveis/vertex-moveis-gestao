import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

type Coordinates = {
  lat: number
  lon: number
}

type NominatimResult = {
  lat?: string
  lon?: string
  display_name?: string
}

type PhotonFeature = {
  properties?: {
    name?: string
    street?: string
    district?: string
    city?: string
    state?: string
    country?: string
    postcode?: string
  }
  geometry?: { coordinates?: [number, number] }
}

const DEFAULT_VERTEX_COORDINATES = { lat: -23.5957009, lon: -46.9297487 }

function removeAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeAddress(address: string) {
  return address
    .replace(/\bN(ú|u)mero:\s*/gi, '')
    .replace(/\bN[ºo°]?\s*(\d+)/gi, '$1')
    .replace(/\bComplemento:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDefaultVertexAddress(address: string) {
  const normalized = removeAccents(normalizeAddress(address)).toLowerCase()
  return normalized.includes('rua saturno') && normalized.includes('cotia')
}

function hasCityOrState(address: string) {
  const normalized = removeAccents(address).toLowerCase()
  return /\b(sp|sao paulo|cotia|itapevi|barueri|osasco)\b/.test(normalized)
}

function buildQueries(address: string) {
  const normalized = normalizeAddress(address)
  const queries = new Set<string>([normalized])

  if (!hasCityOrState(normalized)) {
    queries.add(`${normalized}, Cotia, SP`)
    queries.add(`${normalized}, São Paulo, SP`)
  }

  queries.add(`${normalized}, Brasil`)
  return [...queries]
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VertexMoveisGestao/1.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function toCoordinates(lat: unknown, lon: unknown): Coordinates | null {
  const parsedLat = Number(lat)
  const parsedLon = Number(lon)

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null
  return { lat: parsedLat, lon: parsedLon }
}

function scorePhotonFeature(feature: PhotonFeature, query: string) {
  const values = [
    feature.properties?.name,
    feature.properties?.street,
    feature.properties?.district,
    feature.properties?.city,
    feature.properties?.state,
    feature.properties?.postcode,
  ]
    .filter(Boolean)
    .join(' ')
  const normalizedValues = removeAccents(values).toLowerCase()
  const normalizedQuery = removeAccents(query).toLowerCase()

  let score = 0
  for (const token of normalizedQuery.split(/[,\s]+/).filter((part) => part.length > 2)) {
    if (normalizedValues.includes(token)) score += 1
  }
  if (normalizedValues.includes('cotia')) score += 3
  if (normalizedValues.includes('sao paulo')) score += 1

  return score
}

async function geocodeWithNominatim(query: string) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
  })
  const data = await fetchJson<NominatimResult[]>(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
  const result = data?.[0]
  const coordinates = toCoordinates(result?.lat, result?.lon)

  return coordinates ? { coordinates, label: result?.display_name || query } : null
}

async function geocodeWithPhoton(query: string) {
  const params = new URLSearchParams({
    q: query,
    limit: '5',
  })
  const data = await fetchJson<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/api/?${params.toString()}`)
  const features = data?.features || []
  const best = features
    .map((feature) => ({ feature, score: scorePhotonFeature(feature, query) }))
    .sort((a, b) => b.score - a.score)[0]?.feature
  const coordinates = toCoordinates(best?.geometry?.coordinates?.[1], best?.geometry?.coordinates?.[0])

  if (!coordinates) return null

  const label = [
    best?.properties?.name || best?.properties?.street,
    best?.properties?.district,
    best?.properties?.city,
    best?.properties?.state,
  ].filter(Boolean).join(', ')

  return { coordinates, label: label || query }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:geocode:${auth.user.id}:${getClientIp(req)}`, 40, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 240)
  if (!q) return NextResponse.json({ coordinates: null })

  if (isDefaultVertexAddress(q)) {
    return NextResponse.json({
      coordinates: DEFAULT_VERTEX_COORDINATES,
      label: 'Rua Saturno, 6, Recanto Vista Alegre, Cotia, SP',
      source: 'vertex-default',
    })
  }

  for (const query of buildQueries(q)) {
    const nominatim = await geocodeWithNominatim(query)
    if (nominatim) return NextResponse.json({ ...nominatim, source: 'nominatim' })

    const photon = await geocodeWithPhoton(query)
    if (photon) return NextResponse.json({ ...photon, source: 'photon' })
  }

  return NextResponse.json({ coordinates: null })
}
