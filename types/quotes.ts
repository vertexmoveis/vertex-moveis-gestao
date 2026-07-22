import type { QuoteCalculationMode, QuotePaymentMethod, QuotePriceProfile, QuoteStatus } from '@/lib/quotes'

export type QuoteItemData = {
  id?: string
  environment: string
  environmentName?: string | null
  description: string
  furnitureType?: string | null
  furnitureModel?: string | null
  width: number
  height: number
  depth?: number | null
  difficulty?: string | null
  calculationMode?: QuoteCalculationMode | null
  priceProfile?: QuotePriceProfile | null
  manualPrice?: number | null
  accessories?: string[]
  quantity: number
  material?: string | null
  finish?: string | null
  notes?: string | null
  areaM2?: number
  unitPrice?: number
  totalPrice?: number
  costTotal?: number
}

export type QuoteData = {
  id: string
  number?: number | null
  title: string
  status: QuoteStatus
  subtotal: number
  discount: number
  manualDiscount?: number
  paymentDiscount?: number
  paymentMethod?: QuotePaymentMethod
  cardInstallments?: number
  cardDownPayment?: number
  cardFeePercent?: number
  cardFeeAmount?: number
  installationFee: number
  total: number
  costTotal: number
  profit: number
  marginPercent: number
  pricePerM2: number
  materialCostPerM2: number
  validUntil?: string | null
  deliveryBusinessDays?: number
  firstInstallmentDate?: string | null
  notes?: string | null
  customerNotes?: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    document?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    address?: string | null
    street?: string | null
    number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
  } | null
  items: QuoteItemData[]
  convertedProject?: {
    id: string
    name: string
  } | null
  readiness?: {
    ready: boolean
    issues: Array<{ key: string; label: string }>
    warnings: Array<{ key: string; label: string }>
  }
  approvalRecord?: {
    token: string
    approvedAt: string | null
    responseName: string | null
    responseDocument: string | null
    acceptedTermsAt: string | null
    invalidatedAt: string | null
    revisionVersion: number | null
  } | null
}
