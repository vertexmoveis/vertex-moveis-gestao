import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFinanceCommercialReport,
  financeCommercialMonth,
  type FinanceCommercialContract,
  type FinanceCommercialProject,
  type FinanceCommercialQuote,
} from '@/lib/finance-commercial-report'

const now = new Date('2026-10-19T15:00:00Z')

function project(overrides: Partial<FinanceCommercialProject> = {}): FinanceCommercialProject {
  return {
    id: 'project-1', name: 'Cozinha', value: 50_000,
    approvalDate: '2026-10-02T12:00:00Z', createdAt: '2026-10-02T12:00:00Z',
    client: { name: 'Maria' }, ...overrides,
  }
}

function quote(overrides: Partial<FinanceCommercialQuote> = {}): FinanceCommercialQuote {
  return {
    id: 'quote-1', groupId: 'group-1', title: 'Armário', variationOrder: 0,
    status: 'SENT', total: 15_000,
    createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z',
    sentAt: '2026-09-12T12:00:00Z', client: { name: 'João' }, ...overrides,
  }
}

function contract(overrides: Partial<FinanceCommercialContract> = {}): FinanceCommercialContract {
  return {
    id: 'contract-paula', projectId: null, standaloneTitle: 'Cozinha',
    status: 'VIEWED', client: { name: 'Paula' },
    snapshot: JSON.stringify({ project: { name: 'Cozinha', value: 32_500 }, client: { name: 'Paula' } }),
    createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T13:00:00Z',
    sentAt: '2026-10-19T12:10:00Z', viewedAt: '2026-10-19T13:00:00Z',
    ...overrides,
  }
}

function report(projects: FinanceCommercialProject[] = [], quotes: FinanceCommercialQuote[] = [], month = '2026-10') {
  return buildFinanceCommercialReport({ month, projects, quotes, now })
}

test('aprovação define o mês da venda sem duplicar pelo início do projeto', () => {
  const sale = project({ approvalDate: '2026-09-20T12:00:00Z', startDate: '2026-10-03T12:00:00Z' })
  assert.equal(report([sale]).sold.amount, 0)
  assert.equal(report([sale], [], '2026-09').sold.amount, 50_000)
})

test('sem aprovação usa início, depois criação, e mantém centavos', () => {
  const result = report([
    project({ id: 'first', approvalDate: null, startDate: '2026-10-03T12:00:00Z', value: '0.10' }),
    project({ id: 'second', approvalDate: null, startDate: null, value: '0.20' }),
    project({ id: 'archived', archivedAt: '2026-10-04T12:00:00Z' }),
  ])
  assert.equal(result.sold.count, 2)
  assert.equal(result.sold.amount, 0.3)
})

test('projeto e orçamento convertido contam uma venda e eliminam opções alternativas', () => {
  const result = report([
    project({ sourceQuote: { id: 'sold', groupId: 'group-1' } }),
  ], [
    quote({ id: 'sold', status: 'SOLD', soldAt: '2026-10-02T12:00:00Z', convertedProjectId: 'project-1', total: 50_000 }),
    quote({ id: 'option-2', variationOrder: 1, total: 75_000 }),
    quote({ id: 'option-3', variationOrder: 2, status: 'LOST', lostAt: '2026-10-03T12:00:00Z' }),
  ])
  assert.equal(result.sold.count, 1)
  assert.equal(result.sold.amount, 50_000)
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.lost.count, 0)
  assert.equal(result.potentialTotal, 50_000)
})

test('venda de mês anterior não reaparece como potencial em opções não escolhidas', () => {
  const result = report([
    project({ approvalDate: '2026-09-20T12:00:00Z', sourceQuote: { id: 'sold', groupId: 'group-1' } }),
  ], [quote()])
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 0)
})

test('negociação inclui propostas anteriores abertas e usa uma opção por grupo', () => {
  const result = report([], [
    quote({ id: 'first', total: 15_000 }),
    quote({ id: 'second', variationOrder: 1, total: 20_000 }),
    quote({ id: 'draft', groupId: 'draft-group', status: 'DRAFT', sentAt: null }),
    quote({ id: 'future', groupId: 'future-group', createdAt: '2026-11-01T12:00:00Z' }),
  ])
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.negotiating.amount, 15_000)
  assert.equal(result.negotiating.items[0].id, 'first')
})

test('opção aprovada prevalece sobre a primeira opção apenas enviada', () => {
  const result = report([], [
    quote({ id: 'first' }),
    quote({ id: 'approved', status: 'APPROVED', variationOrder: 1, total: 20_000 }),
  ])
  assert.equal(result.negotiating.items[0].id, 'approved')
  assert.equal(result.potentialTotal, 20_000)
})

test('perda comercial exige todas as opções perdidas e usa a última data de perda', () => {
  const options = [
    quote({ id: 'first', status: 'LOST', lostAt: '2026-09-25T12:00:00Z', lossReason: 'Preço' }),
    quote({ id: 'second', status: 'LOST', variationOrder: 1, total: 25_000, lostAt: '2026-10-03T12:00:00Z' }),
  ]
  const result = report([], options)
  assert.equal(result.lost.count, 1)
  assert.equal(result.lost.amount, 15_000)
  assert.equal(result.lost.items[0].eventDate, '2026-10-03T12:00:00.000Z')
  assert.equal(result.lost.items[0].lossReason, 'Preço')
  assert.equal(result.potentialTotal, 0)
  assert.equal(report([], [options[0], quote({ id: 'active', variationOrder: 1 })]).lost.count, 0)
})

test('perda sem data não é atribuída falsamente ao mês de edição', () => {
  const result = report([], [quote({ status: 'LOST', lostAt: null, updatedAt: '2026-10-10T12:00:00Z' })])
  assert.equal(result.lost.count, 0)
  assert.equal(result.undatedLossCount, 1)
})

test('relatório histórico reconstrói proposta enviada antes de uma venda posterior', () => {
  const result = report([], [quote({
    status: 'SOLD', soldAt: '2026-10-02T12:00:00Z', convertedProjectId: 'future-project',
    updatedAt: '2026-10-02T12:00:00Z', total: 20_000,
    revisions: [{
      snapshot: JSON.stringify({ status: 'DRAFT', totals: { total: 15_000 } }),
      createdAt: '2026-09-12T12:00:00Z',
    }],
  })], '2026-09')
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.negotiating.amount, 15_000)
  assert.equal(result.historicalPipelineEstimated, true)
  assert.equal(result.asOf, '2026-10-01T02:59:59.999Z')
})

test('histórico tolera revisão inválida e não usa valores editados após o mês', () => {
  const result = report([], [quote({
    updatedAt: '2026-10-05T12:00:00Z', total: 30_000,
    revisions: [
      { snapshot: '{invalid', createdAt: '2026-09-20T12:00:00Z' },
      { snapshot: JSON.stringify({ status: 'SENT', totals: { total: 15_000 } }), createdAt: '2026-09-13T12:00:00Z' },
      { snapshot: JSON.stringify({ status: 'SENT', totals: { total: 30_000 } }), createdAt: '2026-10-05T12:00:00Z' },
    ],
  })], '2026-09')
  assert.equal(result.negotiating.amount, 15_000)
})

test('mês usa limites de São Paulo e a virada local da meia-noite', () => {
  const bounds = financeCommercialMonth('2026-10', now)
  assert.equal(bounds.start.toISOString(), '2026-10-01T03:00:00.000Z')
  assert.equal(bounds.end.toISOString(), '2026-11-01T03:00:00.000Z')
  const result = report([
    project({ id: 'september', approvalDate: '2026-10-01T02:59:59.999Z' }),
    project({ id: 'october', approvalDate: '2026-10-01T03:00:00Z' }),
  ])
  assert.equal(result.sold.count, 1)
  assert.equal(result.sold.items[0].id, 'october')
  assert.equal(financeCommercialMonth('2026-13', now).key, '2026-10')
  assert.equal(financeCommercialMonth(null, new Date('2026-11-01T01:00:00Z')).key, '2026-10')
})

test('potencial soma venda mais negociação e não inclui perda comercial', () => {
  const result = report([project()], [
    quote(),
    quote({ id: 'lost', groupId: 'lost-group', status: 'LOST', lostAt: '2026-10-04T12:00:00Z', total: 10_000 }),
  ])
  assert.equal(result.sold.amount, 50_000)
  assert.equal(result.negotiating.amount, 15_000)
  assert.equal(result.lost.amount, 10_000)
  assert.equal(result.potentialTotal, 65_000)
})

test('busca filtra listas e totais depois de eliminar as opções de uma venda', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, query: 'João',
    projects: [project({ sourceQuote: { id: 'sold', groupId: 'sold-group' } })],
    quotes: [
      quote(),
      quote({ id: 'sold-alternative', groupId: 'sold-group', client: { name: 'João' } }),
    ],
  })
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.potentialTotal, 15_000)
})

test('venda sem orçamento visualizada aparece uma vez como negociação, sem projeto', () => {
  const result = buildFinanceCommercialReport({ month: '2026-10', now, projects: [], quotes: [], contracts: [contract()] })
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.negotiating.amount, 32_500)
  assert.equal(result.negotiating.items[0].source, 'CONTRACT')
  assert.equal(result.negotiating.items[0].contractId, 'contract-paula')
  assert.equal(result.negotiating.items[0].clientName, 'Paula')
  assert.equal(result.negotiating.items[0].title, 'Cozinha')
  assert.equal(result.sold.count, 0)
  assert.equal(result.lost.count, 0)
  assert.equal(result.potentialTotal, 32_500)
})

test('contrato avulso assinado conta como vendido na assinatura e sai da negociação', () => {
  const signed = contract({
    status: 'SIGNED', createdAt: '2026-09-12T12:00:00Z', sentAt: '2026-09-12T13:00:00Z',
    signedAt: '2026-10-03T12:00:00Z',
  })
  const result = buildFinanceCommercialReport({ month: '2026-10', now, projects: [], quotes: [], contracts: [signed] })
  assert.equal(result.sold.count, 1)
  assert.equal(result.sold.amount, 32_500)
  assert.equal(result.sold.items[0].eventDate, '2026-10-03T12:00:00.000Z')
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.potentialTotal, 32_500)
})

test('contrato convertido e suas versões não duplicam o projeto no financeiro', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [project()], quotes: [],
    contracts: [
      contract({ id: 'old-version', projectId: 'project-1', status: 'VOID', voidedAt: '2026-10-01T12:00:00Z' }),
      contract({ id: 'signed-version', projectId: 'project-1', status: 'SIGNED', signedAt: '2026-10-02T12:00:00Z' }),
      contract({ id: 'viewed-version', projectId: 'project-1' }),
    ],
  })
  assert.equal(result.sold.count, 1)
  assert.equal(result.sold.amount, 50_000)
  assert.equal(result.sold.items[0].source, 'PROJECT')
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.lost.count, 0)
  assert.equal(result.potentialTotal, 50_000)
})

test('contrato de projeto vendido antes do mês não reaparece como negociação', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [project({ approvalDate: '2026-09-20T12:00:00Z' })], quotes: [],
    contracts: [contract({ projectId: 'project-1' })],
  })
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.potentialTotal, 0)
})

test('histórico mantém avulso enviado antes da assinatura e conversão posteriores', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-09', now, projects: [project()], quotes: [],
    contracts: [contract({
      projectId: 'project-1', status: 'SIGNED',
      createdAt: '2026-09-12T12:00:00Z', sentAt: '2026-09-12T13:00:00Z',
      signedAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
    })],
  })
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.negotiating.amount, 32_500)
  assert.equal(result.negotiating.items[0].source, 'CONTRACT')
})

test('histórico considera assinatura do avulso anterior à conversão do projeto', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-09', now, projects: [project()], quotes: [],
    contracts: [contract({
      projectId: 'project-1', status: 'SIGNED',
      createdAt: '2026-09-12T12:00:00Z', sentAt: '2026-09-12T13:00:00Z',
      signedAt: '2026-09-20T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
    })],
  })
  assert.equal(result.sold.count, 1)
  assert.equal(result.sold.amount, 32_500)
  assert.equal(result.sold.items[0].eventDate, '2026-09-20T12:00:00.000Z')
  assert.equal(result.negotiating.count, 0)
})

test('rascunho, contrato cancelado e expirado não viram negociação nem perda comercial', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [], quotes: [],
    contracts: [
      contract({ id: 'draft', status: 'DRAFT', sentAt: null, viewedAt: null }),
      contract({ id: 'void', status: 'VOID', voidedAt: '2026-10-19T14:00:00Z' }),
      contract({ id: 'cancelled', status: 'CANCELLED', voidedAt: '2026-10-19T14:00:00Z' }),
      contract({ id: 'expired', status: 'EXPIRED', expiresAt: '2026-10-18T12:00:00Z' }),
      contract({ id: 'expired-by-date', expiresAt: '2026-10-18T12:00:00Z' }),
    ],
  })
  assert.equal(result.sold.count, 0)
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.lost.count, 0)
  assert.equal(result.potentialTotal, 0)
})

test('contrato assinado após a validade ainda conta como venda pela assinatura', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [], quotes: [],
    contracts: [contract({ status: 'SIGNED', expiresAt: '2026-10-17T12:00:00Z', signedAt: '2026-10-19T14:00:00Z' })],
  })
  assert.equal(result.sold.count, 1)
  assert.equal(result.negotiating.count, 0)
})

test('busca do relatório inclui cliente e título dos contratos sem orçamento', () => {
  const input = {
    month: '2026-10', now, projects: [project()], quotes: [quote()],
    contracts: [contract(), contract({
      id: 'other-client', standaloneTitle: 'Quarto', client: { name: 'Ana' },
      snapshot: JSON.stringify({ project: { value: 10_000 } }),
    })],
  }
  for (const query of ['paula', ' COZINHA ']) {
    const result = buildFinanceCommercialReport({ ...input, projects: [], query })
    assert.equal(result.negotiating.count, 1)
    assert.equal(result.negotiating.amount, 32_500)
    assert.equal(result.negotiating.items[0].contractId, 'contract-paula')
    assert.equal(result.potentialTotal, 32_500)
  }
})

test('contrato usa nomes salvos no documento quando faltam título e cliente atuais', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [], quotes: [],
    contracts: [contract({ standaloneTitle: null, client: null })],
  })
  assert.equal(result.negotiating.count, 1)
  assert.equal(result.negotiating.items[0].clientName, 'Paula')
  assert.equal(result.negotiating.items[0].title, 'Cozinha')
})

test('documento malformado ou sem valor não gera total financeiro inventado', () => {
  const result = buildFinanceCommercialReport({
    month: '2026-10', now, projects: [], quotes: [],
    contracts: [
      contract({ id: 'malformed', snapshot: '{invalid' }),
      contract({ id: 'missing', snapshot: JSON.stringify({ project: {} }) }),
      contract({ id: 'invalid', snapshot: JSON.stringify({ project: { value: 'inválido' } }) }),
    ],
  })
  assert.equal(result.negotiating.count, 0)
  assert.equal(result.potentialTotal, 0)
})
