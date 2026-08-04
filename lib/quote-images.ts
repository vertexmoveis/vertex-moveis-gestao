import { get } from '@vercel/blob'
import { matchesProjectFileSignature } from '@/lib/project-file-security'

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

export async function readQuoteImageDataUrl(url: string) {
  const result = await get(url, { access: 'private', useCache: true })
  if (!result || result.statusCode !== 200) return null
  if (result.blob.size > QUOTE_IMAGE_MAX_SIZE) {
    await result.stream.cancel()
    return null
  }

  const type = (result.blob.contentType || '').split(';')[0].trim().toLowerCase()
  if (!isQuoteImageType(type)) {
    await result.stream.cancel()
    return null
  }
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
  if (!matchesProjectFileSignature(type, bytes)) return null
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
}
