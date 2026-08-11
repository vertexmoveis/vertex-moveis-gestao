'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

type ClientEvent = {
  type: 'CLIENT_ERROR' | 'PERFORMANCE_WARNING'
  message: string
  path: string
  metric?: { name: string; value: number; rating?: string }
}

function report(event: ClientEvent) {
  void fetch('/api/client-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined)
}

export function ClientMonitor() {
  const pathname = usePathname()
  const reported = useRef(new Set<string>())

  useReportWebVitals((metric) => {
    const poor = (metric.name === 'LCP' && metric.value > 4000)
      || (metric.name === 'INP' && metric.value > 500)
      || (metric.name === 'CLS' && metric.value > 0.25)
    if (!poor) return
    const key = `${pathname}:${metric.name}`
    if (reported.current.has(key)) return
    reported.current.add(key)
    report({
      type: 'PERFORMANCE_WARNING',
      message: `${metric.name} acima do recomendado`,
      path: pathname,
      metric: { name: metric.name, value: metric.value, rating: metric.rating },
    })
  })

  useEffect(() => {
    const sendError = (message: string) => {
      const normalized = message.trim().slice(0, 500)
      if (!normalized || normalized === 'Script error.') return
      const key = `${pathname}:${normalized}`
      if (reported.current.has(key)) return
      reported.current.add(key)
      report({ type: 'CLIENT_ERROR', message: normalized, path: pathname })
    }
    const onError = (event: ErrorEvent) => sendError(event.message || event.error?.message || 'Erro inesperado no navegador')
    const onRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AbortError') return
      sendError(event.reason instanceof Error ? event.reason.message : String(event.reason || 'Falha inesperada no navegador'))
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [pathname])

  return null
}
