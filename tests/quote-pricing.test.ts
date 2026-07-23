import assert from 'node:assert/strict'
import test from 'node:test'
import { getQuoteAutomaticPricing } from '@/lib/quote-pricing'

test('aplica R$ 2.200 por m² aos móveis madeirados', () => {
  const kitchen = getQuoteAutomaticPricing({
    environment: 'Cozinha',
    priceProfile: 'WOODGRAIN',
  })
  const bedroom = getQuoteAutomaticPricing({
    environment: 'Dormitório',
    furnitureType: 'Guarda-roupa',
    priceProfile: 'WOODGRAIN',
  })

  assert.equal(kitchen.rate, 2200)
  assert.equal(bedroom.rate, 2200)
})

test('aplica R$ 3.800 por m² à cozinha provençal', () => {
  const pricing = getQuoteAutomaticPricing({
    environment: 'Cozinha',
    priceProfile: 'PROVENCAL',
  })

  assert.equal(pricing.rate, 3800)
})

test('mantém a laca externa em R$ 4.800 por m²', () => {
  const pricing = getQuoteAutomaticPricing({
    environment: 'Cozinha',
    priceProfile: 'EXTERNAL_LACQUER',
  })

  assert.equal(pricing.rate, 4800)
})
