import { roundCurrency } from '@/lib/payments'

type QuoteItemForMaterials = {
  material: string | null
  finish: string | null
  calculationMode: string
  areaM2: number
  width: number
  quantity: number
  cost: number
}

export type ProjectMaterialDraft = {
  materialName: string
  finish: string | null
  unit: string
  estimatedQuantity: number
  estimatedCost: number
}

function quantityForItem(item: QuoteItemForMaterials) {
  if (item.calculationMode === 'LINEAR_METER') return (item.width / 100) * item.quantity
  if (item.calculationMode === 'UNIT') return item.quantity
  return item.areaM2
}

function unitForItem(item: QuoteItemForMaterials) {
  if (item.calculationMode === 'LINEAR_METER') return 'metro'
  if (item.calculationMode === 'UNIT') return 'unidade'
  return 'm2'
}

export function buildProjectMaterialsFromQuoteItems(items: QuoteItemForMaterials[]): ProjectMaterialDraft[] {
  const grouped = new Map<string, ProjectMaterialDraft>()

  for (const item of items) {
    const materialName = item.material?.trim() || 'MDF'
    const finish = item.finish?.trim() || null
    const unit = unitForItem(item)
    const key = [materialName.toLocaleLowerCase('pt-BR'), finish?.toLocaleLowerCase('pt-BR') || '', unit].join('|')
    const existing = grouped.get(key)
    const quantity = Math.max(quantityForItem(item), 0)

    if (existing) {
      existing.estimatedQuantity = roundCurrency(existing.estimatedQuantity + quantity)
      existing.estimatedCost = roundCurrency(existing.estimatedCost + Math.max(item.cost || 0, 0))
      continue
    }

    grouped.set(key, {
      materialName,
      finish,
      unit,
      estimatedQuantity: roundCurrency(quantity),
      estimatedCost: roundCurrency(Math.max(item.cost || 0, 0)),
    })
  }

  return [...grouped.values()].sort((a, b) => a.materialName.localeCompare(b.materialName, 'pt-BR'))
}
