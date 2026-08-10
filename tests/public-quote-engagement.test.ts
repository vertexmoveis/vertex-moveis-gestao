import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLIC_QUOTE_VIEW_INTERVAL_MS,
  shouldTrackPublicQuoteView,
} from '@/lib/public-quote-engagement'

test('conta a primeira visualização confirmada da proposta', () => {
  assert.equal(shouldTrackPublicQuoteView(0, Date.now()), true)
})

test('não repete a visualização da mesma proposta dentro de 24 horas', () => {
  const now = Date.now()
  assert.equal(shouldTrackPublicQuoteView(now - PUBLIC_QUOTE_VIEW_INTERVAL_MS + 1, now), false)
  assert.equal(shouldTrackPublicQuoteView(now - PUBLIC_QUOTE_VIEW_INTERVAL_MS, now), true)
})
