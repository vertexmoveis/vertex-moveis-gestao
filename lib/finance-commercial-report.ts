import { dateOnlyKeyInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { moneyValue, type NumericValue } from '@/lib/money'

type ReportDate = Date | string | null | undefined

export type FinanceCommercialProject = {
  id: string
  name: string
  value: NumericValue
  approvalDate?: ReportDate
  startDate?: ReportDate
  createdAt: Date | string
  archivedAt?: ReportDate
  client: { name: string }
  sourceQuote?: { id: string; groupId: string } | null
}

export type FinanceCommercialQuote = {
  id: string
  groupId: string
  title: string
  number?: number
  variationOrder: number
  status: string
  total: NumericValue
  convertedProjectId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  archivedAt?: ReportDate
  sentAt?: ReportDate
  approvedAt?: ReportDate
  soldAt?: ReportDate
  lostAt?: ReportDate
  lossReason?: string | null
  client: { name: string }
  revisions?: Array<{ snapshot: string; createdAt: Date | string }>
}

export type FinanceCommercialItem = {
  id: string
  source: 'PROJECT' | 'QUOTE'
  projectId: string | null
  quoteId: string | null
  groupId: string | null
  title: string
  clientName: string
  amount: number
  eventDate: string
  status: string
  lossReason: string | null
}

type ReportBucket = { count: number; amount: number; items: FinanceCommercialItem[] }

function timestamp(value: ReportDate) {
  if (!value) return null
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

export function financeCommercialMonth(value: string | null | undefined, now = new Date()) {
  const key = value && /^(\d{4})-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2000
    ? value
    : dateOnlyKeyInTimeZone(now).slice(0, 7)
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const nextKey = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`
  return {
    key,
    start: startOfDateInTimeZone(`${key}-01`)!,
    end: startOfDateInTimeZone(`${nextKey}-01`)!,
  }
}

function bucket(items: FinanceCommercialItem[]): ReportBucket {
  const sorted = [...items].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.title.localeCompare(b.title, 'pt-BR'))
  return {
    count: sorted.length,
    amount: moneyValue(sorted.reduce((sum, item) => sum + item.amount, 0)),
    items: sorted,
  }
}

function priorSnapshot(quote: FinanceCommercialQuote, before: number) {
  const revisions = (quote.revisions || [])
    .filter((revision) => (timestamp(revision.createdAt) ?? Infinity) < before)
    .sort((a, b) => (timestamp(b.createdAt) || 0) - (timestamp(a.createdAt) || 0))
  for (const revision of revisions) {
    try {
      const parsed: unknown = JSON.parse(revision.snapshot)
      if (parsed && typeof parsed === 'object') {
        const snapshot = parsed as { status?: unknown; totals?: { total?: unknown } }
        return {
          status: typeof snapshot.status === 'string' ? snapshot.status : null,
          total: typeof snapshot.totals?.total === 'number' ? moneyValue(snapshot.totals.total) : null,
        }
      }
    } catch {
      // Old or malformed revision records must not break a financial report.
    }
  }
  return null
}

const OPEN_STATUSES = ['APPROVED', 'WAITING_APPROVAL', 'SENT']

function quoteAtCutoff(quote: FinanceCommercialQuote, cutoff: number, historical: boolean) {
  const createdAt = timestamp(quote.createdAt)
  if (createdAt === null || createdAt >= cutoff || quote.archivedAt) return null
  const soldAt = timestamp(quote.soldAt)
    ?? (quote.status === 'SOLD' ? timestamp(quote.approvedAt) ?? createdAt : null)
  const lostAt = timestamp(quote.lostAt)
  const snapshot = historical ? priorSnapshot(quote, cutoff) : null
  const amount = snapshot?.total ?? moneyValue(quote.total)

  if (soldAt !== null && soldAt < cutoff) return { quote, status: 'SOLD', event: soldAt, amount }
  if (quote.status === 'LOST' && lostAt !== null && lostAt < cutoff) return { quote, status: 'LOST', event: lostAt, amount }
  if (!historical || (timestamp(quote.updatedAt) ?? Infinity) < cutoff) {
    return { quote, status: quote.status, event: timestamp(quote.sentAt) ?? createdAt, amount }
  }

  // Status-only changes have no complete audit trail. A dated send or saved
  // revision is evidence of a previous opportunity, not an exact ledger snapshot.
  const sentAt = timestamp(quote.sentAt)
  const approvedAt = timestamp(quote.approvedAt)
  const openStatus = approvedAt !== null && approvedAt < cutoff
    ? 'APPROVED'
    : sentAt !== null && sentAt < cutoff
      ? 'SENT'
      : snapshot?.status
  return { quote, status: openStatus || 'DRAFT', event: sentAt ?? createdAt, amount }
}

export function buildFinanceCommercialReport(input: {
  month: string
  projects: FinanceCommercialProject[]
  quotes: FinanceCommercialQuote[]
  now?: Date
  query?: string
}) {
  const now = input.now || new Date()
  const month = financeCommercialMonth(input.month, now)
  const start = month.start.getTime()
  const end = month.end.getTime()
  const cutoff = Math.min(end, now.getTime() + 1)
  const historical = end <= now.getTime()
  const isInMonth = (date: number) => date >= start && date < end && date < cutoff
  const soldItems: FinanceCommercialItem[] = []
  const lostItems: FinanceCommercialItem[] = []
  const negotiatingItems: FinanceCommercialItem[] = []
  const soldGroupIds = new Set<string>()
  const projectIds = new Set<string>()

  for (const project of input.projects) {
    if (project.archivedAt || projectIds.has(project.id)) continue
    projectIds.add(project.id)
    // A start in another month must never move an approved sale to that month.
    const event = timestamp(project.approvalDate) ?? timestamp(project.startDate) ?? timestamp(project.createdAt)
    if (event === null || event >= cutoff) continue
    const groupId = project.sourceQuote?.groupId || null
    if (groupId) soldGroupIds.add(groupId)
    if (!isInMonth(event) || project.value === null || project.value === undefined) continue
    soldItems.push({
      id: project.id, source: 'PROJECT', projectId: project.id,
      quoteId: project.sourceQuote?.id || null, groupId,
      title: project.name, clientName: project.client.name,
      amount: moneyValue(project.value), eventDate: new Date(event).toISOString(),
      status: 'SOLD', lossReason: null,
    })
  }

  const groups = new Map<string, NonNullable<ReturnType<typeof quoteAtCutoff>>[]>()
  let undatedLossCount = 0
  for (const quote of input.quotes) {
    const candidate = quoteAtCutoff(quote, cutoff, historical)
    if (!candidate) continue
    if (quote.status === 'LOST' && !quote.lostAt) undatedLossCount += 1
    const list = groups.get(quote.groupId) || []
    list.push(candidate)
    groups.set(quote.groupId, list)
  }

  function quoteItem(candidate: NonNullable<ReturnType<typeof quoteAtCutoff>>, event = candidate.event): FinanceCommercialItem {
    const quote = candidate.quote
    return {
      id: quote.id, source: 'QUOTE', projectId: quote.convertedProjectId || null,
      quoteId: quote.id, groupId: quote.groupId,
      title: quote.title, clientName: quote.client.name,
      amount: candidate.amount, eventDate: new Date(event).toISOString(),
      status: candidate.status, lossReason: candidate.status === 'LOST' ? quote.lossReason || null : null,
    }
  }

  for (const [groupId, options] of groups) {
    if (soldGroupIds.has(groupId)) continue
    const ordered = [...options].sort((a, b) => a.quote.variationOrder - b.quote.variationOrder || a.quote.id.localeCompare(b.quote.id))
    const sold = ordered.find((option) => option.status === 'SOLD')
    if (sold) {
      // A converted quote is represented by its project even when the project
      // is archived or its event date falls outside this reporting window.
      if (!sold.quote.convertedProjectId && isInMonth(sold.event)) soldItems.push(quoteItem(sold))
      continue
    }
    const open = ordered
      .filter((option) => OPEN_STATUSES.includes(option.status))
      .sort((a, b) => OPEN_STATUSES.indexOf(a.status) - OPEN_STATUSES.indexOf(b.status))[0]
    if (open && start < cutoff) {
      negotiatingItems.push(quoteItem(open))
      continue
    }
    if (ordered.every((option) => option.status === 'LOST' && timestamp(option.quote.lostAt) !== null)) {
      const lastLostAt = Math.max(...ordered.map((option) => timestamp(option.quote.lostAt)!))
      if (isInMonth(lastLostAt)) lostItems.push(quoteItem(ordered[0], lastLostAt))
    }
  }

  const search = (input.query || '').trim().slice(0, 120).toLocaleLowerCase('pt-BR')
  const matches = (item: FinanceCommercialItem) => !search || `${item.clientName} ${item.title}`.toLocaleLowerCase('pt-BR').includes(search)
  const sold = bucket(soldItems.filter(matches))
  const negotiating = bucket(negotiatingItems.filter(matches))
  return {
    month: month.key,
    sold,
    lost: bucket(lostItems.filter(matches)),
    negotiating,
    potentialTotal: moneyValue(sold.amount + negotiating.amount),
    asOf: new Date(cutoff - 1).toISOString(),
    historicalPipelineEstimated: historical,
    undatedLossCount,
    semantics: {
      sold: 'Vendas no mês pela data de aprovação do projeto; na falta dela, início e depois criação. Orçamento convertido conta uma vez pelo projeto.',
      lost: 'Negociações atualmente perdidas, com todas as opções encerradas, no mês da última perda registrada. Reaberturas podem remover esse registro; não representa inadimplência nem saída de caixa.',
      negotiating: historical
        ? 'Estimativa das propostas enviadas ainda abertas ao fim do mês, pelos registros disponíveis. Alterações de status não têm histórico completo.'
        : 'Propostas enviadas ainda abertas até agora, inclusive as iniciadas em meses anteriores. Rascunhos não entram.',
      potentialTotal: 'Vendido no mês mais propostas em negociação. Potencial comercial; não é dinheiro recebido.',
      variations: 'Cada negociação conta uma vez. Usa a opção aprovada ou em aceite; depois, a primeira opção enviada. Valores das opções não são somados.',
    },
  }
}
