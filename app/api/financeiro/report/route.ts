import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildFinanceCommercialReport, financeCommercialMonth } from '@/lib/finance-commercial-report'
import { getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { csvCell } from '@/lib/csv'
import { dateOnlyKeyInTimeZone, formatDateOnly } from '@/lib/date-only'

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:financeiro:report:${auth.user.id}:${getClientIp(req)}`, 80, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })

  const now = new Date()
  const month = financeCommercialMonth(req.nextUrl.searchParams.get('month'), now)
  const [projects, quotes, contracts] = await Promise.all([
    prisma.project.findMany({
      where: {
        archivedAt: null,
        OR: [
          { approvalDate: { lt: month.end } },
          { startDate: { lt: month.end } },
          { createdAt: { lt: month.end } },
        ],
      },
      select: {
        id: true, name: true, value: true,
        approvalDate: true, startDate: true, createdAt: true,
        client: { select: { name: true } },
        sourceQuote: { select: { id: true, groupId: true } },
      },
    }),
    prisma.quote.findMany({
      where: { archivedAt: null, createdAt: { lt: month.end } },
      select: {
        id: true, groupId: true, title: true, number: true,
        variationOrder: true, status: true, total: true,
        convertedProjectId: true, createdAt: true, updatedAt: true,
        sentAt: true, approvedAt: true, soldAt: true, lostAt: true, lossReason: true,
        client: { select: { name: true } },
        revisions: {
          where: { createdAt: { lt: month.end } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { snapshot: true, createdAt: true },
        },
      },
    }),
    prisma.projectContract.findMany({
      where: { createdAt: { lt: month.end }, OR: [{ projectId: null }, { clientId: { not: null } }] },
      select: {
        id: true, projectId: true, standaloneTitle: true, status: true, snapshot: true,
        createdAt: true, updatedAt: true, sentAt: true, viewedAt: true, signedAt: true, voidedAt: true, expiresAt: true,
        client: { select: { name: true } },
        project: { select: { id: true, name: true, value: true, createdAt: true, approvalDate: true, startDate: true, archivedAt: true, client: { select: { name: true } } } },
      },
    }),
  ])

  const report = buildFinanceCommercialReport({ month: month.key, projects, quotes, contracts, now, query: req.nextUrl.searchParams.get('q') || '' })
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const rows: Array<Array<string | number>> = [
      ['Relatório comercial', report.month],
      ['Posição em', report.asOf],
      ['Categoria', 'Quantidade', 'Valor (R$)'],
      ['Vendido no mês', report.sold.count, report.sold.amount.toFixed(2).replace('.', ',')],
      ['Perdido no mês', report.lost.count, report.lost.amount.toFixed(2).replace('.', ',')],
      ['Em negociação', report.negotiating.count, report.negotiating.amount.toFixed(2).replace('.', ',')],
      ['Vendido + potencial', report.sold.count + report.negotiating.count, report.potentialTotal.toFixed(2).replace('.', ',')],
      [],
      ['Categoria', 'Cliente', 'Projeto, proposta ou contrato', 'Valor (R$)', 'Data', 'Situação', 'Motivo da perda', 'Origem', 'Identificador'],
    ]
    for (const [label, category] of [
      ['Vendido', report.sold], ['Perdido', report.lost], ['Em negociação', report.negotiating],
    ] as const) {
      for (const item of category.items) {
        rows.push([
          label, item.clientName, item.title, item.amount.toFixed(2).replace('.', ','),
          formatDateOnly(dateOnlyKeyInTimeZone(new Date(item.eventDate))), item.status, item.lossReason || '', item.source, item.id,
        ])
      }
    }
    rows.push([], ['Critérios'])
    for (const description of Object.values(report.semantics)) rows.push([description])
    if (report.undatedLossCount) rows.push([`Opções perdidas sem data, não atribuídas a um mês: ${report.undatedLossCount}.`])
    return new NextResponse('\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio-comercial-${report.month}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json(report)
}
