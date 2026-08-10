import assert from 'node:assert/strict'
import test from 'node:test'
import { selectCompanyPresentationImages } from '@/lib/company-presentation'

const images = [
  { id: 'general', environmentName: 'Todos os ambientes', position: 0, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'bedroom', environmentName: 'Dormitório', position: 0, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'kitchen-second', environmentName: 'Cozinha', position: 2, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'kitchen-first', environmentName: 'Cozinha', position: 1, createdAt: '2026-08-01T10:00:00.000Z' },
]

test('prioriza fotos do mesmo ambiente e usa o portfólio geral como apoio', () => {
  const selected = selectCompanyPresentationImages(images, ['Cozinha'], 3)
  assert.deepEqual(selected.map((image) => image.id), ['kitchen-first', 'kitchen-second', 'general'])
})

test('reconhece nomes detalhados de ambientes', () => {
  const selected = selectCompanyPresentationImages(images, ['Dormitório da filha'], 2)
  assert.deepEqual(selected.map((image) => image.id), ['bedroom', 'general'])
})

test('mantém uma apresentação útil quando não há foto específica', () => {
  const selected = selectCompanyPresentationImages(images, ['Área gourmet'], 2)
  assert.deepEqual(selected.map((image) => image.id), ['general', 'bedroom'])
})
