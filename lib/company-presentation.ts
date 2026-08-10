import type { CompanyPresentationImage } from '@prisma/client'

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

export function serializeCompanyPresentationImage(image: CompanyPresentationImage): CompanyPresentationImageData {
  return {
    id: image.id,
    companyId: image.companyId,
    environmentName: image.environmentName,
    name: image.name,
    caption: image.caption,
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
