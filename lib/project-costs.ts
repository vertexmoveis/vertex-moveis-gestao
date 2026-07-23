import type { NumericValue } from '@/lib/money'
import { numberValue } from '@/lib/money'

export type ProjectMaterialCost = {
  estimatedCost: NumericValue
  actualCost: NumericValue
}

export type ProjectExpenseCost = {
  amount: NumericValue
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
  estimatedCost: NumericValue,
  materials: ProjectMaterialCost[],
  expenses: ProjectExpenseCost[] = [],
): ProjectCostSummary {
  const baseCost = Math.max(numberValue(estimatedCost), 0)
  const tracked = materials.filter((material) => material.actualCost !== null)
  const materialAdjustment = tracked.reduce(
    (total, material) => total + Math.max(numberValue(material.actualCost), 0) - Math.max(numberValue(material.estimatedCost), 0),
    0,
  )
  const actualExpenses = expenses.reduce(
    (total, expense) => total + Math.max(numberValue(expense.amount), 0),
    0,
  )

  return {
    estimatedCost: roundCurrency(baseCost),
    adjustedCost: roundCurrency(Math.max(baseCost + materialAdjustment + actualExpenses, 0)),
    materialAdjustment: roundCurrency(materialAdjustment),
    actualMaterials: roundCurrency(tracked.reduce((total, material) => total + Math.max(numberValue(material.actualCost), 0), 0)),
    actualExpenses: roundCurrency(actualExpenses),
    totalExpenses: expenses.length,
    trackedMaterials: tracked.length,
    totalMaterials: materials.length,
    hasActualCosts: tracked.length > 0 || expenses.length > 0,
  }
}
