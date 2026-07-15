import type { QuoteCalculationMode } from '@/lib/quote-catalog'
import { findQuotePriceRule, type QuotePriceRule } from '@/lib/quote-price-rules'

export type QuotePriceProfile = 'STANDARD' | 'WOODGRAIN' | 'PROVENCAL' | 'EXTERNAL_LACQUER'

export const QUOTE_PRICE_PROFILE_LABELS: Record<QuotePriceProfile, string> = {
  STANDARD: 'Padrão',
  WOODGRAIN: 'Madeirado',
  PROVENCAL: 'Provençal',
  EXTERNAL_LACQUER: 'Laca externa',
}

export const QUOTE_PRICE_PROFILES: QuotePriceProfile[] = [
  'STANDARD',
  'WOODGRAIN',
  'PROVENCAL',
  'EXTERNAL_LACQUER',
]

type QuotePricingRuleInput = {
  environment?: string | null
  description?: string | null
  furnitureType?: string | null
  furnitureModel?: string | null
  priceProfile?: string | null
}

export type QuoteAutomaticPricing = {
  mode: QuoteCalculationMode
  rate: number
  label: string
  overridesSuggestedMode: boolean
  materialCostPerM2?: number | null
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function safeQuotePriceProfile(value?: string | null): QuotePriceProfile {
  return QUOTE_PRICE_PROFILES.includes(value as QuotePriceProfile)
    ? value as QuotePriceProfile
    : 'STANDARD'
}

export function getQuoteAutomaticPricing(
  item: QuotePricingRuleInput,
  fallbackPricePerM2 = 2000,
  priceRules: QuotePriceRule[] = []
): QuoteAutomaticPricing {
  const configuredRule = findQuotePriceRule(item, priceRules)
  if (configuredRule) {
    return {
      mode: configuredRule.calculationMode,
      rate: configuredRule.pricePerM2,
      label: configuredRule.name,
      overridesSuggestedMode: configuredRule.calculationMode !== 'AREA_M2',
      materialCostPerM2: configuredRule.materialCostPerM2,
    }
  }
  const environment = normalizeText(item.environment)
  const description = normalizeText(item.furnitureModel || item.description)
  const furnitureType = normalizeText(item.furnitureType)
  const priceProfile = safeQuotePriceProfile(item.priceProfile)
  const isBedroom = ['dormitorio', 'suite', 'quarto infantil', 'quarto de bebe'].includes(environment)

  if (description.includes('prateleira')) {
    return { mode: 'LINEAR_METER', rate: 250, label: 'Prateleira', overridesSuggestedMode: true }
  }
  if (description.includes('porta mimetizada')) {
    return { mode: 'AREA_M2', rate: 4200, label: 'Porta mimetizada', overridesSuggestedMode: true }
  }
  if (description.includes('porta de giro')) {
    return { mode: 'AREA_M2', rate: 2600, label: 'Porta de giro', overridesSuggestedMode: true }
  }
  if (environment === 'cozinha' && priceProfile === 'PROVENCAL') {
    return { mode: 'AREA_M2', rate: 4800, label: 'Cozinha provençal', overridesSuggestedMode: false }
  }
  if (environment === 'cozinha' && priceProfile === 'EXTERNAL_LACQUER') {
    return { mode: 'AREA_M2', rate: 4800, label: 'Cozinha com laca externa', overridesSuggestedMode: false }
  }
  if (environment === 'banheiro' && furnitureType === 'gabinete') {
    return { mode: 'AREA_M2', rate: 2800, label: 'Gabinete de banheiro', overridesSuggestedMode: false }
  }
  if (description.includes('painel ripado')) {
    return { mode: 'AREA_M2', rate: 1200, label: 'Painel ripado', overridesSuggestedMode: true }
  }
  if (furnitureType === 'painel' || description.startsWith('painel')) {
    return { mode: 'AREA_M2', rate: 800, label: 'Painel liso', overridesSuggestedMode: true }
  }
  if (isBedroom && furnitureType === 'guarda-roupa') {
    const rate = priceProfile === 'WOODGRAIN' ? 2000 : 1800
    return {
      mode: 'AREA_M2',
      rate,
      label: priceProfile === 'WOODGRAIN' ? 'Armário de quarto madeirado' : 'Armário de quarto com portas',
      overridesSuggestedMode: false,
    }
  }
  if (environment === 'closet') {
    const hasDoors = description.includes('com portas')
    return {
      mode: 'AREA_M2',
      rate: hasDoors ? 1800 : 1600,
      label: hasDoors ? 'Closet com portas' : 'Closet sem portas',
      overridesSuggestedMode: false,
    }
  }
  if (environment === 'cozinha') {
    const rate = priceProfile === 'WOODGRAIN' ? 2500 : 2000
    return {
      mode: 'AREA_M2',
      rate,
      label: priceProfile === 'WOODGRAIN' ? 'Cozinha madeirada' : 'Cozinha padrão',
      overridesSuggestedMode: false,
    }
  }

  return {
    mode: 'AREA_M2',
    rate: fallbackPricePerM2 || 2000,
    label: 'Preço padrão',
    overridesSuggestedMode: false,
  }
}
