import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateQuoteFinancialHealth } from '../lib/quote-financial-health'

test('orçamento saudável não exige confirmação', () => {
  const result = evaluateQuoteFinancialHealth({
    subtotal: 10_000,
    total: 10_000,
    costTotal: 6_000,
    manualDiscount: 0,
  })
  assert.equal(result.requiresConfirmation, false)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.marginPercent, 40)
})

test('custo zerado e prejuízo protegem o orçamento', () => {
  const withoutCost = evaluateQuoteFinancialHealth({ subtotal: 10_000, total: 10_000, costTotal: 0, manualDiscount: 0 })
  assert.equal(withoutCost.requiresConfirmation, true)
  assert.equal(withoutCost.warnings[0]?.key, 'MISSING_COST')

  const loss = evaluateQuoteFinancialHealth({ subtotal: 10_000, total: 5_000, costTotal: 6_000, manualDiscount: 5_000 })
  assert.equal(loss.requiresConfirmation, true)
  assert.deepEqual(loss.warnings.map((warning) => warning.key), ['LOSS', 'HIGH_DISCOUNT'])
})

test('margem baixa, desconto e preço padrão geram avisos claros', () => {
  const result = evaluateQuoteFinancialHealth({
    subtotal: 10_000,
    total: 8_800,
    costTotal: 7_000,
    manualDiscount: 1_200,
    fallbackPricedItems: 2,
  })
  assert.equal(result.requiresConfirmation, false)
  assert.deepEqual(result.warnings.map((warning) => warning.key), ['LOW_MARGIN', 'HIGH_DISCOUNT', 'FALLBACK_PRICE'])
})
