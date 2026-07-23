import type { Quote, QuoteItem } from '@prisma/client'
import { addMonthsToDateOnly } from '@/lib/date-only'
import { roundCurrency } from '@/lib/payments'
import type { QuoteCalculationMode } from '@/lib/quote-catalog'
import { getQuoteAutomaticPricing, safeQuotePriceProfile, type QuotePriceProfile } from '@/lib/quote-pricing'
import type { QuotePriceRule } from '@/lib/quote-price-rules'
import { moneyValue, numberValue, optionalMoneyValue, type NumericValue } from '@/lib/money'

export {
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_ENVIRONMENT_OPTIONS,
  QUOTE_FURNITURE_CATALOG,
  getQuoteFurnitureAccessories,
  getQuoteFurnitureDescription,
  getQuoteEnvironmentTemplates,
  getQuoteFurnitureGroup,
  getQuoteFurnitureGroups,
  getQuoteFurnitureOptions,
  normalizeQuoteCatalogSearch,
  resolveQuoteFurnitureSelection,
  searchQuoteFurnitureOptions,
} from '@/lib/quote-catalog'
export type { QuoteCalculationMode, QuoteEnvironmentTemplate, QuoteFurnitureOption } from '@/lib/quote-catalog'
export {
  DEFAULT_QUOTE_INTERNAL_FINISH,
  QUOTE_INTERNAL_FINISHES,
  QUOTE_PRICE_PROFILE_LABELS,
  QUOTE_PRICE_PROFILES,
  getQuoteAutomaticPricing,
  safeQuotePriceProfile,
} from '@/lib/quote-pricing'
export type { QuotePriceProfile } from '@/lib/quote-pricing'

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'SOLD'
  | 'LOST'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Em orçamento',
  SENT: 'Enviado',
  WAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  SOLD: 'Vendido',
  LOST: 'Perdido',
}

export const QUOTE_STATUS_BG: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  WAITING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-700',
  SOLD: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-700',
}

export const QUOTE_STATUSES: QuoteStatus[] = [
  'DRAFT',
  'SENT',
  'WAITING_APPROVAL',
  'APPROVED',
  'SOLD',
  'LOST',
]

export const DEFAULT_QUOTE_PRICING = {
  pricePerM2: 2000,
  materialCostPerM2: 650,
  installationFee: 0,
  marginPercent: 0,
  discount: 0,
}

export type QuoteDifficulty = 'NORMAL' | 'DIFICIL' | 'MUITO_DIFICIL'
export type QuotePaymentMethod = 'TO_DEFINE' | 'PIX' | 'CARD'

export const QUOTE_PAYMENT_METHODS: QuotePaymentMethod[] = ['TO_DEFINE', 'PIX', 'CARD']
export const QUOTE_PAYMENT_METHOD_LABELS: Record<QuotePaymentMethod, string> = {
  TO_DEFINE: 'A combinar',
  PIX: 'Pix (3% de desconto)',
  CARD: 'Cartão parcelado',
}
export const QUOTE_PIX_DISCOUNT_PERCENT = 3

export const QUOTE_DIFFICULTY_LABELS: Record<QuoteDifficulty, string> = {
  NORMAL: 'Normal',
  DIFICIL: 'Difícil (+30%)',
  MUITO_DIFICIL: 'Muito difícil (+60%)',
}

export const QUOTE_DIFFICULTY_MULTIPLIER: Record<QuoteDifficulty, number> = {
  NORMAL: 1,
  DIFICIL: 1.3,
  MUITO_DIFICIL: 1.6,
}

export const DEFAULT_QUOTE_MATERIAL = 'MDF'

export function quoteCentimetersToMillimeters(value: number) {
  return value * 10
}

export function quoteMillimetersToCentimeters(value: number) {
  return value / 10
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function safeQuoteDifficulty(value?: string | null): QuoteDifficulty {
  return value === 'DIFICIL' || value === 'MUITO_DIFICIL' ? value : 'NORMAL'
}

export function getQuoteEnvironmentPricePerM2(environment: string, fallback = DEFAULT_QUOTE_PRICING.pricePerM2) {
  return normalizeText(environment).includes('cozinha') ? 2000 : fallback || 2000
}

export function getQuoteItemPricePerM2(
  item: Parameters<typeof getQuoteAutomaticPricing>[0],
  fallback = DEFAULT_QUOTE_PRICING.pricePerM2
) {
  const automaticPricing = getQuoteAutomaticPricing(item, fallback)
  return automaticPricing.mode === 'AREA_M2'
    ? automaticPricing.rate
    : getQuoteEnvironmentPricePerM2(item.environment || '', fallback)
}

export type QuoteCalculationItemInput = {
  environment: string
  environmentName?: string | null
  description: string
  furnitureType?: string | null
  furnitureModel?: string | null
  material?: string | null
  finish?: string | null
  width: number
  height: number
  depth?: number | null
  difficulty?: string | null
  calculationMode?: string | null
  priceProfile?: string | null
  manualPrice?: number | null
  accessories?: string[] | string | null
  quantity: number
  notes?: string | null
}

export type QuotePricingInput = {
  pricePerM2: number
  materialCostPerM2: number
  installationFee: number
  marginPercent: number
  discount: number
  paymentMethod?: string | null
  cardInstallments?: number | null
  cardDownPayment?: number | null
  cardFeePercent?: number | null
  priceRules?: QuotePriceRule[]
  materialCosts?: { name: string; unitCost: NumericValue; active?: boolean }[]
}

export function safeQuoteStatus(value: string): QuoteStatus {
  return QUOTE_STATUSES.includes(value as QuoteStatus) ? value as QuoteStatus : 'DRAFT'
}

export function safeQuotePaymentMethod(value?: string | null): QuotePaymentMethod {
  return QUOTE_PAYMENT_METHODS.includes(value as QuotePaymentMethod)
    ? value as QuotePaymentMethod
    : 'TO_DEFINE'
}

export function safeQuoteCardInstallments(value?: number | null) {
  return Math.min(Math.max(Math.floor(Number(value) || 1), 1), 24)
}

export function safeQuoteCardDownPayment(value: import('@/lib/money').NumericValue, total: number) {
  return roundCurrency(Math.min(Math.max(Number(value) || 0, 0), Math.max(total || 0, 0)))
}

export function safeQuoteCardFeePercent(value?: number | null) {
  return Math.min(Math.max(Number(value) || 0, 0), 30)
}

export function getQuoteCardInstallmentPlan(
  total: number,
  installmentCount?: number | null,
  cardDownPayment?: import('@/lib/money').NumericValue
) {
  const count = safeQuoteCardInstallments(installmentCount)
  const downPayment = safeQuoteCardDownPayment(cardDownPayment, total)
  const financedAmount = roundCurrency(Math.max((total || 0) - downPayment, 0))
  const installmentValue = roundCurrency(financedAmount / count)
  const lastInstallmentValue = roundCurrency(financedAmount - installmentValue * (count - 1))
  return { count, downPayment, financedAmount, installmentValue, lastInstallmentValue }
}

export function getQuotePaymentSummary(quote: {
  total: import('@/lib/money').NumericValue
  paymentMethod?: string | null
  cardInstallments?: number | null
  cardDownPayment?: import('@/lib/money').NumericValue
}) {
  const paymentMethod = safeQuotePaymentMethod(quote.paymentMethod)
  if (paymentMethod === 'PIX') return 'Pix com 3% de desconto'
  if (paymentMethod !== 'CARD') return 'Pagamento a combinar'

  const plan = getQuoteCardInstallmentPlan(numberValue(quote.total), quote.cardInstallments, quote.cardDownPayment)
  const format = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
  const downPaymentPrefix = plan.downPayment > 0 ? `Entrada de ${format(plan.downPayment)} + ` : ''

  if (plan.financedAmount <= 0) {
    return `Entrada de ${format(plan.downPayment)}; sem saldo restante no cartão`
  }

  if (plan.installmentValue === plan.lastInstallmentValue) {
    return `${downPaymentPrefix}${plan.count}x de ${format(plan.installmentValue)} no cartão`
  }

  return `${downPaymentPrefix}${plan.count - 1}x de ${format(plan.installmentValue)} e última de ${format(plan.lastInstallmentValue)} no cartão`
}

export function getQuotePaymentDetails(quote: {
  total: import('@/lib/money').NumericValue
  paymentMethod?: string | null
  paymentDiscount?: import('@/lib/money').NumericValue
  cardInstallments?: number | null
  cardDownPayment?: import('@/lib/money').NumericValue
  firstInstallmentDate?: Date | string | null
}) {
  const method = safeQuotePaymentMethod(quote.paymentMethod)
  const total = roundCurrency(Math.max(Number(quote.total) || 0, 0))
  const paymentDiscount = method === 'PIX'
    ? roundCurrency(Math.max(Number(quote.paymentDiscount) || 0, 0))
    : 0
  const totalBeforePaymentDiscount = roundCurrency(total + paymentDiscount)
  const cardPlan = getQuoteCardInstallmentPlan(total, quote.cardInstallments, quote.cardDownPayment)
  const installments = method === 'CARD' && cardPlan.financedAmount > 0
    ? Array.from({ length: cardPlan.count }, (_, index) => ({
        number: index + 1,
        amount: index === cardPlan.count - 1 ? cardPlan.lastInstallmentValue : cardPlan.installmentValue,
        dueDate: addMonthsToDateOnly(quote.firstInstallmentDate, index),
      }))
    : []

  return {
    method,
    methodLabel: QUOTE_PAYMENT_METHOD_LABELS[method],
    summary: getQuotePaymentSummary(quote),
    total,
    paymentDiscount,
    totalBeforePaymentDiscount,
    downPayment: method === 'CARD' ? cardPlan.downPayment : 0,
    financedAmount: method === 'CARD' ? cardPlan.financedAmount : 0,
    installments,
  }
}

export function getQuoteInstallmentGridColumns(count: number) {
  const installmentCount = Math.max(Math.floor(Number(count) || 1), 1)
  if (installmentCount <= 2) return installmentCount
  if (installmentCount % 5 === 0) return 5
  if (installmentCount % 4 === 0) return 4
  if (installmentCount % 3 === 0) return 3
  return 4
}

export const QUOTE_CALCULATION_MODES: QuoteCalculationMode[] = ['AREA_M2', 'LINEAR_METER', 'UNIT']

export function safeQuoteCalculationMode(value?: string | null): QuoteCalculationMode {
  return QUOTE_CALCULATION_MODES.includes(value as QuoteCalculationMode)
    ? value as QuoteCalculationMode
    : 'AREA_M2'
}

export function parseQuoteAccessories(value?: string[] | string | null) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : []
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

function serializeQuoteAccessories(value?: string[] | string | null) {
  const accessories = [...new Set(parseQuoteAccessories(value))]
  return accessories.length ? JSON.stringify(accessories) : null
}

export function calculateQuoteItem(item: QuoteCalculationItemInput, pricing: QuotePricingInput, position: number) {
  const width = Math.max(Number(item.width) || 0, 0)
  const height = Math.max(Number(item.height) || 0, 0)
  const quantity = Math.max(Math.floor(Number(item.quantity) || 1), 1)
  const baseArea = width > 0 && height > 0 ? (width * height) / 10000 : 0
  const areaM2 = roundCurrency(baseArea * quantity)
  const difficulty = safeQuoteDifficulty(item.difficulty)
  const calculationMode = safeQuoteCalculationMode(item.calculationMode)
  const priceProfile: QuotePriceProfile = safeQuotePriceProfile(item.priceProfile)
  const automaticPricing = getQuoteAutomaticPricing(item, pricing.pricePerM2, pricing.priceRules)
  const pricePerM2 = automaticPricing.mode === 'AREA_M2'
    ? automaticPricing.rate
    : getQuoteEnvironmentPricePerM2(item.environment, pricing.pricePerM2)
  const manualPrice = Math.max(Number(item.manualPrice) || 0, 0)
  const linearMeters = roundCurrency((width / 100) * quantity)
  const calculationRate = calculationMode === 'AREA_M2' ? pricePerM2 : manualPrice
  const calculationAmount = calculationMode === 'AREA_M2'
    ? areaM2
    : calculationMode === 'LINEAR_METER'
      ? linearMeters
      : quantity
  const total = roundCurrency(calculationAmount * calculationRate * QUOTE_DIFFICULTY_MULTIPLIER[difficulty])
  const materialCost = pricing.materialCosts?.find((material) => (
    material.active !== false && normalizeText(material.name) === normalizeText(item.material || DEFAULT_QUOTE_MATERIAL)
  ))?.unitCost
  const materialCostPerM2 = automaticPricing.materialCostPerM2
    ?? (materialCost == null ? pricing.materialCostPerM2 : numberValue(materialCost))
  const cost = roundCurrency(areaM2 * Math.max(materialCostPerM2 || 0, 0))

  return {
    environment: item.environment.trim(),
    environmentName: item.environmentName?.trim() || item.environment.trim(),
    description: item.description.trim(),
    furnitureType: item.furnitureType?.trim() || null,
    furnitureModel: item.furnitureModel?.trim() || null,
    material: item.material?.trim() || DEFAULT_QUOTE_MATERIAL,
    finish: item.finish?.trim() || null,
    width,
    height,
    depth: null,
    difficulty,
    calculationMode,
    priceProfile,
    manualPrice: calculationMode === 'AREA_M2' ? null : manualPrice,
    accessories: serializeQuoteAccessories(item.accessories),
    quantity,
    areaM2,
    unitPrice: roundCurrency(calculationRate * QUOTE_DIFFICULTY_MULTIPLIER[difficulty]),
    cost,
    total,
    notes: item.notes?.trim() || null,
    position,
  }
}

export function calculateQuoteTotals(items: QuoteCalculationItemInput[], pricing: QuotePricingInput) {
  const calculatedItems = items.map((item, index) => calculateQuoteItem(item, pricing, index + 1))
  const itemsSubtotal = roundCurrency(calculatedItems.reduce((sum, item) => sum + item.total, 0))
  const baseCostTotal = roundCurrency(
    calculatedItems.reduce((sum, item) => sum + item.cost, 0) + Math.max(pricing.installationFee || 0, 0)
  )
  const subtotal = roundCurrency(itemsSubtotal + Math.max(pricing.installationFee || 0, 0))
  const manualDiscount = roundCurrency(Math.min(Math.max(pricing.discount || 0, 0), subtotal))
  const afterManualDiscount = roundCurrency(Math.max(subtotal - manualDiscount, 0))
  const paymentMethod = safeQuotePaymentMethod(pricing.paymentMethod)
  const paymentDiscount = paymentMethod === 'PIX'
    ? roundCurrency(afterManualDiscount * (QUOTE_PIX_DISCOUNT_PERCENT / 100))
    : 0
  const discount = roundCurrency(manualDiscount + paymentDiscount)
  const total = roundCurrency(Math.max(afterManualDiscount - paymentDiscount, 0))
  const cardDownPayment = paymentMethod === 'CARD'
    ? safeQuoteCardDownPayment(pricing.cardDownPayment, total)
    : 0
  const cardFeePercent = paymentMethod === 'CARD' ? safeQuoteCardFeePercent(pricing.cardFeePercent) : 0
  const cardFeeAmount = paymentMethod === 'CARD'
    ? roundCurrency(Math.max(total - cardDownPayment, 0) * (cardFeePercent / 100))
    : 0
  const costTotal = roundCurrency(baseCostTotal + cardFeeAmount)

  return {
    items: calculatedItems,
    subtotal,
    costTotal,
    discount: roundCurrency(discount),
    manualDiscount,
    paymentDiscount,
    paymentMethod,
    cardInstallments: paymentMethod === 'CARD' ? safeQuoteCardInstallments(pricing.cardInstallments) : 1,
    cardDownPayment,
    cardFeePercent,
    cardFeeAmount,
    total,
    profit: roundCurrency(total - costTotal),
  }
}

export function serializeQuoteItem(item: QuoteItem) {
  return {
    ...item,
    manualPrice: optionalMoneyValue(item.manualPrice),
    unitPrice: moneyValue(item.unitPrice),
    cost: moneyValue(item.cost),
    total: moneyValue(item.total),
    accessories: parseQuoteAccessories(item.accessories),
    totalPrice: moneyValue(item.total),
    costTotal: moneyValue(item.cost),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export function serializeQuote(quote: Quote & { items?: QuoteItem[]; client?: { id: string; name: string; phone: string | null; whatsapp: string | null; email?: string | null } }) {
  const total = moneyValue(quote.total)
  const costTotal = moneyValue(quote.costTotal)
  return {
    ...quote,
    pricePerM2: moneyValue(quote.pricePerM2),
    materialCostPerM2: moneyValue(quote.materialCostPerM2),
    installationFee: moneyValue(quote.installationFee),
    discount: moneyValue(quote.discount),
    manualDiscount: moneyValue(quote.manualDiscount),
    paymentDiscount: moneyValue(quote.paymentDiscount),
    cardDownPayment: moneyValue(quote.cardDownPayment),
    cardFeeAmount: moneyValue(quote.cardFeeAmount),
    subtotal: moneyValue(quote.subtotal),
    costTotal,
    total,
    profit: roundCurrency(total - costTotal),
    status: safeQuoteStatus(quote.status),
    validUntil: quote.validUntil?.toISOString() || null,
    firstInstallmentDate: quote.firstInstallmentDate?.toISOString() || null,
    sentAt: quote.sentAt?.toISOString() || null,
    approvedAt: quote.approvedAt?.toISOString() || null,
    soldAt: quote.soldAt?.toISOString() || null,
    lostAt: quote.lostAt?.toISOString() || null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    items: quote.items?.map(serializeQuoteItem) || [],
  }
}

export function quoteDisplayCode(quote: { id: string; number?: number | null }) {
  return quote.number ? String(quote.number).padStart(4, '0') : quote.id.slice(-6).toUpperCase()
}

export function buildQuoteSnapshot(quote: Quote & { items: QuoteItem[]; client?: { name: string } }) {
  return JSON.stringify({
    id: quote.id,
    title: quote.title,
    client: quote.client?.name,
    status: quote.status,
    validUntil: quote.validUntil?.toISOString() || null,
    deliveryBusinessDays: quote.deliveryBusinessDays,
    firstInstallmentDate: quote.firstInstallmentDate?.toISOString() || null,
    pricing: {
      pricePerM2: numberValue(quote.pricePerM2),
      materialCostPerM2: numberValue(quote.materialCostPerM2),
      installationFee: numberValue(quote.installationFee),
      marginPercent: quote.marginPercent,
      discount: numberValue(quote.discount),
      manualDiscount: numberValue(quote.manualDiscount),
      paymentDiscount: numberValue(quote.paymentDiscount),
      paymentMethod: quote.paymentMethod,
      cardInstallments: quote.cardInstallments,
      cardDownPayment: numberValue(quote.cardDownPayment),
      cardFeePercent: quote.cardFeePercent,
      cardFeeAmount: numberValue(quote.cardFeeAmount),
    },
    totals: {
      subtotal: numberValue(quote.subtotal),
      costTotal: numberValue(quote.costTotal),
      total: numberValue(quote.total),
    },
    items: quote.items.map((item) => ({
      environment: item.environment,
      environmentName: item.environmentName,
      description: item.description,
      furnitureType: item.furnitureType,
      furnitureModel: item.furnitureModel,
      material: item.material,
      finish: item.finish,
      width: item.width,
      height: item.height,
      depth: item.depth,
      difficulty: item.difficulty,
      calculationMode: item.calculationMode,
      priceProfile: item.priceProfile,
      manualPrice: optionalMoneyValue(item.manualPrice),
      accessories: parseQuoteAccessories(item.accessories),
      quantity: item.quantity,
      areaM2: item.areaM2,
      unitPrice: moneyValue(item.unitPrice),
      cost: moneyValue(item.cost),
      total: moneyValue(item.total),
      notes: item.notes,
    })),
  })
}

export function buildQuoteWhatsAppMessage(quote: { title: string; total: import('@/lib/money').NumericValue; validUntil: Date | string | null; paymentMethod?: string | null; cardInstallments?: number | null; cardDownPayment?: import('@/lib/money').NumericValue; client?: { name: string } }) {
  const validUntil = quote.validUntil ? new Intl.DateTimeFormat('pt-BR').format(new Date(quote.validUntil)) : null
  return [
    `Olá, ${quote.client?.name || 'tudo bem'}!`,
    '',
    `Segue o orçamento "${quote.title}" da Vertex Móveis.`,
    `Valor total: ${formatQuoteCurrency(quote.total)}.`,
    `Pagamento: ${getQuotePaymentSummary(quote)}.`,
    validUntil ? `Validade: ${validUntil}.` : '',
    '',
    'Qualquer ajuste que quiser fazer, me chama por aqui.',
  ].filter(Boolean).join('\n')
}

type QuoteContactMessage = {
  title: string
  total: import('@/lib/money').NumericValue
  client?: { name: string }
}

function formatQuoteCurrency(value: import('@/lib/money').NumericValue) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue(value))
}

export function buildQuoteApprovalMessage(quote: QuoteContactMessage, approvalUrl: string) {
  return [
    `Olá, ${quote.client?.name || 'tudo bem'}!`,
    '',
    `Preparamos o orçamento do seu projeto "${quote.title}" no valor de ${formatQuoteCurrency(quote.total)}.`,
    `Confira todos os detalhes e aprove a proposta por aqui: ${approvalUrl}`,
    '',
    'Ficou alguma dúvida ou deseja ajustar algum item? Pode me responder por aqui.',
  ].join('\n')
}

export function buildQuoteFollowUpMessage(quote: QuoteContactMessage, approvalUrl: string) {
  return [
    `Olá, ${quote.client?.name || 'tudo bem'}! Tudo certo?`,
    '',
    `Queria saber o que você achou do orçamento do seu projeto "${quote.title}", no valor de ${formatQuoteCurrency(quote.total)}.`,
    'Ficou alguma dúvida, algum detalhe que você gostaria de ajustar ou algo que não ficou como imaginava?',
    '',
    'Sua opinião é importante para deixarmos o projeto exatamente como você precisa.',
    `Você pode rever a proposta e aprovar por aqui: ${approvalUrl}`,
    '',
    'Fico à disposição.',
  ].join('\n')
}

export function buildQuoteComparisonApprovalMessage(
  quotes: [QuoteContactMessage, QuoteContactMessage],
  approvalUrl: string,
  reminder = false,
) {
  const clientName = quotes[0].client?.name || quotes[1].client?.name || 'tudo bem'
  const options = quotes.map((quote, index) => (
    `${index + 1}. ${quote.title}: ${formatQuoteCurrency(quote.total)}`
  ))

  return [
    reminder ? `Olá, ${clientName}! Tudo certo?` : `Olá, ${clientName}!`,
    '',
    reminder
      ? 'Queria saber o que você achou das duas opções que preparamos para o seu projeto:'
      : 'Preparamos duas opções para o seu projeto:',
    ...options,
    '',
    reminder
      ? 'Ficou alguma dúvida ou gostaria de ajustar algum detalhe?'
      : 'No mesmo link você pode comparar os móveis, acabamentos, valores e formas de pagamento.',
    `Veja as duas propostas e escolha a sua preferida aqui: ${approvalUrl}`,
    '',
    'Qualquer dúvida, pode me responder por aqui.',
  ].join('\n')
}
