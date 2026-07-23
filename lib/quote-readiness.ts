import { isDateOnlyExpired } from './date-only'
import type { NumericValue } from './money'

export type QuoteReadinessIssue = {
  key: string
  label: string
}

export type QuoteReadiness = {
  ready: boolean
  issues: QuoteReadinessIssue[]
  warnings: QuoteReadinessIssue[]
}

type ReadinessClient = {
  name?: string | null
  document?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  street?: string | null
  number?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

type ReadinessCompany = {
  tradeName?: string | null
  document?: string | null
  phone?: string | null
  street?: string | null
  number?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

export type QuoteReadinessSource = {
  title?: string | null
  total?: NumericValue
  validUntil?: Date | string | null
  deliveryBusinessDays?: number | null
  firstInstallmentDate?: Date | string | null
  paymentMethod?: string | null
  cardInstallments?: number | null
  client?: ReadinessClient | null
  company?: ReadinessCompany | null
  items?: unknown[] | null
}

function hasText(value?: string | null) {
  return Boolean(value?.trim())
}

function hasCompleteAddress(source?: ReadinessClient | ReadinessCompany | null) {
  if (!source) return false
  if ('address' in source && hasText(source.address)) return true
  return Boolean(
    hasText(source.street)
      && hasText(source.number)
      && hasText(source.city)
      && hasText(source.state)
      && hasText(source.zipCode),
  )
}

export function evaluateQuoteReadiness(source: QuoteReadinessSource, now = new Date()): QuoteReadiness {
  const issues: QuoteReadinessIssue[] = []
  const warnings: QuoteReadinessIssue[] = []
  const add = (key: string, label: string) => issues.push({ key, label })
  const warn = (key: string, label: string) => warnings.push({ key, label })
  const client = source.client
  const company = source.company

  if (!hasText(source.title)) add('quote.title', 'Informe o nome do orçamento.')
  if (!source.items?.length) add('quote.items', 'Adicione pelo menos um móvel.')
  if (!(Number(source.total) > 0)) add('quote.total', 'O total do orçamento deve ser maior que zero.')
  if (!source.validUntil) add('quote.validUntil', 'Informe a validade da proposta.')
  else if (isDateOnlyExpired(source.validUntil, now)) add('quote.validUntil', 'Atualize a validade vencida da proposta.')
  if (!(Number(source.deliveryBusinessDays) > 0)) add('quote.deliveryBusinessDays', 'Informe o prazo de entrega em dias úteis.')

  if (!client || !hasText(client.name)) add('client.name', 'Informe o nome do cliente.')
  if (!client || (!hasText(client.whatsapp) && !hasText(client.phone))) add('client.contact', 'Cadastre o WhatsApp ou telefone do cliente.')
  if (!hasCompleteAddress(client)) warn('client.address', 'O endereço do cliente ainda não foi cadastrado.')

  if (!source.paymentMethod || source.paymentMethod === 'TO_DEFINE') {
    add('quote.paymentMethod', 'Escolha Pix ou cartão como forma de pagamento.')
  }
  if (source.paymentMethod === 'CARD') {
    if (!(Number(source.cardInstallments) >= 1)) add('quote.cardInstallments', 'Informe a quantidade de parcelas.')
    if (!source.firstInstallmentDate) add('quote.firstInstallmentDate', 'Informe a data da primeira parcela.')
  }

  if (!company || !hasText(company.tradeName)) add('company.tradeName', 'Complete o nome da empresa nas Configurações.')
  if (!company || !hasText(company.document)) add('company.document', 'Complete o CNPJ da empresa nas Configurações.')
  if (!company || !hasText(company.phone)) add('company.phone', 'Complete o telefone da empresa nas Configurações.')
  if (!hasCompleteAddress(company)) add('company.address', 'Complete o endereço da empresa nas Configurações.')

  return { ready: issues.length === 0, issues, warnings }
}
