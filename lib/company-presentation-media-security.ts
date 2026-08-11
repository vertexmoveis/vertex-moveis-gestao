import { get } from '@vercel/blob'
import {
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  isCompanyPresentationVideoType,
} from '@/lib/company-presentation-images'

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export function matchesPresentationMediaSignature(type: string, bytes: Uint8Array) {
  if (type === 'video/mp4') return ascii(bytes, 4, 4) === 'ftyp'
  if (type === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  return false
}

export async function inspectCompanyPresentationMedia(input: {
  url: string
  expectedType: string
  name: string
}) {
  try {
    const result = await get(input.url, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) {
      return { size: null, status: 'ERROR' as const, details: 'Arquivo não encontrado no armazenamento.' }
    }

    const contentType = (result.blob.contentType || input.expectedType).split(';')[0].trim().toLowerCase()
    if (!isCompanyPresentationVideoType(contentType) || contentType !== input.expectedType.toLowerCase()) {
      await result.stream.cancel()
      return { size: result.blob.size, status: 'REJECTED' as const, details: 'O conteúdo não corresponde ao tipo informado.' }
    }
    if (result.blob.size > COMPANY_PRESENTATION_VIDEO_MAX_SIZE) {
      await result.stream.cancel()
      return {
        size: result.blob.size,
        status: 'REJECTED' as const,
        details: `O vídeo ultrapassa o limite de ${COMPANY_PRESENTATION_VIDEO_MAX_SIZE / 1024 / 1024} MB.`,
      }
    }

    const reader = result.stream.getReader()
    const firstChunk = await reader.read()
    const bytes = firstChunk.value || new Uint8Array()
    await reader.cancel()
    if (!matchesPresentationMediaSignature(contentType, bytes)) {
      return { size: result.blob.size, status: 'REJECTED' as const, details: 'Assinatura interna do arquivo inválida.' }
    }

    return {
      size: result.blob.size,
      status: 'TYPE_CHECKED' as const,
      details: 'Formato e assinatura conferidos.',
    }
  } catch (error) {
    return {
      size: null,
      status: 'ERROR' as const,
      details: (error instanceof Error ? error.message : 'Falha ao verificar o arquivo.').slice(0, 500),
    }
  }
}
