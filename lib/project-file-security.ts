import { get } from '@vercel/blob'
import {
  isAllowedProjectFileType,
  PROJECT_FILE_MAX_SIZE,
} from '@/lib/project-files'

export type ProjectFileSecurityStatus = 'PENDING' | 'TYPE_CHECKED' | 'CLEAN' | 'REJECTED' | 'ERROR'

type ScanResponse = {
  clean?: boolean
  status?: string
  threat?: string
  message?: string
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export function matchesProjectFileSignature(type: string, bytes: Uint8Array) {
  if (type === 'application/pdf') return ascii(bytes, 0, 5) === '%PDF-'
  if (type === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (type === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (type === 'image/webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP'
  if (type === 'image/heic' || type === 'image/heif') {
    const brand = ascii(bytes, 8, 4)
    return ascii(bytes, 4, 4) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)
  }
  return false
}

export function projectFileRetentionDays() {
  const configuredDays = Number.parseInt(process.env.PROJECT_FILE_RETENTION_DAYS || '0', 10)
  if (!Number.isFinite(configuredDays) || configuredDays <= 0) return null
  return Math.min(configuredDays, 3650)
}

export function projectFileExpiryDate(createdAt = new Date()) {
  const days = projectFileRetentionDays()
  if (!days) return null
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000)
}

async function scanWithConfiguredProvider(input: {
  bytes: Uint8Array
  name: string
  contentType: string
}) {
  const configuredUrl = process.env.FILE_SCAN_WEBHOOK_URL?.trim()
  if (!configuredUrl) return { status: 'TYPE_CHECKED' as const, details: 'Formato e assinatura conferidos.' }
  const url = new URL(configuredUrl)
  if (url.protocol !== 'https:') {
    return { status: 'ERROR' as const, details: 'O scanner deve usar HTTPS.' }
  }

  const form = new FormData()
  const fileBuffer = new ArrayBuffer(input.bytes.byteLength)
  new Uint8Array(fileBuffer).set(input.bytes)
  form.set('file', new Blob([fileBuffer], { type: input.contentType }), input.name)
  const response = await fetch(url, {
    method: 'POST',
    headers: process.env.FILE_SCAN_WEBHOOK_SECRET
      ? { 'X-Vertex-Secret': process.env.FILE_SCAN_WEBHOOK_SECRET }
      : {},
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => ({})) as ScanResponse
  if (!response.ok) {
    return {
      status: 'ERROR' as const,
      details: (payload.message || `Scanner respondeu com status ${response.status}.`).slice(0, 500),
    }
  }
  const clean = payload.clean === true || payload.status?.toLowerCase() === 'clean'
  if (clean) return { status: 'CLEAN' as const, details: 'Arquivo verificado pelo scanner configurado.' }
  return {
    status: 'REJECTED' as const,
    details: (payload.threat || payload.message || 'O scanner rejeitou o arquivo.').slice(0, 500),
  }
}

export async function inspectProjectBlob(input: {
  url: string
  expectedType: string
  name: string
}) {
  try {
    const result = await get(input.url, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) {
      return { size: null, status: 'ERROR' as const, details: 'Arquivo não encontrado no armazenamento.' }
    }
    if (result.blob.size > PROJECT_FILE_MAX_SIZE) {
      await result.stream.cancel()
      return { size: result.blob.size, status: 'REJECTED' as const, details: 'Arquivo acima do limite permitido.' }
    }

    const contentType = (result.blob.contentType || input.expectedType).split(';')[0].trim().toLowerCase()
    if (!isAllowedProjectFileType(contentType) || contentType !== input.expectedType.toLowerCase()) {
      await result.stream.cancel()
      return { size: result.blob.size, status: 'REJECTED' as const, details: 'O conteúdo não corresponde ao tipo informado.' }
    }

    const scannerConfigured = Boolean(process.env.FILE_SCAN_WEBHOOK_URL?.trim())
    let bytes: Uint8Array
    if (scannerConfigured) {
      bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
    } else {
      const reader = result.stream.getReader()
      const firstChunk = await reader.read()
      bytes = firstChunk.value || new Uint8Array()
      await reader.cancel()
    }

    if (!matchesProjectFileSignature(contentType, bytes)) {
      return { size: result.blob.size, status: 'REJECTED' as const, details: 'Assinatura interna do arquivo inválida.' }
    }

    const scan = await scanWithConfiguredProvider({ bytes, name: input.name, contentType })
    return { size: result.blob.size, ...scan }
  } catch (error) {
    return {
      size: null,
      status: 'ERROR' as const,
      details: (error instanceof Error ? error.message : 'Falha ao verificar o arquivo.').slice(0, 500),
    }
  }
}
