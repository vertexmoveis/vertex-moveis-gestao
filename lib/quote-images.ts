export const QUOTE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const QUOTE_IMAGE_ACCEPT = QUOTE_IMAGE_TYPES.join(',')
export const QUOTE_IMAGE_MAX_SIZE = 8 * 1024 * 1024

export function isQuoteImageType(value: string) {
  return QUOTE_IMAGE_TYPES.includes(value.toLowerCase() as (typeof QUOTE_IMAGE_TYPES)[number])
}

export function sanitizeQuoteImageName(value: string) {
  const safe = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^-|-$/g, '')
  return (safe || 'imagem').slice(0, 140)
}

export function isQuoteImageBlobUrl(url: string, groupId: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.blob.vercel-storage.com')
      && parsed.pathname.startsWith(`/quotes/${groupId}/`)
  } catch {
    return false
  }
}
