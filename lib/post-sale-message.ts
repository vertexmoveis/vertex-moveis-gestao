import type { CompanyProfileData } from '@/lib/company-profile'

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'cliente'
}

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

export function resolveGoogleReviewUrl(company: CompanyProfileData) {
  if (company.googleReviewUrl) return company.googleReviewUrl

  const location = [
    company.tradeName,
    company.street,
    company.number,
    company.city,
    company.state,
  ].filter(Boolean).join(' ')

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

export function buildPostSaleMessage(input: {
  clientName: string
  projectName: string
  companyName: string
  googleReviewUrl: string
}) {
  return [
    `Olá, ${firstName(input.clientName)}! Tudo bem?`,
    '',
    `Gostaríamos de saber como foi sua experiência com os móveis do projeto "${input.projectName}". Ficou tudo como você esperava?`,
    '',
    `Sua opinião é muito importante para a ${input.companyName}. Se puder, deixe uma avaliação no Google pelo link abaixo:`,
    input.googleReviewUrl,
    '',
    'Agradecemos pela confiança e ficamos à disposição sempre que precisar.',
  ].join('\n')
}

export function buildPostSaleWhatsAppHref(input: {
  phone: string
  clientName: string
  projectName: string
  companyName: string
  googleReviewUrl: string
}) {
  const phone = normalizeWhatsAppNumber(input.phone)
  if (!phone) return ''

  const message = buildPostSaleMessage(input)
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
