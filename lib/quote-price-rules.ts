import type { PrismaClient, QuotePriceRule as PrismaQuotePriceRule } from '@prisma/client'
import type { QuoteCalculationMode } from '@/lib/quote-catalog'

export type QuotePriceRule = {
  id?: string
  name: string
  environment?: string | null
  furnitureType?: string | null
  furnitureModel?: string | null
  priceProfile?: string | null
  calculationMode: QuoteCalculationMode
  pricePerM2: number
  materialCostPerM2?: number | null
  validFrom?: string | Date | null
  validUntil?: string | Date | null
  active?: boolean
}

type QuotePricingRuleInput = {
  environment?: string | null
  description?: string | null
  furnitureType?: string | null
  furnitureModel?: string | null
  priceProfile?: string | null
}

type PriceRuleStore = Pick<PrismaClient, 'quotePriceRule'>

const DEFAULT_PRICE_RULES: Omit<QuotePriceRule, 'id' | 'validFrom' | 'validUntil' | 'active'>[] = [
  { name: 'Cozinha padrão', environment: 'Cozinha', calculationMode: 'AREA_M2', pricePerM2: 2000, materialCostPerM2: 650 },
  { name: 'Cozinha madeirada', environment: 'Cozinha', priceProfile: 'WOODGRAIN', calculationMode: 'AREA_M2', pricePerM2: 2500, materialCostPerM2: 750 },
  { name: 'Cozinha provençal', environment: 'Cozinha', priceProfile: 'PROVENCAL', calculationMode: 'AREA_M2', pricePerM2: 4800, materialCostPerM2: 1000 },
  { name: 'Cozinha com laca externa', environment: 'Cozinha', priceProfile: 'EXTERNAL_LACQUER', calculationMode: 'AREA_M2', pricePerM2: 4800, materialCostPerM2: 1100 },
  { name: 'Armário de quarto com portas', environment: 'Dormitório', furnitureType: 'Guarda-roupa', calculationMode: 'AREA_M2', pricePerM2: 1800, materialCostPerM2: 650 },
  { name: 'Armário de quarto madeirado', environment: 'Dormitório', furnitureType: 'Guarda-roupa', priceProfile: 'WOODGRAIN', calculationMode: 'AREA_M2', pricePerM2: 2000, materialCostPerM2: 750 },
  { name: 'Closet sem portas', environment: 'Closet', calculationMode: 'AREA_M2', pricePerM2: 1600, materialCostPerM2: 600 },
  { name: 'Closet com portas', environment: 'Closet', furnitureModel: 'Closet com portas', calculationMode: 'AREA_M2', pricePerM2: 1800, materialCostPerM2: 650 },
  { name: 'Gabinete de banheiro', environment: 'Banheiro', furnitureType: 'Gabinete', calculationMode: 'AREA_M2', pricePerM2: 2800, materialCostPerM2: 800 },
  { name: 'Painel liso', furnitureModel: 'Painel liso', calculationMode: 'AREA_M2', pricePerM2: 800, materialCostPerM2: 320 },
  { name: 'Painel ripado', furnitureModel: 'Painel ripado', calculationMode: 'AREA_M2', pricePerM2: 1200, materialCostPerM2: 420 },
  { name: 'Porta de giro', furnitureModel: 'Porta de giro', calculationMode: 'AREA_M2', pricePerM2: 2600, materialCostPerM2: 800 },
  { name: 'Porta mimetizada', furnitureModel: 'Porta mimetizada', calculationMode: 'AREA_M2', pricePerM2: 4200, materialCostPerM2: 1200 },
  { name: 'Prateleira', furnitureModel: 'Prateleira', calculationMode: 'LINEAR_METER', pricePerM2: 250, materialCostPerM2: 120 },
]

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function dateValue(value?: string | Date | null) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

function ruleSpecificity(rule: QuotePriceRule) {
  return [rule.environment, rule.furnitureType, rule.furnitureModel, rule.priceProfile].filter(Boolean).length
}

function matches(ruleValue: string | null | undefined, inputValue: string | null | undefined) {
  return !ruleValue || normalizeText(ruleValue) === normalizeText(inputValue)
}

export function serializeQuotePriceRule(rule: PrismaQuotePriceRule): QuotePriceRule {
  return {
    id: rule.id,
    name: rule.name,
    environment: rule.environment,
    furnitureType: rule.furnitureType,
    furnitureModel: rule.furnitureModel,
    priceProfile: rule.priceProfile,
    calculationMode: rule.calculationMode as QuoteCalculationMode,
    pricePerM2: rule.pricePerM2,
    materialCostPerM2: rule.materialCostPerM2,
    validFrom: rule.validFrom.toISOString(),
    validUntil: rule.validUntil?.toISOString() || null,
    active: rule.active,
  }
}

export async function ensureDefaultQuoteSettings(db: PriceRuleStore & Pick<PrismaClient, 'materialCatalogItem'>) {
  const [priceRuleCount, materialCount] = await Promise.all([
    db.quotePriceRule.count(),
    db.materialCatalogItem.count(),
  ])

  if (priceRuleCount === 0) {
    await db.quotePriceRule.createMany({
      data: DEFAULT_PRICE_RULES.map((rule) => ({ ...rule, active: true })),
    })
  }

  if (materialCount === 0) {
    await db.materialCatalogItem.createMany({
      data: [
        { name: 'MDF', category: 'Painel', defaultFinish: 'Branco TX', unit: 'm2', unitCost: 650, supplier: null, active: true },
        { name: 'MDF madeirado', category: 'Painel', defaultFinish: 'Madeirado', unit: 'm2', unitCost: 750, supplier: null, active: true },
        { name: 'Fita de borda', category: 'Acabamento', defaultFinish: null, unit: 'metro', unitCost: 0, supplier: null, active: true },
        { name: 'Ferragens', category: 'Ferragens', defaultFinish: null, unit: 'unidade', unitCost: 0, supplier: null, active: true },
      ],
    })
  }
}

export async function getActiveQuotePriceRules(db: PriceRuleStore, at = new Date()): Promise<QuotePriceRule[]> {
  const rules = await db.quotePriceRule.findMany({
    where: {
      active: true,
      validFrom: { lte: at },
      OR: [{ validUntil: null }, { validUntil: { gte: at } }],
    },
    orderBy: [{ validFrom: 'desc' }, { updatedAt: 'desc' }],
  })

  return rules.map(serializeQuotePriceRule)
}

export function findQuotePriceRule(
  item: QuotePricingRuleInput,
  rules: QuotePriceRule[] = [],
  at = new Date()
) {
  const candidates = rules.filter((rule) => {
    const validFrom = dateValue(rule.validFrom)
    const validUntil = dateValue(rule.validUntil)
    if (rule.active === false || (validFrom && validFrom > at) || (validUntil && validUntil < at)) return false

    return (
      matches(rule.environment, item.environment) &&
      matches(rule.furnitureType, item.furnitureType) &&
      matches(rule.furnitureModel, item.furnitureModel || item.description) &&
      matches(rule.priceProfile, item.priceProfile)
    )
  })

  return candidates.sort((a, b) => {
    const specificityDifference = ruleSpecificity(b) - ruleSpecificity(a)
    if (specificityDifference) return specificityDifference
    return (dateValue(b.validFrom)?.getTime() || 0) - (dateValue(a.validFrom)?.getTime() || 0)
  })[0] || null
}
