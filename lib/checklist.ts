import type { Prisma, ProjectChecklistItem } from '@prisma/client'
import { prisma } from '@/lib/db'

export const DEFAULT_PROJECT_CHECKLIST = [
  'Medição',
  'Projeto técnico',
  'Produção',
  'Entrega e instalação',
]

const LEGACY_PRODUCTION_STEPS = ['Corte', 'Fita e acabamento', 'Montagem', 'Embalagem']
const LEGACY_FINAL_STEPS = ['Entrega', 'Instalação']

type ChecklistDb = Prisma.TransactionClient | typeof prisma
type ChecklistItem = Pick<ProjectChecklistItem, 'id' | 'label' | 'position' | 'completedAt' | 'createdAt' | 'updatedAt'>

export function buildDefaultChecklistItems() {
  return DEFAULT_PROJECT_CHECKLIST.map((label, index) => ({
    label,
    position: index + 1,
  }))
}

function latestCompletedAt(items: { completedAt: Date | null }[]) {
  return items
    .map((item) => item.completedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null
}

function completionFor(label: string, existing: ChecklistItem[]) {
  const byLabel = existing.filter((item) => item.label === label)
  if (byLabel.length > 0) return latestCompletedAt(byLabel)

  if (label === 'Produção') {
    const productionSteps = existing.filter((item) => LEGACY_PRODUCTION_STEPS.includes(item.label))
    if (productionSteps.length === 0) return null
    return productionSteps.every((item) => item.completedAt) ? latestCompletedAt(productionSteps) : null
  }

  if (label === 'Entrega e instalação') {
    const installedStep = existing.find((item) => item.label === 'Instalação')
    if (installedStep?.completedAt) return installedStep.completedAt

    const finalSteps = existing.filter((item) => LEGACY_FINAL_STEPS.includes(item.label))
    if (finalSteps.length === LEGACY_FINAL_STEPS.length && finalSteps.every((item) => item.completedAt)) {
      return latestCompletedAt(finalSteps)
    }
  }

  return null
}

function checklistIsCurrent(items: ChecklistItem[]) {
  return (
    items.length === DEFAULT_PROJECT_CHECKLIST.length &&
    DEFAULT_PROJECT_CHECKLIST.every((label, index) => items[index]?.label === label && items[index]?.position === index + 1)
  )
}

export async function ensureProjectChecklist(
  projectId: string,
  db: ChecklistDb = prisma,
  knownItems?: ChecklistItem[]
) {
  const existing =
    knownItems || await db.projectChecklistItem.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    })

  if (checklistIsCurrent(existing)) return existing

  await db.projectChecklistItem.deleteMany({ where: { projectId } })

  await db.projectChecklistItem.createMany({
    data: DEFAULT_PROJECT_CHECKLIST.map((label, index) => ({
      projectId,
      label,
      position: index + 1,
      completedAt: completionFor(label, existing),
    })),
  })

  return db.projectChecklistItem.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
  })
}
