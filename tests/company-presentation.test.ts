import assert from 'node:assert/strict'
import test from 'node:test'
import { selectCompanyPresentationVideos } from '@/lib/company-presentation'
import { matchesPresentationMediaSignature } from '@/lib/company-presentation-media-security'
import {
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  presentationVideoContentType,
} from '@/lib/company-presentation-images'

const videos = [
  { id: 'general', environmentName: 'Todos os ambientes', mediaKind: 'VIDEO', position: 0, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'bedroom', environmentName: 'Dormitório', mediaKind: 'VIDEO', position: 0, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'kitchen-second', environmentName: 'Cozinha', mediaKind: 'VIDEO', position: 2, createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'kitchen-first', environmentName: 'Cozinha', mediaKind: 'VIDEO', position: 1, createdAt: '2026-08-01T10:00:00.000Z' },
]

test('prioriza vídeos do mesmo ambiente e usa os vídeos gerais como apoio', () => {
  const selected = selectCompanyPresentationVideos(videos, ['Cozinha'], 3)
  assert.deepEqual(selected.map((video) => video.id), ['kitchen-first', 'kitchen-second', 'general'])
})

test('reconhece nomes detalhados de ambientes', () => {
  const selected = selectCompanyPresentationVideos(videos, ['Dormitório da filha'], 2)
  assert.deepEqual(selected.map((video) => video.id), ['bedroom', 'general'])
})

test('mantém uma apresentação útil quando não há vídeo específico', () => {
  const selected = selectCompanyPresentationVideos(videos, ['Área gourmet'], 2)
  assert.deepEqual(selected.map((video) => video.id), ['general', 'bedroom'])
})

test('ignora mídias antigas que não são vídeos', () => {
  const selected = selectCompanyPresentationVideos([
    ...videos,
    { ...videos[0], id: 'legacy-photo', mediaKind: 'PORTFOLIO' },
  ], ['Todos os ambientes'], 10)
  assert.equal(selected.some((video) => video.id === 'legacy-photo'), false)
})

test('reconhece assinaturas de vídeo MP4 e WebM', () => {
  assert.equal(matchesPresentationMediaSignature('video/mp4', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])), true)
  assert.equal(matchesPresentationMediaSignature('video/webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), true)
  assert.equal(matchesPresentationMediaSignature('video/mp4', new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])), false)
})

test('identifica o tipo do vídeo pela extensão quando necessário', () => {
  assert.equal(presentationVideoContentType('cozinha.MP4', ''), 'video/mp4')
  assert.equal(presentationVideoContentType('closet.webm', ''), 'video/webm')
})

test('aceita vídeos de apresentação com até 300 MB', () => {
  assert.equal(COMPANY_PRESENTATION_VIDEO_MAX_SIZE, 300 * 1024 * 1024)
})
