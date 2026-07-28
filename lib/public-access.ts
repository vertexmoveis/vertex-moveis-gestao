const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/

export function isValidPublicToken(token: string) {
  return PUBLIC_TOKEN_PATTERN.test(token)
}

export function publicRateLimitKey(scope: string, ip: string) {
  return `api:public:${scope}:ip:${ip}`
}

export function maskPersonalDocument(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, '') || ''
  if (!digits) return 'Não informado'
  const suffix = digits.slice(-4)
  return `Documento protegido (final ${suffix.padStart(4, '*')})`
}

export function publicClientLocation(input: {
  city?: string | null
  state?: string | null
}) {
  const location = [input.city, input.state].filter(Boolean).join('/')
  return location || 'Endereço completo protegido no CRM'
}
