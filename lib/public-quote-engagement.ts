export function trackPublicQuotePdf(token: string) {
  void fetch(`/api/public/quote-approvals/${token}/engagement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'PDF_OPENED' }),
    keepalive: true,
  }).catch(() => undefined)
}
