export const PROJECT_FILE_CATEGORIES = [
  'MEASUREMENT',
  'TECHNICAL_PROJECT',
  'PRODUCTION',
  'INSTALLATION',
  'DELIVERY',
  'WARRANTY',
  'OTHER',
] as const

export type ProjectFileCategory = typeof PROJECT_FILE_CATEGORIES[number]

export const PROJECT_FILE_CATEGORY_LABELS: Record<ProjectFileCategory, string> = {
  MEASUREMENT: 'Medição',
  TECHNICAL_PROJECT: 'Projeto técnico',
  PRODUCTION: 'Produção',
  INSTALLATION: 'Instalação',
  DELIVERY: 'Entrega',
  WARRANTY: 'Assistência e garantia',
  OTHER: 'Outros arquivos',
}

export const ALLOWED_PROJECT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

export const PROJECT_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
export const PROJECT_FILE_MAX_SIZE = 25 * 1024 * 1024

export function isProjectFileCategory(value: string): value is ProjectFileCategory {
  return PROJECT_FILE_CATEGORIES.includes(value as ProjectFileCategory)
}

export function isAllowedProjectFileType(value: string) {
  return ALLOWED_PROJECT_FILE_TYPES.includes(value as typeof ALLOWED_PROJECT_FILE_TYPES[number])
}

export function isHeicProjectFile(type: string, name = '') {
  const normalizedType = type.toLowerCase()
  return normalizedType === 'image/heic' || normalizedType === 'image/heif' || /\.hei[cf]$/i.test(name)
}

export function sanitizeProjectFileName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  return normalized || 'arquivo'
}

export function projectFileExtension(value: string) {
  return value.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || ''
}

export function projectFileDisplayName(value: string) {
  const extension = projectFileExtension(value)
  return extension ? value.slice(0, -extension.length) : value
}

export function projectFileContentDisposition(name: string, download = false) {
  const fallbackName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\\r\n]/g, '_')
    .slice(0, 180) || 'arquivo'
  const encodedName = encodeURIComponent(name.replace(/[\r\n]/g, '') || 'arquivo')

  return `${download ? 'attachment' : 'inline'}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
}

export function normalizeProjectFileDisplayName(value: string, originalName: string) {
  const extension = projectFileExtension(originalName)
  const cleaned = value
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')

  const typedExtension = projectFileExtension(cleaned)
  const baseName = (typedExtension ? cleaned.slice(0, -typedExtension.length) : cleaned)
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim()

  if (!baseName) return ''
  return `${baseName.slice(0, Math.max(1, 180 - extension.length)).trim()}${extension}`
}

export function isProjectBlobUrl(url: string, projectId: string) {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.private.blob.vercel-storage.com') &&
      parsed.pathname.startsWith(`/projects/${projectId}/`)
    )
  } catch {
    return false
  }
}
