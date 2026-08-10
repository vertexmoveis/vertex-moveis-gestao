import { QUOTE_IMAGE_MAX_SIZE, QUOTE_IMAGE_TYPES } from '@/lib/quote-images'

export const COMPANY_PRESENTATION_IMAGE_TYPES = QUOTE_IMAGE_TYPES
export const COMPANY_PRESENTATION_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const
export const COMPANY_PRESENTATION_MEDIA_TYPES = [
  ...COMPANY_PRESENTATION_IMAGE_TYPES,
  ...COMPANY_PRESENTATION_VIDEO_TYPES,
] as const
export const COMPANY_PRESENTATION_IMAGE_ACCEPT = COMPANY_PRESENTATION_IMAGE_TYPES.join(',')
export const COMPANY_PRESENTATION_VIDEO_ACCEPT = COMPANY_PRESENTATION_VIDEO_TYPES.join(',')
export const COMPANY_PRESENTATION_MEDIA_ACCEPT = COMPANY_PRESENTATION_MEDIA_TYPES.join(',')
export const COMPANY_PRESENTATION_IMAGE_MAX_SIZE = QUOTE_IMAGE_MAX_SIZE
export const COMPANY_PRESENTATION_VIDEO_MAX_SIZE = 50 * 1024 * 1024
export const COMPANY_PRESENTATION_IMAGE_PREFIX = 'company/presentation/'

export const COMPANY_PRESENTATION_MEDIA_KINDS = ['PORTFOLIO', 'BEFORE', 'AFTER', 'VIDEO'] as const
export type CompanyPresentationMediaKind = (typeof COMPANY_PRESENTATION_MEDIA_KINDS)[number]

export function isCompanyPresentationImageType(value: string) {
  return COMPANY_PRESENTATION_IMAGE_TYPES.includes(
    value.toLowerCase() as (typeof COMPANY_PRESENTATION_IMAGE_TYPES)[number],
  )
}

export function isCompanyPresentationVideoType(value: string) {
  return COMPANY_PRESENTATION_VIDEO_TYPES.includes(
    value.toLowerCase() as (typeof COMPANY_PRESENTATION_VIDEO_TYPES)[number],
  )
}

export function isCompanyPresentationMediaType(value: string) {
  return isCompanyPresentationImageType(value) || isCompanyPresentationVideoType(value)
}

export function presentationMediaMaxSize(type: string) {
  return isCompanyPresentationVideoType(type)
    ? COMPANY_PRESENTATION_VIDEO_MAX_SIZE
    : COMPANY_PRESENTATION_IMAGE_MAX_SIZE
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
