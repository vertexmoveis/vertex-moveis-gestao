import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { ArrowRight, CheckCircle, Clock, Target, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { Header } from '@/components/layout/header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { moneyValue } from '@/lib/money'
import { QUOTE_STATUS_BG, QUOTE_STATUS_LABELS, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type DashboardUser = { id?: string; role?: string; name?: string }

function getMonthRange(value?: string) {
  const now = new Date()
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  const year = match ? Number(match[1]) : now.getFullYear()
  const month = match ? Number(match[2]) - 1 : now.getMonth()
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear()
  const safeMonth = month >= 0 && month <= 11 ? month : now.getMonth()
  const start = new Date(safeYear, safeMonth, 1)
  const end = new Date(safeYear, safeMonth + 1, 1)

  return {
    key: `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}`,
    start,
    end,
  }
}

async function getSalesData(user: DashboardUser, range: ReturnType<typeof getMonthRange>, requestedSeller?: string) {
  const isAdmin = user.role === 'ADMIN'
  const sellerScope: Prisma.QuoteWhereInput = {
    archivedAt: null,
    ...(isAdmin
      ? requestedSeller ? { createdById: requestedSeller } : {}
      : { createdById: user.id || '__sem_usuario__' }),
  }

  const [funnelRows, soldTotals, lostTotals, waitingQuotes, sellerRows, sellers] = await Promise.all([
    prisma.quote.groupBy({
      by: ['status'],
      where: { ...sellerScope, createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.quote.aggregate({
      where: { ...sellerScope, status: 'SOLD', soldAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
      _sum: { total: true, costTotal: true },
    }),
    prisma.quote.aggregate({
      where: { ...sellerScope, status: 'LOST', lostAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    }),
    prisma.quote.findMany({
      where: { ...sellerScope, status: 'WAITING_APPROVAL' },
      select: {
        id: true,
        title: true,
        total: true,
        sentAt: true,
        client: { select: { name: true } },
        approvalRequests: {
          where: { approvedAt: null, rejectedAt: null },
          orderBy: { sentAt: 'asc' },
          take: 1,
          select: { sentAt: true },
        },
      },
      orderBy: { sentAt: 'asc' },
      take: 8,
    }),
    prisma.quote.groupBy({
      by: ['createdById'],
      where: { ...sellerScope, status: 'SOLD', soldAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 8,
    }),
    isAdmin
      ? prisma.user.findMany({
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const counts = QUOTE_STATUSES.reduce<Record<QuoteStatus, number>>((result, status) => {
    result[status] = 0
    return result
  }, {} as Record<QuoteStatus, number>)
  const amounts = QUOTE_STATUSES.reduce<Record<QuoteStatus, number>>((result, status) => {
    result[status] = 0
    return result
  }, {} as Record<QuoteStatus, number>)

  for (const row of funnelRows) {
    const status = row.status as QuoteStatus
    if (!QUOTE_STATUSES.includes(status)) continue
    counts[status] = row._count._all
    amounts[status] = moneyValue(row._sum.total)
  }

  const sellerNames = new Map(sellers.map((seller) => [seller.id, seller.name]))
  const sellerRanking = sellerRows.map((row) => ({
    id: row.createdById || 'sem-vendedor',
    name: row.createdById ? sellerNames.get(row.createdById) || 'Vendedor removido' : 'Sem vendedor',
    count: row._count._all,
    total: moneyValue(row._sum.total),
  }))
  const totalCreated = Object.values(counts).reduce((total, count) => total + count, 0)
  const closedCount = soldTotals._count._all + lostTotals._count._all

  return {
    isAdmin,
    sellers,
    counts,
    amounts,
    totalCreated,
    soldCount: soldTotals._count._all,
    soldTotal: moneyValue(soldTotals._sum.total),
    soldCost: moneyValue(soldTotals._sum.costTotal),
    lostCount: lostTotals._count._all,
    conversion: closedCount > 0 ? Math.round((soldTotals._count._all / closedCount) * 100) : 0,
    waitingQuotes: waitingQuotes.map((quote) => ({
      ...quote,
      sentAt: quote.approvalRequests[0]?.sentAt || quote.sentAt,
    })),
    sellerRanking,
  }
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; seller?: string }> }) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams])
  const user = (session?.user as DashboardUser | undefined) || {}
  const range = getMonthRange(params.month)
  const data = await getSalesData(user, range, params.seller)
  const selectedSeller = data.isAdmin && params.seller ? params.seller : ''

  return (
    <div className="flex h-full flex-col">
      <Header title="Vendas" subtitle="Funil comercial, retornos e resultado por vendedor" userName={user.name || ''} />
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E8E8E8] bg-white p-4">
          <label className="grid gap-1 text-xs font-semibold text-[#555]">
            Mês
            <input name="month" type="month" defaultValue={range.key} className="h-10 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212]" />
          </label>
          {data.isAdmin ? (
            <label className="grid min-w-52 gap-1 text-xs font-semibold text-[#555]">
              Vendedor
              <select name="seller" defaultValue={selectedSeller} className="h-10 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212]">
                <option value="">Todos os vendedores</option>
                {data.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
            </label>
          ) : null}
          <button type="submit" className="h-10 rounded-lg bg-[#121212] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2A2A2A]">Atualizar</button>
        </form>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={TrendingUp} label="Vendido no mês" value={formatCurrency(data.soldTotal)} detail={`${data.soldCount} venda${data.soldCount !== 1 ? 's' : ''} fechada${data.soldCount !== 1 ? 's' : ''}`} tone="green" />
          <Metric icon={Target} label="Conversão" value={`${data.conversion}%`} detail={`${data.soldCount} ganho${data.soldCount !== 1 ? 's' : ''} e ${data.lostCount} perdido${data.lostCount !== 1 ? 's' : ''}`} tone="orange" />
          <Metric icon={Clock} label="Aguardando retorno" value={data.counts.WAITING_APPROVAL} detail="Orçamentos enviados ao cliente" tone="blue" />
          <Metric icon={Wallet} label="Custo das vendas" value={formatCurrency(data.soldCost)} detail="Projetos fechados neste mês" tone="gray" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#121212]">Funil do mês</h2>
                  <p className="mt-1 text-xs text-[#9E9E9E]">{data.totalCreated} orçamento{data.totalCreated !== 1 ? 's' : ''} iniciado{data.totalCreated !== 1 ? 's' : ''} no período</p>
                </div>
                <Link href="/dashboard/quotes" className="flex items-center gap-1 text-xs font-semibold text-[#FF6B00] hover:underline">Orçamentos <ArrowRight size={13} /></Link>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {QUOTE_STATUSES.map((status) => {
                const count = data.counts[status]
                const percentage = data.totalCreated > 0 ? Math.round((count / data.totalCreated) * 100) : 0
                return (
                  <div key={status} className="grid grid-cols-[minmax(130px,1fr)_minmax(70px,auto)] items-center gap-3 sm:grid-cols-[170px_1fr_110px]">
                    <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', QUOTE_STATUS_BG[status])}>{QUOTE_STATUS_LABELS[status]}</span>
                    <div className="hidden h-2 overflow-hidden rounded-full bg-[#F2F2F2] sm:block"><div className="h-full rounded-full bg-[#FF6B00]" style={{ width: `${percentage}%` }} /></div>
                    <span className="text-right text-xs font-semibold text-[#555]">{count} · {formatCurrency(data.amounts[status])}</span>
                  </div>
                )
              })}
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#121212]">{data.isAdmin ? 'Resultado por vendedor' : 'Meu resultado'}</h2>
                  <p className="mt-1 text-xs text-[#9E9E9E]">Vendas fechadas no período</p>
                </div>
                <Users size={17} className="text-[#9E9E9E]" />
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {data.sellerRanking.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[#9E9E9E]">Nenhuma venda fechada neste mês.</p>
              ) : (
                <div className="divide-y divide-[#F0F0F0]">
                  {data.sellerRanking.map((seller, index) => (
                    <div key={seller.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-xs font-bold text-[#555]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#121212]">{seller.name}</p>
                        <p className="mt-0.5 text-xs text-[#9E9E9E]">{seller.count} venda{seller.count !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(seller.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#121212]">Retornos para cobrar</h2>
                <p className="mt-1 text-xs text-[#9E9E9E]">Clientes que ainda não aprovaram o orçamento</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{data.waitingQuotes.length}</span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {data.waitingQuotes.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5 text-sm text-emerald-700">
                <CheckCircle size={18} />
                Não há orçamento aguardando aprovação.
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {data.waitingQuotes.map((quote) => (
                  <Link key={quote.id} href={`/dashboard/quotes/${quote.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAFAFA]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Clock size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#121212] group-hover:text-[#FF6B00]">{quote.client.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#777]">{quote.title}</span>
                    </span>
                    <span className="hidden text-right text-xs text-[#9E9E9E] sm:block">Enviado em {quote.sentAt ? formatDate(quote.sentAt) : '-'}</span>
                    <span className="text-sm font-bold text-[#121212]">{formatCurrency(quote.total)}</span>
                    <ArrowRight size={15} className="shrink-0 text-[#BDBDBD] transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF6B00]" />
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string | number; detail: string; tone: 'green' | 'orange' | 'blue' | 'gray' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-[#FF6B00]',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-[#F5F5F5] text-[#555]',
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={17} /></span>
          <p className="text-xl font-bold text-[#121212]">{value}</p>
        </div>
        <p className="mt-4 text-xs font-semibold text-[#555]">{label}</p>
        <p className="mt-1 text-[11px] text-[#9E9E9E]">{detail}</p>
      </CardBody>
    </Card>
  )
}
