import { NextRequest, NextResponse } from 'next/server'
import { requireRole, getClientIp, serviceUnavailable } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { getFinanceSettlements } from '@/lib/finance-settlement-service'
import { financeMonth } from '@/lib/finance-settlements'
import { csvCell } from '@/lib/csv'
import { formatDateOnly } from '@/lib/date-only'
import { paymentMethodLabel } from '@/lib/payment-methods'

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`finance:export:${auth.user.id}:${getClientIp(req)}`, 20, 60000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações.' }, { status: 429 })
  const report = await getFinanceSettlements(req.nextUrl.searchParams.get('month'), (req.nextUrl.searchParams.get('q') || '').slice(0, 120))
  const month = financeMonth(report.month)
  const money = (amount: number) => amount.toFixed(2).replace('.', ',')
  const sourceLabel: Record<string, string> = { CARD: 'Repasse do cartão', DIRECT: 'Pagamento do cliente', BOLETO_ADVANCE: 'Antecipação de boletos', LEGACY: 'Registro anterior' }
  const rows: Array<Array<string>> = [['Tipo', 'Cliente', 'Projeto', 'Data', 'Forma', 'Origem', 'Bruto', 'Taxa', 'Líquido', 'Saldo a acertar']]
  for (const project of report.projects) {
    if (project.remaining && !project.archivedAt) rows.push(['A acertar', project.clientName, project.name, '', project.paymentMethod === 'CARD' ? 'Cartão' : paymentMethodLabel(project.paymentMethod), '', '', '', '', money(project.remaining)])
    for (const receipt of project.receipts) {
      const date = new Date(receipt.receivedAt)
      if (receipt.reversedAt || date < month.start || date >= month.end) continue
      rows.push(['Recebido', project.clientName, project.name, formatDateOnly(date), paymentMethodLabel(receipt.method), sourceLabel[receipt.source] || receipt.source,
        money(receipt.amount), money(receipt.fee), money(receipt.amount - receipt.fee), ''])
    }
  }
  return new NextResponse('\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'), { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="recebimentos-${report.month}.csv"`,
  } })
}
