import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBeforeAfterPairs,
  selectCompanyPresentationImages,
  selectCompanyPresentationMedia,
} from '@/lib/company-presentation'
import { matchesPresentationMediaSignature } from '@/lib/company-presentation-media-security'

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

test('separa vídeos das fotos de portfólio', () => {
  const media = [
    { ...images[0], mediaKind: 'PORTFOLIO' },
    { ...images[1], id: 'video-bedroom', mediaKind: 'VIDEO' },
  ]
  const selected = selectCompanyPresentationMedia(media, ['Dormitório'], 'VIDEO', 2)
  assert.deepEqual(selected.map((item) => item.id), ['video-bedroom'])
})

test('monta apenas pares completos de antes e depois', () => {
  const media = [
    { ...images[2], id: 'before-kitchen', mediaKind: 'BEFORE', pairKey: 'Cozinha Silva' },
    { ...images[3], id: 'after-kitchen', mediaKind: 'AFTER', pairKey: 'Cozinha Silva' },
    { ...images[0], id: 'before-only', mediaKind: 'BEFORE', pairKey: 'Obra incompleta' },
  ]
  const pairs = buildBeforeAfterPairs(media, ['Cozinha'])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].title, 'Cozinha Silva')
  assert.equal(pairs[0].before.id, 'before-kitchen')
  assert.equal(pairs[0].after.id, 'after-kitchen')
})

test('reconhece assinaturas de vídeo MP4 e WebM', () => {
  assert.equal(matchesPresentationMediaSignature('video/mp4', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])), true)
  assert.equal(matchesPresentationMediaSignature('video/webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), true)
  assert.equal(matchesPresentationMediaSignature('video/mp4', new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])), false)
})
