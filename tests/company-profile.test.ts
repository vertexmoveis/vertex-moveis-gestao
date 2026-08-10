import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeInstagramUrl } from '@/lib/company-profile'

test('normaliza usuário e link do Instagram da empresa', () => {
  assert.equal(normalizeInstagramUrl('@vertex.moveis'), 'https://www.instagram.com/vertex.moveis/')
  assert.equal(normalizeInstagramUrl('https://instagram.com/vertex_moveis/'), 'https://www.instagram.com/vertex_moveis/')
})

test('rejeita endereço que não pertence ao Instagram', () => {
  assert.equal(normalizeInstagramUrl('https://exemplo.com/vertex'), '')
  assert.equal(normalizeInstagramUrl('usuário inválido'), '')
})
