import { get, put } from '@vercel/blob'
import convert from 'heic-convert'
import { COMPANY_PRESENTATION_IMAGE_PREFIX } from '@/lib/company-presentation-images'
import { matchesProjectFileSignature } from '@/lib/project-file-security'

export function presentationJpegName(name: string) {
  const baseName = name.replace(/\.(?:heic|heif)$/i, '').trim() || 'foto-apresentacao'
  return `${baseName}.jpg`
}

function safePathSegment(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'foto-apresentacao.jpg'
}

export async function convertPresentationHeicToJpeg(input: { url: string; name: string }) {
  const source = await get(input.url, { access: 'private', useCache: false })
  if (!source || source.statusCode !== 200) {
    throw new Error('A foto HEIC não foi encontrada no armazenamento.')
  }

  const bytes = new Uint8Array(await new Response(source.stream).arrayBuffer())
  const output = await convert({ buffer: bytes, format: 'JPEG', quality: 0.9 })
  if (!matchesProjectFileSignature('image/jpeg', output)) {
    throw new Error('Não foi possível gerar uma imagem compatível a partir da foto HEIC.')
  }

  const name = presentationJpegName(input.name)
  const blob = await put(
    `${COMPANY_PRESENTATION_IMAGE_PREFIX}converted/${safePathSegment(name)}`,
    Buffer.from(output),
    {
      access: 'private',
      addRandomSuffix: true,
      contentType: 'image/jpeg',
      cacheControlMaxAge: 31_536_000,
    },
  )

  return { name, type: 'image/jpeg' as const, url: blob.url, size: output.byteLength }
}
