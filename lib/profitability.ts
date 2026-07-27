import { calculateProjectCostSummary, type ProjectExpenseCost, type ProjectMaterialCost } from '@/lib/project-costs'
import { numberValue, type NumericValue } from '@/lib/money'

type ProfitabilityItem = {
  environment: string
  environmentName: string | null
  description: string
  furnitureType: string | null
  furnitureModel: string | null
  cost: NumericValue
  total: NumericValue
}

type ProfitabilityProject = {
  id: string
  name: string
  value: NumericValue
  productionCost: NumericValue
  client: { name: string }
  materials: ProjectMaterialCost[]
  expenses: ProjectExpenseCost[]
  sourceQuote: { items: ProfitabilityItem[] } | null
}

type ProfitabilityBucket = {
  label: string
  revenue: number
  estimatedCost: number
  actualCost: number
  profit: number
  margin: number
  projects: number
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function finishBucket(bucket: Omit<ProfitabilityBucket, 'profit' | 'margin'>): ProfitabilityBucket {
  const revenue = roundCurrency(bucket.revenue)
  const actualCost = roundCurrency(bucket.actualCost)
  const profit = roundCurrency(revenue - actualCost)
  return {
    ...bucket,
    revenue,
    estimatedCost: roundCurrency(bucket.estimatedCost),
    actualCost,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
  }
}

function addToBucket(
  buckets: Map<string, Omit<ProfitabilityBucket, 'profit' | 'margin'>>,
  label: string,
  projectId: string,
  revenue: number,
  estimatedCost: number,
  actualCost: number,
  seenProjects: Map<string, Set<string>>,
) {
  const current = buckets.get(label) || {
    label,
    revenue: 0,
    estimatedCost: 0,
    actualCost: 0,
    projects: 0,
  }
  current.revenue += revenue
  current.estimatedCost += estimatedCost
  current.actualCost += actualCost

  const projects = seenProjects.get(label) || new Set<string>()
  projects.add(projectId)
  seenProjects.set(label, projects)
  current.projects = projects.size
  buckets.set(label, current)
}

export function buildProfitabilityReport(projects: ProfitabilityProject[]) {
  const environmentBuckets = new Map<string, Omit<ProfitabilityBucket, 'profit' | 'margin'>>()
  const furnitureBuckets = new Map<string, Omit<ProfitabilityBucket, 'profit' | 'margin'>>()
  const environmentProjects = new Map<string, Set<string>>()
  const furnitureProjects = new Map<string, Set<string>>()

  const projectRows = projects.map((project) => {
    const revenue = Math.max(numberValue(project.value), 0)
    const costSummary = calculateProjectCostSummary(project.productionCost, project.materials, project.expenses)
    const actualCost = costSummary.adjustedCost
    const estimatedCost = Math.max(numberValue(project.productionCost), 0)
    const items = project.sourceQuote?.items || []
    const itemRevenueTotal = items.reduce((total, item) => total + Math.max(numberValue(item.total), 0), 0)
    const itemCostTotal = items.reduce((total, item) => total + Math.max(numberValue(item.cost), 0), 0)

    for (const item of items) {
      const rawRevenue = Math.max(numberValue(item.total), 0)
      const rawCost = Math.max(numberValue(item.cost), 0)
      const revenueWeight = itemRevenueTotal > 0 ? rawRevenue / itemRevenueTotal : 1 / Math.max(items.length, 1)
      const costWeight = itemCostTotal > 0 ? rawCost / itemCostTotal : revenueWeight
      const allocatedRevenue = revenue * revenueWeight
      const allocatedEstimatedCost = estimatedCost * costWeight
      const allocatedActualCost = actualCost * costWeight
      const environment = item.environmentName?.trim() || item.environment.trim() || 'Sem ambiente'
      const furniture = item.furnitureModel?.trim()
        || item.furnitureType?.trim()
        || item.description.trim()
        || 'Móvel não informado'

      addToBucket(
        environmentBuckets,
        environment,
        project.id,
        allocatedRevenue,
        allocatedEstimatedCost,
        allocatedActualCost,
        environmentProjects,
      )
      addToBucket(
        furnitureBuckets,
        furniture,
        project.id,
        allocatedRevenue,
        allocatedEstimatedCost,
        allocatedActualCost,
        furnitureProjects,
      )
    }

    const profit = roundCurrency(revenue - actualCost)
    return {
      id: project.id,
      name: project.name,
      clientName: project.client.name,
      revenue: roundCurrency(revenue),
      estimatedCost: roundCurrency(estimatedCost),
      actualCost: roundCurrency(actualCost),
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      hasActualCosts: costSummary.hasActualCosts,
    }
  })

  const finishBuckets = (buckets: Map<string, Omit<ProfitabilityBucket, 'profit' | 'margin'>>) => (
    [...buckets.values()]
      .map(finishBucket)
      .sort((a, b) => b.revenue - a.revenue)
  )

  return {
    projects: projectRows.sort((a, b) => b.revenue - a.revenue),
    byEnvironment: finishBuckets(environmentBuckets),
    byFurniture: finishBuckets(furnitureBuckets),
    totalProjects: projectRows.length,
    actualCostProjects: projectRows.filter((project) => project.hasActualCosts).length,
  }
}
