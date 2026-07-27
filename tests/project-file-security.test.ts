import assert from 'node:assert/strict'
import test from 'node:test'
import {
  matchesProjectFileSignature,
  projectFileExpiryDate,
} from '@/lib/project-file-security'

function bytes(value: string) {
  return new TextEncoder().encode(value)
}

test('aceita somente assinaturas internas compativeis com o tipo do arquivo', () => {
  assert.equal(matchesProjectFileSignature('application/pdf', bytes('%PDF-1.7')), true)
  assert.equal(matchesProjectFileSignature('application/pdf', bytes('<html>')), false)
  assert.equal(matchesProjectFileSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true)
  assert.equal(
    matchesProjectFileSignature(
      'image/png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  )
  assert.equal(matchesProjectFileSignature('image/webp', bytes('RIFF0000WEBP')), true)
  assert.equal(matchesProjectFileSignature('image/heic', bytes('0000ftypheic')), true)
})

test('retencao fica desativada por padrao e respeita o periodo configurado', () => {
  const previous = process.env.PROJECT_FILE_RETENTION_DAYS
  const createdAt = new Date('2026-07-27T12:00:00.000Z')

  delete process.env.PROJECT_FILE_RETENTION_DAYS
  assert.equal(projectFileExpiryDate(createdAt), null)

  process.env.PROJECT_FILE_RETENTION_DAYS = '30'
  assert.equal(projectFileExpiryDate(createdAt)?.toISOString(), '2026-08-26T12:00:00.000Z')

  if (previous === undefined) delete process.env.PROJECT_FILE_RETENTION_DAYS
  else process.env.PROJECT_FILE_RETENTION_DAYS = previous
})
