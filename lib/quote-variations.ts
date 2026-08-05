import type { QuotePriceProfile } from '@/lib/quote-pricing'

export const MAX_QUOTE_OPTIONS = 6
export const MAX_QUOTE_COMPARISONS = MAX_QUOTE_OPTIONS - 1

export const QUOTE_VARIATION_TYPES = [
  'STANDARD',
  'WOODGRAIN',
  'PROVENCAL',
  'EXTERNAL_LACQUER',
  'CUSTOM',
] as const

export type QuoteVariationType = typeof QUOTE_VARIATION_TYPES[number]

export const QUOTE_VARIATION_LABELS: Record<QuoteVariationType, string> = {
  STANDARD: 'Branco TX externo',
  WOODGRAIN: 'Madeirado',
  PROVENCAL: 'Provençal',
  EXTERNAL_LACQUER: 'Laca',
  CUSTOM: 'Personalizada',
}
export const DEFAULT_QUOTE_VARIATIONS: QuoteVariationType[] = [
  'STANDARD',
  'WOODGRAIN',
  'PROVENCAL',
  'EXTERNAL_LACQUER',
]

export type QuoteVariationInput = {
  type: QuoteVariationType
  name: string
}

export function safeQuoteVariationType(value?: string | null): QuoteVariationType {
  return QUOTE_VARIATION_TYPES.includes(value as QuoteVariationType)
    ? value as QuoteVariationType
    : 'STANDARD'
}

export function quoteVariationDefaultName(type: QuoteVariationType) {
  return QUOTE_VARIATION_LABELS[type]
}

export function quoteVariationPriceProfile(type: QuoteVariationType): QuotePriceProfile | null {
  return type === 'CUSTOM' ? null : type
}

export function normalizeQuoteVariations(values?: QuoteVariationInput[] | null): QuoteVariationInput[] {
  const normalized = (values || [])
    .slice(0, MAX_QUOTE_OPTIONS)
    .map((variation) => {
      const type = safeQuoteVariationType(variation.type)
      return {
        type,
        name: variation.name.trim() || quoteVariationDefaultName(type),
      }
    })

  const unique: QuoteVariationInput[] = []
  const names = new Set<string>()
  for (const variation of normalized) {
    const key = variation.name.toLocaleLowerCase('pt-BR')
    if (names.has(key)) continue
    names.add(key)
    unique.push(variation)
  }

  return unique.length > 0
    ? unique
    : [{ type: 'STANDARD', name: QUOTE_VARIATION_LABELS.STANDARD }]
}
