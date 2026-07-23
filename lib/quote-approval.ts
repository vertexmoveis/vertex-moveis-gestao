import { parseQuoteAccessories } from './quotes'
import { moneyValue, type NumericValue } from './money'

export const QUOTE_APPROVAL_SNAPSHOT_VERSION = 2
export const QUOTE_APPROVAL_BUNDLE_SNAPSHOT_VERSION = 3

type QuoteApprovalItemSource = {
  id?: string
  environment: string
  environmentName?: string | null
  description: string
  material?: string | null
  finish?: string | null
  priceProfile?: string | null
  width: number
  height: number
  quantity: number
  total: NumericValue
  notes?: string | null
  accessories?: string[] | string | null
}

export type QuoteApprovalSource = {
  id: string
  number?: number | null
  title: string
  createdAt?: Date | string | null
  validUntil?: Date | string | null
  deliveryBusinessDays?: number | null
  firstInstallmentDate?: Date | string | null
  installationFee: NumericValue
  manualDiscount: NumericValue
  paymentDiscount: NumericValue
  paymentMethod: string
  cardInstallments: number
  cardDownPayment: NumericValue
  subtotal: NumericValue
  total: NumericValue
  customerNotes?: string | null
  client: {
    name: string
    document?: string | null
    phone?: string | null
    whatsapp?: string | null
    address?: string | null
    street?: string | null
    number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
  }
  items: QuoteApprovalItemSource[]
}

export type QuoteApprovalSnapshot = {
  version: typeof QUOTE_APPROVAL_SNAPSHOT_VERSION
  quote: {
    id: string
    number: number | null
    title: string
    createdAt?: string | null
    validUntil: string | null
    deliveryBusinessDays?: number
    firstInstallmentDate?: string | null
    installationFee: number
    manualDiscount: number
    paymentDiscount: number
    paymentMethod: string
    cardInstallments: number
    cardDownPayment: number
    subtotal: number
    total: number
    customerNotes: string | null
    client: {
      name: string
      document: string | null
      phone: string | null
      whatsapp: string | null
      address: string | null
      street: string | null
      number: string | null
      neighborhood: string | null
      city: string | null
      state: string | null
      zipCode: string | null
    }
    items: Array<{
      id: string
      environment: string
      environmentName?: string | null
      description: string
      material: string | null
      finish: string | null
      priceProfile?: string | null
      width: number
      height: number
      quantity: number
      total: number
      notes: string | null
      accessories: string[]
    }>
  }
}

export type QuoteApprovalData = QuoteApprovalSnapshot['quote']

export type QuoteApprovalBundleSnapshot = {
  version: typeof QUOTE_APPROVAL_BUNDLE_SNAPSHOT_VERSION
  quotes: QuoteApprovalData[]
}

function dateToIso(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function buildQuoteApprovalData(quote: QuoteApprovalSource): QuoteApprovalData {
  return {
    id: quote.id,
    number: quote.number || null,
    title: quote.title,
    createdAt: dateToIso(quote.createdAt),
    validUntil: dateToIso(quote.validUntil),
    deliveryBusinessDays: quote.deliveryBusinessDays || 30,
    firstInstallmentDate: dateToIso(quote.firstInstallmentDate),
    installationFee: moneyValue(quote.installationFee),
    manualDiscount: moneyValue(quote.manualDiscount),
    paymentDiscount: moneyValue(quote.paymentDiscount),
    paymentMethod: quote.paymentMethod,
    cardInstallments: quote.cardInstallments,
    cardDownPayment: moneyValue(quote.cardDownPayment),
    subtotal: moneyValue(quote.subtotal),
    total: moneyValue(quote.total),
    customerNotes: quote.customerNotes || null,
    client: {
      name: quote.client.name,
      document: quote.client.document || null,
      phone: quote.client.phone || null,
      whatsapp: quote.client.whatsapp || null,
      address: quote.client.address || null,
      street: quote.client.street || null,
      number: quote.client.number || null,
      neighborhood: quote.client.neighborhood || null,
      city: quote.client.city || null,
      state: quote.client.state || null,
      zipCode: quote.client.zipCode || null,
    },
    items: quote.items.map((item, index) => ({
      id: `item-${index + 1}`,
      environment: item.environment,
      environmentName: item.environmentName || item.environment,
      description: item.description,
      material: item.material || null,
      finish: item.finish || null,
      priceProfile: item.priceProfile || null,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      total: moneyValue(item.total),
      notes: item.notes || null,
      accessories: parseQuoteAccessories(item.accessories),
    })),
  }
}

export function buildQuoteApprovalSnapshot(quote: QuoteApprovalSource) {
  return JSON.stringify({
    version: QUOTE_APPROVAL_SNAPSHOT_VERSION,
    quote: buildQuoteApprovalData(quote),
  } satisfies QuoteApprovalSnapshot)
}

export function buildQuoteApprovalBundleSnapshot(quotes: QuoteApprovalSource[]) {
  const orderedQuotes = quotes
    .map(buildQuoteApprovalData)
    .sort((left, right) => {
      const numberDifference = (left.number ?? Number.MAX_SAFE_INTEGER) - (right.number ?? Number.MAX_SAFE_INTEGER)
      return numberDifference || left.id.localeCompare(right.id)
    })

  if (orderedQuotes.length !== 2 || orderedQuotes[0].id === orderedQuotes[1].id) {
    throw new Error('A comparação exige dois orçamentos diferentes.')
  }

  return JSON.stringify({
    version: QUOTE_APPROVAL_BUNDLE_SNAPSHOT_VERSION,
    quotes: orderedQuotes,
  } satisfies QuoteApprovalBundleSnapshot)
}

export function parseQuoteApprovalSnapshot(value?: string | null): QuoteApprovalSnapshot | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as QuoteApprovalSnapshot
    if (parsed?.version !== QUOTE_APPROVAL_SNAPSHOT_VERSION) return null
    if (!parsed.quote?.id || !parsed.quote.title || !parsed.quote.client?.name || !Array.isArray(parsed.quote.items)) return null
    return parsed
  } catch {
    return null
  }
}

export function parseQuoteApprovalBundleSnapshot(value?: string | null): QuoteApprovalBundleSnapshot | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as QuoteApprovalBundleSnapshot
    if (parsed?.version !== QUOTE_APPROVAL_BUNDLE_SNAPSHOT_VERSION) return null
    if (!Array.isArray(parsed.quotes) || parsed.quotes.length !== 2) return null
    if (new Set(parsed.quotes.map((quote) => quote.id)).size !== 2) return null
    if (parsed.quotes.some((quote) => !quote.id || !quote.title || !quote.client?.name || !Array.isArray(quote.items))) return null
    return parsed
  } catch {
    return null
  }
}
