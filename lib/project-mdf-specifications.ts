import type { ProjectMdfSide, ProjectMdfSpecification } from '@/types'
import { QUOTE_PRICE_PROFILE_LABELS, safeQuotePriceProfile } from '@/lib/quote-pricing'

export const PROJECT_MDF_SIDES: { value: ProjectMdfSide; label: string }[] = [
  { value: 'EXTERNAL', label: 'Externo' },
  { value: 'INTERNAL', label: 'Interno' },
]

export const PROJECT_MDF_APPLICATIONS = [
  'Portas',
  'Frentes de gaveta',
  'Caixaria',
  'Painel',
  'Nicho',
  'Prateleiras',
  'Tamponamento',
  'Rodapé',
]

export const PROJECT_MDF_SUGGESTIONS = [
  'MDF Branco TX',
  'MDF Branco Diamante',
  'MDF Off White',
  'MDF Madeirado',
  'MDF Cinza',
  'MDF Preto',
  'MDF Ultra',
]

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''
}

export function normalizeProjectMdfSpecifications(value: unknown): ProjectMdfSpecification[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const result: ProjectMdfSpecification[] = []

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const id = cleanText(item.id, 80)
    const application = cleanText(item.application, 120)
    const mdf = cleanText(item.mdf, 160)
    const side: ProjectMdfSide = item.side === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL'
    const notes = cleanText(item.notes, 240) || null
    if (!id || !application || !mdf || seen.has(id)) continue
    seen.add(id)
    result.push({ id, application, side, mdf, notes })
    if (result.length === 30) break
  }

  return result
}

type QuoteMdfSourceItem = {
  description: string
  placement?: string | null
  material?: string | null
  finish?: string | null
  priceProfile?: string | null
}

export function buildProjectMdfSpecificationsFromQuoteItems(items: QuoteMdfSourceItem[]) {
  const specifications: Omit<ProjectMdfSpecification, 'id'>[] = []
  const seen = new Set<string>()

  const add = (specification: Omit<ProjectMdfSpecification, 'id'>) => {
    const key = [specification.application, specification.side, specification.mdf, specification.notes]
      .map((value) => (value || '').toLocaleLowerCase('pt-BR'))
      .join('|')
    if (!seen.has(key) && specifications.length < 30) {
      seen.add(key)
      specifications.push(specification)
    }
  }

  for (const item of items) {
    const material = item.material?.trim() || 'MDF'
    const externalFinish = QUOTE_PRICE_PROFILE_LABELS[safeQuotePriceProfile(item.priceProfile)]
    add({
      application: item.description,
      side: 'EXTERNAL',
      mdf: `${material} ${externalFinish}`,
      notes: item.placement?.trim() || null,
    })
  }

  const internalFinishes = [...new Set(items.map((item) => item.finish?.trim()).filter((finish): finish is string => Boolean(finish)))]
  for (const finish of internalFinishes) {
    add({
      application: 'Caixaria interna',
      side: 'INTERNAL',
      mdf: finish.toLocaleLowerCase('pt-BR').startsWith('mdf ') ? finish : `MDF ${finish}`,
      notes: null,
    })
  }

  return specifications.map((specification, index) => ({
    id: `mdf-${index + 1}`,
    ...specification,
  }))
}
