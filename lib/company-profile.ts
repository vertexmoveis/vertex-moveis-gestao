import type { CompanyProfile } from '@prisma/client'

export const COMPANY_PROFILE_ID = 'vertex'

export const DEFAULT_COMPANY_PROFILE = {
  id: COMPANY_PROFILE_ID,
  tradeName: 'Vertex Móveis',
  legalName: 'Vertex Ferragens',
  document: '39.778.558/0001-38',
  phone: '(11) 94313-1992',
  email: 'vertexmoveis@gmail.com',
  street: 'Rua Saturno',
  number: '6',
  complement: 'Sala 2',
  neighborhood: 'Recanto Vista Alegre',
  city: 'Cotia',
  state: 'SP',
  zipCode: '06702-170',
  defaultDeliveryBusinessDays: 30,
} as const

export type CompanyProfileData = Omit<CompanyProfile, 'createdAt' | 'updatedAt'> & {
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
    street: profile?.street ?? DEFAULT_COMPANY_PROFILE.street,
    number: profile?.number ?? DEFAULT_COMPANY_PROFILE.number,
    complement: profile?.complement ?? DEFAULT_COMPANY_PROFILE.complement,
    neighborhood: profile?.neighborhood ?? DEFAULT_COMPANY_PROFILE.neighborhood,
    city: profile?.city ?? DEFAULT_COMPANY_PROFILE.city,
    state: profile?.state ?? DEFAULT_COMPANY_PROFILE.state,
    zipCode: profile?.zipCode ?? DEFAULT_COMPANY_PROFILE.zipCode,
    defaultDeliveryBusinessDays: profile?.defaultDeliveryBusinessDays || DEFAULT_COMPANY_PROFILE.defaultDeliveryBusinessDays,
  }
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
