import { parseQuoteAccessories } from './quotes'

export const QUOTE_APPROVAL_SNAPSHOT_VERSION = 2

type QuoteApprovalItemSource = {
  id?: string
  environment: string
  environmentName?: string | null
  description: string
  material?: string | null
  finish?: string | null
  width: number
  height: number
  quantity: number
  total: number
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
  installationFee: number
  manualDiscount: number
  paymentDiscount: number
  paymentMethod: string
  cardInstallments: number
  cardDownPayment: number
  subtotal: number
  total: number
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
      width: number
      height: number
      quantity: number
      total: number
      notes: string | null
      accessories: string[]
    }>
  }
}

function dateToIso(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function buildQuoteApprovalSnapshot(quote: QuoteApprovalSource) {
  return JSON.stringify({
    version: QUOTE_APPROVAL_SNAPSHOT_VERSION,
    quote: {
      id: quote.id,
      number: quote.number || null,
      title: quote.title,
      createdAt: dateToIso(quote.createdAt),
      validUntil: dateToIso(quote.validUntil),
      deliveryBusinessDays: quote.deliveryBusinessDays || 30,
      firstInstallmentDate: dateToIso(quote.firstInstallmentDate),
      installationFee: quote.installationFee,
      manualDiscount: quote.manualDiscount,
      paymentDiscount: quote.paymentDiscount,
      paymentMethod: quote.paymentMethod,
      cardInstallments: quote.cardInstallments,
      cardDownPayment: quote.cardDownPayment,
      subtotal: quote.subtotal,
      total: quote.total,
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
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        total: item.total,
        notes: item.notes || null,
        accessories: parseQuoteAccessories(item.accessories),
      })),
    },
  } satisfies QuoteApprovalSnapshot)
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
