export type ProjectMaterialCost = {
  estimatedCost: number | null
  actualCost: number | null
}

export type ProjectCostSummary = {
  estimatedCost: number
  adjustedCost: number
  materialAdjustment: number
  actualMaterials: number
  trackedMaterials: number
  totalMaterials: number
  hasActualCosts: boolean
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateProjectCostSummary(
  estimatedCost: number | null | undefined,
  materials: ProjectMaterialCost[],
): ProjectCostSummary {
  const baseCost = Math.max(Number(estimatedCost) || 0, 0)
  const tracked = materials.filter((material) => material.actualCost !== null)
  const materialAdjustment = tracked.reduce(
    (total, material) => total + Math.max(Number(material.actualCost) || 0, 0) - Math.max(Number(material.estimatedCost) || 0, 0),
    0,
  )

  return {
    estimatedCost: roundCurrency(baseCost),
    adjustedCost: roundCurrency(Math.max(baseCost + materialAdjustment, 0)),
    materialAdjustment: roundCurrency(materialAdjustment),
    actualMaterials: roundCurrency(tracked.reduce((total, material) => total + Math.max(Number(material.actualCost) || 0, 0), 0)),
    trackedMaterials: tracked.length,
    totalMaterials: materials.length,
    hasActualCosts: tracked.length > 0,
  }
}
