const COMPANY_PRESENTATION_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

export const COMPANY_PRESENTATION_VIDEO_ACCEPT = COMPANY_PRESENTATION_VIDEO_TYPES.join(',')
export const COMPANY_PRESENTATION_VIDEO_MAX_SIZE = 300 * 1024 * 1024
export const COMPANY_PRESENTATION_POSTER_MAX_SIZE = 3 * 1024 * 1024
export const COMPANY_PRESENTATION_MEDIA_PREFIX = 'company/presentation/'
export const COMPANY_PRESENTATION_POSTER_PREFIX = `${COMPANY_PRESENTATION_MEDIA_PREFIX}posters/`
export const COMPANY_PRESENTATION_POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function presentationVideoContentType(name: string, reportedType: string) {
  const normalizedType = reportedType.trim().toLowerCase()
  if (normalizedType) return normalizedType
  if (/\.mp4$/i.test(name)) return 'video/mp4'
  if (/\.webm$/i.test(name)) return 'video/webm'
  return normalizedType
}

export function isCompanyPresentationVideoType(value: string) {
  return COMPANY_PRESENTATION_VIDEO_TYPES.includes(
    value.toLowerCase() as (typeof COMPANY_PRESENTATION_VIDEO_TYPES)[number],
  )
}

export function isCompanyPresentationPosterType(value: string) {
  return COMPANY_PRESENTATION_POSTER_TYPES.includes(
    value.toLowerCase() as (typeof COMPANY_PRESENTATION_POSTER_TYPES)[number],
  )
}

export function isCompanyPresentationBlobUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.blob.vercel-storage.com')
      && parsed.pathname.startsWith(`/${COMPANY_PRESENTATION_MEDIA_PREFIX}`)
  } catch {
    return false
  }
}

export const COMPANY_PRESENTATION_VIDEO_TYPES_LIST = [...COMPANY_PRESENTATION_VIDEO_TYPES]
