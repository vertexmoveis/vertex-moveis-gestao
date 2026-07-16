export const PROJECT_FILE_CATEGORIES = [
  'MEASUREMENT',
  'TECHNICAL_PROJECT',
  'PRODUCTION',
  'INSTALLATION',
  'DELIVERY',
  'OTHER',
] as const

export type ProjectFileCategory = typeof PROJECT_FILE_CATEGORIES[number]

export const PROJECT_FILE_CATEGORY_LABELS: Record<ProjectFileCategory, string> = {
  MEASUREMENT: 'Medição',
  TECHNICAL_PROJECT: 'Projeto técnico',
  PRODUCTION: 'Produção',
  INSTALLATION: 'Instalação',
  DELIVERY: 'Entrega',
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
