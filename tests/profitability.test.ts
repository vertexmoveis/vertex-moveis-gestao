import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProfitabilityReport } from '@/lib/profitability'

test('distribui receita e custo real entre ambientes e moveis', () => {
  const report = buildProfitabilityReport([
    {
      id: 'project-1',
      name: 'Casa completa',
      value: 12000,
      productionCost: 4000,
      client: { name: 'Cliente Teste' },
      materials: [
        { estimatedCost: 1000, actualCost: 1200 },
        { estimatedCost: 500, actualCost: null },
      ],
      expenses: [{ amount: 300 }],
      sourceQuote: {
        items: [
          {
            environment: 'Cozinha',
            environmentName: 'Cozinha',
            description: 'Gabinete',
            furnitureType: 'Gabinetes',
            furnitureModel: 'Gabinete de pia',
            cost: 1500,
            total: 8000,
          },
          {
            environment: 'Dormitorio',
            environmentName: 'Dormitorio casal',
            description: 'Armario',
            furnitureType: 'Armarios',
            furnitureModel: 'Armario com portas',
            cost: 500,
            total: 4000,
          },
        ],
      },
    },
  ])

  assert.equal(report.totalProjects, 1)
  assert.equal(report.actualCostProjects, 1)
  assert.equal(report.projects[0].actualCost, 4500)
  assert.equal(report.projects[0].profit, 7500)
  assert.equal(report.projects[0].margin, 62.5)

  assert.equal(report.byEnvironment[0].label, 'Cozinha')
  assert.equal(report.byEnvironment[0].revenue, 8000)
  assert.equal(report.byEnvironment[0].actualCost, 3375)
  assert.equal(report.byFurniture[1].label, 'Armario com portas')
  assert.equal(report.byFurniture[1].revenue, 4000)
})

test('mantem o projeto no relatorio mesmo quando nao veio de um orcamento', () => {
  const report = buildProfitabilityReport([
    {
      id: 'project-2',
      name: 'Projeto manual',
      value: 5000,
      productionCost: 2000,
      client: { name: 'Cliente Manual' },
      materials: [],
      expenses: [],
      sourceQuote: null,
    },
  ])

  assert.equal(report.projects[0].profit, 3000)
  assert.equal(report.byEnvironment.length, 0)
  assert.equal(report.byFurniture.length, 0)
})
