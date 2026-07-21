export type ProjectMaterialCost = {
  estimatedCost: number | null
  actualCost: number | null
}

export type ProjectExpenseCost = {
  amount: number | null
}

export type ProjectCostSummary = {
  estimatedCost: number
  adjustedCost: number
  materialAdjustment: number
  actualMaterials: number
  actualExpenses: number
  totalExpenses: number
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
  expenses: ProjectExpenseCost[] = [],
): ProjectCostSummary {
  const baseCost = Math.max(Number(estimatedCost) || 0, 0)
  const tracked = materials.filter((material) => material.actualCost !== null)
  const materialAdjustment = tracked.reduce(
    (total, material) => total + Math.max(Number(material.actualCost) || 0, 0) - Math.max(Number(material.estimatedCost) || 0, 0),
    0,
  )
  const actualExpenses = expenses.reduce(
    (total, expense) => total + Math.max(Number(expense.amount) || 0, 0),
    0,
  )

  return {
    estimatedCost: roundCurrency(baseCost),
    adjustedCost: roundCurrency(Math.max(baseCost + materialAdjustment + actualExpenses, 0)),
    materialAdjustment: roundCurrency(materialAdjustment),
    actualMaterials: roundCurrency(tracked.reduce((total, material) => total + Math.max(Number(material.actualCost) || 0, 0), 0)),
    actualExpenses: roundCurrency(actualExpenses),
    totalExpenses: expenses.length,
    trackedMaterials: tracked.length,
    totalMaterials: materials.length,
    hasActualCosts: tracked.length > 0 || expenses.length > 0,
  }
}
