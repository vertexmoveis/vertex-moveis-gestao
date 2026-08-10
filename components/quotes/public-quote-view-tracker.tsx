'use client'

import { useEffect } from 'react'
import { shouldTrackPublicQuoteView } from '@/lib/public-quote-engagement'

export function PublicQuoteViewTracker({ token }: { token: string }) {
  useEffect(() => {
    const storageKey = `vertex:proposal-view:${token}`
    let lastTrackedAt = 0
    try {
      lastTrackedAt = Number(window.localStorage.getItem(storageKey) || 0)
    } catch {
      // The server also deduplicates visits when local storage is unavailable.
    }
    if (!shouldTrackPublicQuoteView(lastTrackedAt)) return

    void fetch(`/api/public/quote-approvals/${token}/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'PAGE_VIEWED' }),
      keepalive: true,
    }).then((response) => {
      if (!response.ok) return
      try {
        window.localStorage.setItem(storageKey, String(Date.now()))
      } catch {
        // Tracking still succeeded even when the browser blocks local storage.
      }
    }).catch(() => undefined)
  }, [token])

  return null
}
