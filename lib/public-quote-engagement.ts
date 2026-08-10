export const PUBLIC_QUOTE_VIEW_INTERVAL_MS = 24 * 60 * 60 * 1000

export function shouldTrackPublicQuoteView(lastTrackedAt: number, now = Date.now()) {
  return !Number.isFinite(lastTrackedAt)
    || lastTrackedAt <= 0
    || now - lastTrackedAt >= PUBLIC_QUOTE_VIEW_INTERVAL_MS
}

export function trackPublicQuotePdf(token: string) {
  void fetch(`/api/public/quote-approvals/${token}/engagement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'PDF_OPENED' }),
    keepalive: true,
  }).catch(() => undefined)
}
