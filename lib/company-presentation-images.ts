import { QUOTE_IMAGE_MAX_SIZE, QUOTE_IMAGE_TYPES } from '@/lib/quote-images'

export const COMPANY_PRESENTATION_IMAGE_TYPES = QUOTE_IMAGE_TYPES
export const COMPANY_PRESENTATION_IMAGE_ACCEPT = COMPANY_PRESENTATION_IMAGE_TYPES.join(',')
export const COMPANY_PRESENTATION_IMAGE_MAX_SIZE = QUOTE_IMAGE_MAX_SIZE
export const COMPANY_PRESENTATION_IMAGE_PREFIX = 'company/presentation/'

export function isCompanyPresentationImageType(value: string) {
  return COMPANY_PRESENTATION_IMAGE_TYPES.includes(
    value.toLowerCase() as (typeof COMPANY_PRESENTATION_IMAGE_TYPES)[number],
  )
}

export function isCompanyPresentationImageBlobUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.blob.vercel-storage.com')
      && parsed.pathname.startsWith(`/${COMPANY_PRESENTATION_IMAGE_PREFIX}`)
  } catch {
    return false
  }
}
