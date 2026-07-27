'use client'

import { useEffect, useRef } from 'react'
import type * as Leaflet from 'leaflet'

type Coordinates = {
  lat: number
  lon: number
}

type MapClient = {
  id: string
  name: string
  address: string | null
  projectsCount: number
  coordinates: Coordinates | null
  distanceKm: number | null
  status: 'ready' | 'missing-address' | 'not-found' | 'loading'
}

type InteractiveClientMapProps = {
  vertexAddress: string
  vertexLocation: Coordinates
  clients: MapClient[]
  routeHref: (client: MapClient) => string
}

function formatDistance(value: number | null) {
  if (value === null) return 'Sem km'
  if (value < 1) return `${Math.round(value * 1000)} m`
  return `${value.toFixed(value < 10 ? 1 : 0)} km`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] || character)
}

export function InteractiveClientMap({
  vertexAddress,
  vertexLocation,
  clients,
  routeHref,
}: InteractiveClientMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const dataLayerRef = useRef<Leaflet.LayerGroup | null>(null)

  useEffect(() => {
    let disposed = false
    let resizeFrame = 0
    let resizeTimer: number | null = null

    async function renderMap() {
      const L = await import('leaflet')
      await import('leaflet.markercluster')

      if (disposed || !containerRef.current) return

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [vertexLocation.lat, vertexLocation.lon],
          zoom: 13,
          zoomControl: true,
          scrollWheelZoom: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current)
      }

      const map = mapRef.current
      if (dataLayerRef.current) map.removeLayer(dataLayerRef.current)
      const dataLayer = L.layerGroup().addTo(map)
      dataLayerRef.current = dataLayer

      const vertexIcon = L.divIcon({
        className: 'vertex-map-marker',
        html: '<div class="vertex-map-marker__pin vertex-map-marker__pin--origin">V</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      })

      L.marker([vertexLocation.lat, vertexLocation.lon], { icon: vertexIcon })
        .bindPopup(`<strong>Vertex Móveis</strong><br>${escapeHtml(vertexAddress)}`)
        .addTo(dataLayer)

      const bounds = L.latLngBounds([[vertexLocation.lat, vertexLocation.lon]])
      const markerCluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 46,
        iconCreateFunction: (cluster) => L.divIcon({
          className: 'vertex-map-cluster',
          html: `<div class="vertex-map-cluster__pin">${cluster.getChildCount()}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      })
      markerCluster.addTo(dataLayer)

      clients.forEach((client, index) => {
        if (!client.coordinates) return

        const clientLatLng: [number, number] = [client.coordinates.lat, client.coordinates.lon]
        const markerIcon = L.divIcon({
          className: 'vertex-map-marker',
          html: `<div class="vertex-map-marker__pin">${index + 1}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })

        L.marker(clientLatLng, { icon: markerIcon })
          .bindPopup(
            `<strong>${escapeHtml(client.name)}</strong><br>${escapeHtml(client.address || 'Sem endereço cadastrado')}<br><span>${formatDistance(client.distanceKm)}</span><br><a href="${escapeHtml(routeHref(client))}" target="_blank" rel="noreferrer">Abrir rota</a>`
          )
          .addTo(markerCluster)

        bounds.extend(clientLatLng)
      })

      const fitMap = () => {
        map.invalidateSize()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 })
        }
      }

      fitMap()
      resizeFrame = window.requestAnimationFrame(fitMap)
      resizeTimer = window.setTimeout(fitMap, 250)
    }

    renderMap()

    return () => {
      disposed = true
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      if (resizeTimer) window.clearTimeout(resizeTimer)
    }
  }, [clients, routeHref, vertexAddress, vertexLocation])

  useEffect(() => {
    return () => {
      dataLayerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative h-full min-h-[430px] overflow-hidden rounded-lg border border-[#E8E8E8]">
      <div ref={containerRef} className="h-full min-h-[430px] w-full" />
      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg border border-[#E8E8E8] bg-white/95 px-3 py-2 shadow-sm">
        <p className="text-[11px] font-semibold uppercase text-[#9E9E9E]">Origem</p>
        <p className="max-w-[260px] truncate text-xs font-semibold text-[#121212]">{vertexAddress}</p>
      </div>
    </div>
  )
}
