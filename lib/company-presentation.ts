import type { CompanyPresentationImage } from '@prisma/client'
import type { CompanyPresentationMediaKind } from '@/lib/company-presentation-images'

export const COMPANY_PRESENTATION_ENVIRONMENTS = [
  'Todos os ambientes',
  'Cozinha',
  'Dormitório',
  'Closet',
  'Banheiro',
  'Sala',
  'Lavanderia',
  'Escritório',
  'Área gourmet',
  'Hall',
] as const

export type CompanyPresentationImageData = Omit<CompanyPresentationImage, 'createdAt' | 'updatedAt' | 'securityCheckedAt' | 'url'> & {
  securityCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

function normalizeEnvironment(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isGeneralEnvironment(value: string) {
  return normalizeEnvironment(value) === 'todos os ambientes'
}

export function isPresentationMediaKind(value: string): value is CompanyPresentationMediaKind {
  return ['PORTFOLIO', 'BEFORE', 'AFTER', 'VIDEO'].includes(value)
}

function matchesEnvironment(imageEnvironment: string, quoteEnvironment: string) {
  const imageValue = normalizeEnvironment(imageEnvironment)
  const quoteValue = normalizeEnvironment(quoteEnvironment)
  if (!imageValue || !quoteValue || isGeneralEnvironment(imageEnvironment)) return false
  return imageValue === quoteValue || imageValue.includes(quoteValue) || quoteValue.includes(imageValue)
}

export function selectCompanyPresentationImages<T extends { environmentName: string; position: number; createdAt: Date | string }>(
  images: T[],
  quoteEnvironments: string[],
  limit = 4,
) {
  const eligible = images.filter((image) => quoteEnvironments.some((environment) => matchesEnvironment(image.environmentName, environment)))
  const general = images.filter((image) => isGeneralEnvironment(image.environmentName))
  const remaining = images.filter((image) => !eligible.includes(image) && !general.includes(image))
  const byPosition = (left: T, right: T) => left.position - right.position
    || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()

  return [...eligible.sort(byPosition), ...general.sort(byPosition), ...remaining.sort(byPosition)].slice(0, limit)
}

export function selectCompanyPresentationMedia<T extends {
  environmentName: string
  mediaKind: string
  position: number
  createdAt: Date | string
}>(images: T[], quoteEnvironments: string[], mediaKind: CompanyPresentationMediaKind, limit = 4) {
  return selectCompanyPresentationImages(
    images.filter((image) => image.mediaKind === mediaKind),
    quoteEnvironments,
    limit,
  )
}

export function buildBeforeAfterPairs<T extends {
  environmentName: string
  mediaKind: string
  pairKey: string | null
  position: number
  createdAt: Date | string
}>(images: T[], quoteEnvironments: string[], limit = 3) {
  const relevant = [
    ...selectCompanyPresentationImages(
      images.filter((image) => image.mediaKind === 'BEFORE' || image.mediaKind === 'AFTER'),
      quoteEnvironments,
      images.length,
    ),
  ]
  const pairs = new Map<string, { before?: T; after?: T }>()
  for (const image of relevant) {
    const key = image.pairKey?.trim()
    if (!key) continue
    const pair = pairs.get(key) || {}
    if (image.mediaKind === 'BEFORE' && !pair.before) pair.before = image
    if (image.mediaKind === 'AFTER' && !pair.after) pair.after = image
    pairs.set(key, pair)
  }
  return [...pairs.entries()]
    .filter((entry): entry is [string, { before: T; after: T }] => Boolean(entry[1].before && entry[1].after))
    .slice(0, limit)
    .map(([title, pair]) => ({ title, before: pair.before, after: pair.after }))
}

export function serializeCompanyPresentationImage(image: CompanyPresentationImage): CompanyPresentationImageData {
  return {
    id: image.id,
    companyId: image.companyId,
    environmentName: image.environmentName,
    name: image.name,
    caption: image.caption,
    mediaKind: image.mediaKind,
    pairKey: image.pairKey,
    type: image.type,
    size: image.size,
    active: image.active,
    securityStatus: image.securityStatus,
    securityDetails: image.securityDetails,
    securityCheckedAt: image.securityCheckedAt?.toISOString() || null,
    position: image.position,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }
}
