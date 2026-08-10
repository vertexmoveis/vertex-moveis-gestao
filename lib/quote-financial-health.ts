type QuoteFinancialWarning = {
  key: 'MISSING_COST' | 'LOW_MARGIN' | 'LOSS' | 'HIGH_DISCOUNT' | 'FALLBACK_PRICE'
  severity: 'warning' | 'critical'
  message: string
}

export function evaluateQuoteFinancialHealth(input: {
  subtotal: number
  total: number
  costTotal: number
  manualDiscount: number
  fallbackPricedItems?: number
}) {
  const warnings: QuoteFinancialWarning[] = []
  const marginPercent = input.total > 0
    ? ((input.total - input.costTotal) / input.total) * 100
    : 0
  const discountPercent = input.subtotal > 0
    ? (input.manualDiscount / input.subtotal) * 100
    : 0

  if (input.costTotal <= 0) {
    warnings.push({
      key: 'MISSING_COST',
      severity: 'critical',
      message: 'O custo está zerado. Confira os materiais antes de enviar ao cliente.',
    })
  } else if (input.total <= input.costTotal) {
    warnings.push({
      key: 'LOSS',
      severity: 'critical',
      message: 'Este orçamento está sem lucro ou com prejuízo.',
    })
  } else if (marginPercent < 25) {
    warnings.push({
      key: 'LOW_MARGIN',
      severity: 'warning',
      message: `A margem prevista está em ${marginPercent.toFixed(1).replace('.', ',')}%, abaixo dos 25% recomendados.`,
    })
  }

  if (discountPercent > 10) {
    warnings.push({
      key: 'HIGH_DISCOUNT',
      severity: discountPercent > 20 ? 'critical' : 'warning',
      message: `O desconto comercial representa ${discountPercent.toFixed(1).replace('.', ',')}% do subtotal.`,
    })
  }

  if ((input.fallbackPricedItems || 0) > 0) {
    warnings.push({
      key: 'FALLBACK_PRICE',
      severity: 'warning',
      message: `${input.fallbackPricedItems} ${input.fallbackPricedItems === 1 ? 'móvel usa' : 'móveis usam'} o preço padrão por falta de uma regra específica.`,
    })
  }

  return {
    marginPercent,
    discountPercent,
    warnings,
    requiresConfirmation: warnings.some((warning) => warning.severity === 'critical'),
  }
}
