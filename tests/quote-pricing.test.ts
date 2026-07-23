import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_QUOTE_INTERNAL_FINISH,
  QUOTE_INTERNAL_FINISHES,
  QUOTE_PRICE_PROFILE_LABELS,
  getQuoteAutomaticPricing,
} from '@/lib/quote-pricing'

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
  assert.equal(kitchen.label, 'Cozinha madeirada externa')
  assert.equal(bedroom.label, 'Armário de quarto madeirado externo')
})

test('aplica R$ 3.800 por m² à cozinha provençal', () => {
  const pricing = getQuoteAutomaticPricing({
    environment: 'Cozinha',
    priceProfile: 'PROVENCAL',
  })

  assert.equal(pricing.rate, 3800)
  assert.equal(pricing.label, 'Cozinha provençal externa')
})

test('mantém a laca externa em R$ 4.800 por m²', () => {
  const pricing = getQuoteAutomaticPricing({
    environment: 'Cozinha',
    priceProfile: 'EXTERNAL_LACQUER',
  })

  assert.equal(pricing.rate, 4800)
})

test('separa acabamento externo do acabamento interno padrão', () => {
  assert.equal(QUOTE_PRICE_PROFILE_LABELS.WOODGRAIN, 'Madeirado externo')
  assert.equal(QUOTE_PRICE_PROFILE_LABELS.PROVENCAL, 'Provençal externo')
  assert.equal(DEFAULT_QUOTE_INTERNAL_FINISH, 'Branco interno')
  assert.deepEqual(QUOTE_INTERNAL_FINISHES, ['Branco interno', 'Madeirado interno'])
})
