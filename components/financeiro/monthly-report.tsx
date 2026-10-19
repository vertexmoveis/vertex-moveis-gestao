import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, CircleX, Handshake } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { dateOnlyKeyInTimeZone, formatDateOnly } from '@/lib/date-only'

type ReportItem = { id: string; source: string; contractId?: string; projectId: string | null; quoteId: string | null; groupId: string | null; title: string; clientName: string; amount: number; eventDate: string | null; status: string; lossReason?: string | null }
type ReportBucket = { count: number; amount: number; items: ReportItem[] }
export type MonthlyReportData = {
  month: string
  sold: ReportBucket
  lost: ReportBucket
  negotiating: ReportBucket
  potentialTotal: number
  asOf?: string
  undatedLossCount?: number
  semantics?: { negotiating?: string; sold?: string; lost?: string } | string
}

function itemLink(item: ReportItem) {
  if (item.projectId) return `/dashboard/projects/${item.projectId}`
  if (item.quoteId) return `/dashboard/quotes/${item.quoteId}`
  if (item.contractId) return `/dashboard/sales?origin=direct&contractId=${encodeURIComponent(item.contractId)}`
  return '/dashboard/quotes'
}

function ReportList({ title, description, bucket, tone }: { title: string; description: string; bucket: ReportBucket; tone: 'green' | 'blue' | 'red' }) {
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'red' ? CircleX : Handshake
  const textClass = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-blue-700'
  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Icon size={17} className={textClass} />{title}</h3><span className="rounded-full bg-[#F5F5F5] px-2 py-1 text-xs font-semibold">{bucket.count}</span></div><p className="mt-2 text-xs leading-relaxed text-[#666]">{description}</p></CardHeader><CardBody><p className={cn('mb-4 text-2xl font-bold', textClass)}>{formatCurrency(bucket.amount)}</p>{bucket.items.length === 0 ? <p className="py-6 text-center text-xs text-[#666]">Nenhum registro neste período.</p> : <div className="divide-y divide-[#EDEDED]">{bucket.items.map((item) => <Link key={`${item.source}-${item.id}`} href={itemLink(item)} className="group block py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold group-hover:text-[#C65000]">{item.clientName}</p><p className="mt-1 break-words text-xs text-[#666]">{item.title}</p>{item.source === 'CONTRACT' ? <span className="mt-1 inline-block rounded bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-800">Venda sem orçamento</span> : null}</div><ArrowUpRight size={14} className="mt-0.5 shrink-0 text-[#777]" /></div><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span className="text-[#666]">{item.eventDate ? formatDateOnly(item.eventDate) : 'Data não informada'}</span><span className="font-semibold">{formatCurrency(item.amount)}</span></div>{item.lossReason ? <p className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-800">Motivo: {item.lossReason}</p> : null}</Link>)}</div>}</CardBody></Card>
}

export function MonthlyReport({ data, monthLabel }: { data: MonthlyReportData; monthLabel: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold capitalize">Vendas de {monthLabel}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#666]">Vendido mostra os negócios fechados. Em negociação mostra as oportunidades que ainda podem virar venda. O caixa depende dos recebimentos registrados.</p>
              {data.asOf ? <p className="mt-2 text-[11px] text-[#666]">Posição em {formatDateOnly(dateOnlyKeyInTimeZone(new Date(data.asOf)))}.</p> : null}
            </div>
            <div className="rounded-xl bg-orange-50 px-5 py-4 sm:min-w-60">
              <p className="text-xs font-semibold text-orange-800">Vendido + potencial de venda</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">{formatCurrency(data.potentialTotal)}</p>
              <p className="mt-1 text-[11px] text-orange-800">Perdas não entram neste total.</p>
            </div>
          </div>
        </CardBody>
      </Card>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <ReportList title="Vendido" description="Negócios fechados no mês selecionado." bucket={data.sold} tone="green" />
        <ReportList title="Em negociação" description="Carteira em aberto no período, que ainda pode ser fechada." bucket={data.negotiating} tone="blue" />
        <ReportList title="Perdido" description="Negócios encerrados sem venda no mês selecionado." bucket={data.lost} tone="red" />
      </div>
      {typeof data.semantics === 'string' ? <p className="text-xs leading-relaxed text-[#666]">{data.semantics}</p> : data.semantics?.negotiating ? <p className="text-xs leading-relaxed text-[#666]">{data.semantics.negotiating}</p> : null}
      {data.undatedLossCount ? <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{data.undatedLossCount} opção(ões) perdida(s) sem data de encerramento não foram atribuídas a um mês.</p> : null}
    </div>
  )
}
