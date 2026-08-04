import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isQuoteImageBlobUrl,
  isQuoteImageType,
  sanitizeQuoteImageName,
} from '../lib/quote-images'

test('aceita somente imagens compativeis com o PDF', () => {
  assert.equal(isQuoteImageType('image/jpeg'), true)
  assert.equal(isQuoteImageType('image/png'), true)
  assert.equal(isQuoteImageType('image/webp'), true)
  assert.equal(isQuoteImageType('application/pdf'), false)
  assert.equal(isQuoteImageType('image/svg+xml'), false)
})

test('limpa o nome sem perder a extensao', () => {
  assert.equal(sanitizeQuoteImageName('Cozinha principal (versao 2).png'), 'Cozinha-principal-versao-2.png')
})

test('impede imagem de outro orcamento ou armazenamento', () => {
  const groupId = 'grupo-123'
  assert.equal(isQuoteImageBlobUrl(`https://store.public.blob.vercel-storage.com/quotes/${groupId}/cozinha.png`, groupId), true)
  assert.equal(isQuoteImageBlobUrl('https://example.com/quotes/grupo-123/cozinha.png', groupId), false)
  assert.equal(isQuoteImageBlobUrl('https://store.public.blob.vercel-storage.com/quotes/outro/cozinha.png', groupId), false)
})
