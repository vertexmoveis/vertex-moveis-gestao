'use client'

import { useEffect, useState } from 'react'

export function useJsonResource<T>(url: string | null, initial: T, revision = 0) {
  const key = `${url}:${revision}`
  const [result, setResult] = useState<{ key: string; data: T; error: string } | null>(null)
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    fetch(url, { signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os dados.')
      if (!controller.signal.aborted) setResult({ key, data, error: '' })
    }).catch(failure => {
      if (!controller.signal.aborted) setResult({ key, data: initial, error: failure.message || 'Falha ao carregar.' })
    })
    return () => controller.abort()
  }, [url, key, initial])
  return { data: result?.key === key ? result.data : initial, error: result?.key === key ? result.error : '', loading: Boolean(url) && result?.key !== key }
}
