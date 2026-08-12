import type { CompanyProfile } from '@prisma/client'

export const COMPANY_PROFILE_ID = 'vertex'

export const DEFAULT_COMPANY_PROFILE = {
  id: COMPANY_PROFILE_ID,
  tradeName: 'Vertex Móveis',
  legalName: 'Vertex Ferragens',
  document: '39.778.558/0001-38',
  phone: '(11) 94313-1992',
  email: 'vertexmoveis@gmail.com',
  instagram: null,
  googleReviewUrl: null,
  street: 'Rua Saturno',
  number: '6',
  complement: 'Sala 2',
  neighborhood: 'Recanto Vista Alegre',
  city: 'Cotia',
  state: 'SP',
  zipCode: '06702-170',
  defaultDeliveryBusinessDays: 30,
  quoteReminderDays: 3,
  leadNoResponseDays: 30,
  leadCloseSuggestionDays: 90,
  weeklyProductionCapacity: 4,
  presentationEnabled: true,
} as const

type LegacyPresentationField =
  | 'presentationHeading'
  | 'presentationText'
  | 'presentationHighlight1'
  | 'presentationHighlight2'
  | 'presentationHighlight3'
  | 'standardSheetWidthMm'
  | 'standardSheetHeightMm'
  | 'sheetWastePercent'

export type CompanyProfileData = Omit<CompanyProfile, 'createdAt' | 'updatedAt' | LegacyPresentationField> & {
  createdAt?: string
  updatedAt?: string
}

export function withCompanyProfileDefaults(profile?: Partial<CompanyProfile> | null): CompanyProfileData {
  return {
    id: profile?.id || DEFAULT_COMPANY_PROFILE.id,
    tradeName: profile?.tradeName || DEFAULT_COMPANY_PROFILE.tradeName,
    legalName: profile?.legalName ?? DEFAULT_COMPANY_PROFILE.legalName,
    document: profile?.document ?? DEFAULT_COMPANY_PROFILE.document,
    phone: profile?.phone ?? DEFAULT_COMPANY_PROFILE.phone,
    email: profile?.email ?? DEFAULT_COMPANY_PROFILE.email,
    instagram: profile?.instagram ?? DEFAULT_COMPANY_PROFILE.instagram,
    googleReviewUrl: profile?.googleReviewUrl ?? DEFAULT_COMPANY_PROFILE.googleReviewUrl,
    street: profile?.street ?? DEFAULT_COMPANY_PROFILE.street,
    number: profile?.number ?? DEFAULT_COMPANY_PROFILE.number,
    complement: profile?.complement ?? DEFAULT_COMPANY_PROFILE.complement,
    neighborhood: profile?.neighborhood ?? DEFAULT_COMPANY_PROFILE.neighborhood,
    city: profile?.city ?? DEFAULT_COMPANY_PROFILE.city,
    state: profile?.state ?? DEFAULT_COMPANY_PROFILE.state,
    zipCode: profile?.zipCode ?? DEFAULT_COMPANY_PROFILE.zipCode,
    defaultDeliveryBusinessDays: profile?.defaultDeliveryBusinessDays || DEFAULT_COMPANY_PROFILE.defaultDeliveryBusinessDays,
    quoteReminderDays: profile?.quoteReminderDays || DEFAULT_COMPANY_PROFILE.quoteReminderDays,
    leadNoResponseDays: profile?.leadNoResponseDays || DEFAULT_COMPANY_PROFILE.leadNoResponseDays,
    leadCloseSuggestionDays: profile?.leadCloseSuggestionDays || DEFAULT_COMPANY_PROFILE.leadCloseSuggestionDays,
    weeklyProductionCapacity: profile?.weeklyProductionCapacity || DEFAULT_COMPANY_PROFILE.weeklyProductionCapacity,
    presentationEnabled: profile?.presentationEnabled ?? DEFAULT_COMPANY_PROFILE.presentationEnabled,
  }
}

export function normalizeInstagramUrl(value?: string | null) {
  const input = value?.trim()
  if (!input) return ''

  let username = input.replace(/^@/, '')
  if (/^https?:\/\//i.test(input)) {
    try {
      const parsed = new URL(input)
      if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname.toLowerCase())) return ''
      username = parsed.pathname.split('/').filter(Boolean)[0] || ''
    } catch {
      return ''
    }
  }

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return ''
  return `https://www.instagram.com/${username}/`
}

export function serializeCompanyProfile(profile?: CompanyProfile | null): CompanyProfileData {
  const result = withCompanyProfileDefaults(profile)
  return {
    ...result,
    createdAt: profile?.createdAt.toISOString(),
    updatedAt: profile?.updatedAt.toISOString(),
  }
}

export function formatCompanyAddress(profile: CompanyProfileData) {
  const streetLine = [profile.street, profile.number].filter(Boolean).join(', ')
  const detailLine = [profile.complement, profile.neighborhood].filter(Boolean).join(' - ')
  const cityLine = [profile.city, profile.state].filter(Boolean).join('/')
  const postalLine = profile.zipCode ? `CEP ${profile.zipCode}` : ''

  return [streetLine, detailLine, [cityLine, postalLine].filter(Boolean).join(' - ')].filter(Boolean)
}
