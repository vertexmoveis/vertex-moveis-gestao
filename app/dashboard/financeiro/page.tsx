'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Clock, DollarSign, FileDown, Printer, ReceiptText, Search, TrendingUp, Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { paymentMethodLabel } from '@/lib/payment-methods'
import { formatDateOnly } from '@/lib/date-only'

type FinancePayment = {
  id: string
  projectId: string
  projectName: string
  clientName: string
  installmentNumber: number
  type: string
  amount: number
  dueDate: string
  paidAt: string | null
  paymentMethod: string | null
  status: 'RECEBIDO' | 'PENDENTE' | 'ATRASADO'
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type FinanceData = {
  month: string
  summary: {
    received: number
    receivable: number
    overdue: number
    sold: number
    cost: number
    profit: number
    future: number
  }
  payments: FinancePayment[]
  pagination: Pagination
}

const EMPTY_PAGINATION: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 1 }

const statusOptions = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'RECEBIDO', label: 'Recebidos' },
  { value: 'PENDENTE', label: 'Pendentes' },
  { value: 'ATRASADO', label: 'Atrasados' },
  { value: 'ENTRADAS', label: 'Entradas' },
  { value: 'PARCELAS', label: 'Parcelas' },
]

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function normalizeStatusKey(value?: string | null) {
  const statusFromUrl = value?.toUpperCase()
  return statusFromUrl && statusOptions.some((option) => option.value === statusFromUrl)
    ? statusFromUrl
    : 'TODOS'
}

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
}

function statusClass(status: FinancePayment['status']) {
  if (status === 'RECEBIDO') return 'bg-green-100 text-green-700'
  if (status === 'ATRASADO') return 'bg-red-100 text-red-700'
  return 'bg-yellow-100 text-yellow-800'
}

function paymentLabel(payment: FinancePayment) {
  return payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.installmentNumber}`
}

export default function FinanceiroPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(searchParams.get('month') || currentMonthKey())
  const [status, setStatus] = useState(normalizeStatusKey(searchParams.get('status')))
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1))
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadFinance = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ month, status, page: String(page), pageSize: '20' })
    if (query.trim()) params.set('q', query.trim())

    const response = await fetch(`/api/financeiro?${params.toString()}`)
    if (response.ok) {
      setData(await response.json())
    } else {
      setData(null)
    }
    setLoading(false)
  }, [month, page, query, status])

  useEffect(() => {
    const timer = window.setTimeout(loadFinance, 250)
    return () => window.clearTimeout(timer)
  }, [loadFinance])

  useEffect(() => {
    const params = new URLSearchParams({ month })
    if (status !== 'TODOS') params.set('status', status)
    if (query.trim()) params.set('q', query.trim())
    if (page > 1) params.set('page', String(page))

    const queryString = params.toString()
    if (queryString !== searchParams.toString()) {
      router.replace(`/dashboard/financeiro?${queryString}`)
    }
  }, [month, page, query, router, searchParams, status])

  const payments = useMemo(() => data?.payments || [], [data])
  const pagination = data?.pagination || EMPTY_PAGINATION
  const firstItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const lastItem = Math.min(pagination.page * pagination.pageSize, pagination.total)
  const closing = useMemo(() => {
    const summary = data?.summary
    const received = summary?.received || 0
    const receivable = summary?.receivable || 0
    const overdue = summary?.overdue || 0
    const cost = summary?.cost || 0
    const profit = summary?.profit || 0
    const future = summary?.future || 0

    return {
      monthCash: received,
      monthForecast: received + receivable,
      openRisk: overdue,
      operationalBalance: received - cost,
      future,
      profit,
    }
  }, [data])

  const togglePayment = async (payment: FinancePayment) => {
    const response = await fetch(`/api/projects/${payment.projectId}/payments/${payment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: !payment.paidAt, paymentMethod: payment.paymentMethod || 'PIX' }),
    })

    if (response.ok) loadFinance()
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Financeiro"
        subtitle="Controle de entradas, parcelas, recebimentos e atrasos"
      />

      <div className="finance-print-area flex-1 space-y-5 overflow-y-auto p-6">
        <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => { setMonth(moveMonth(month, -1)); setPage(1) }}>
              <ChevronLeft size={16} />
            </Button>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value || currentMonthKey())
                setPage(1)
              }}
              className="h-9 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm font-medium text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
            />
            <Button type="button" variant="outline" onClick={() => { setMonth(moveMonth(month, 1)); setPage(1) }}>
              <ChevronRight size={16} />
            </Button>
            <span className="ml-2 hidden text-sm font-semibold capitalize text-[#121212] sm:inline">
              {formatMonthLabel(month)}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
              <input
              value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar cliente ou projeto..."
                className="h-9 w-full rounded-lg border border-[#D9D9D9] bg-white pl-9 pr-3 text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer size={15} />
              Imprimir / PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams({ month })
                if (query.trim()) params.set('q', query.trim())
                if (status !== 'TODOS') params.set('status', status)
                window.open(`/api/financeiro/export?${params.toString()}`, '_blank')
              }}
            >
              <FileDown size={15} />
              CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatsCard title="Recebido" value={formatCurrency(data?.summary.received || 0)} subtitle="Pagos no período" icon={Wallet} color="green" />
          <StatsCard title="A Receber" value={formatCurrency(data?.summary.receivable || 0)} subtitle="Vencem no período" icon={Clock} color="yellow" />
          <StatsCard title="Atrasado" value={formatCurrency(data?.summary.overdue || 0)} subtitle="Vencidos em aberto" icon={AlertTriangle} color="red" />
          <StatsCard title="Vendido" value={formatCurrency(data?.summary.sold || 0)} subtitle="Projetos iniciados" icon={DollarSign} color="orange" />
          <StatsCard title="Lucro" value={formatCurrency(data?.summary.profit || 0)} subtitle="Vendido - custo" icon={TrendingUp} color="green" />
          <StatsCard title="Futuro" value={formatCurrency(data?.summary.future || 0)} subtitle="Depois do período" icon={TrendingUp} color="cyan" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#121212]">Fechamento do mês</h2>
                <p className="text-xs text-[#9E9E9E]">Resumo financeiro para conferir caixa, previsão e risco de atraso.</p>
              </div>
              <span className="text-xs font-semibold capitalize text-[#6B7280]">{formatMonthLabel(month)}</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Entrou no caixa</p>
                <p className="mt-2 text-base font-bold text-emerald-700">{formatCurrency(closing.monthCash)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Previsão do mês</p>
                <p className="mt-2 text-base font-bold text-blue-700">{formatCurrency(closing.monthForecast)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Risco em atraso</p>
                <p className="mt-2 text-base font-bold text-red-700">{formatCurrency(closing.openRisk)}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">Saldo estimado</p>
                <p className={cn('mt-2 text-base font-bold', closing.operationalBalance >= 0 ? 'text-orange-700' : 'text-red-700')}>
                  {formatCurrency(closing.operationalBalance)}
                </p>
              </div>
              <div className="rounded-lg bg-cyan-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Carteira futura</p>
                <p className="mt-2 text-base font-bold text-cyan-700">{formatCurrency(closing.future)}</p>
              </div>
              <div className="rounded-lg bg-[#F5F5F5] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Lucro previsto</p>
                <p className={cn('mt-2 text-base font-bold', closing.profit >= 0 ? 'text-[#121212]' : 'text-red-700')}>
                  {formatCurrency(closing.profit)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#121212]">Lançamentos</h2>
              <span className="text-xs text-[#9E9E9E]">{pagination.total} registro{pagination.total !== 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-[#F5F5F5]" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-[#9E9E9E]">
                <CheckCircle size={34} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Vencimento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Cliente / Projeto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Método</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Valor</th>
                      <th className="no-print px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F5]">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-medium text-[#121212]">{formatDateOnly(payment.dueDate)}</p>
                          {payment.paidAt && <p className="text-[10px] text-green-600">Pago em {formatDate(payment.paidAt)}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#121212]">{payment.clientName}</p>
                          <Link href={`/dashboard/projects/${payment.projectId}`} className="text-xs text-[#FF6B00] hover:underline">
                            {payment.projectName}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#6B7280]">{paymentLabel(payment)}</td>
                        <td className="px-4 py-3.5 text-xs text-[#6B7280]">{paymentMethodLabel(payment.paymentMethod)}</td>
                        <td className="px-4 py-3.5">
                          <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', statusClass(payment.status))}>
                            {payment.status === 'RECEBIDO' ? 'Recebido' : payment.status === 'ATRASADO' ? 'Atrasado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-[#121212]">{formatCurrency(payment.amount)}</td>
                        <td className="no-print px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            {payment.paidAt && (
                              <a
                                href={`/api/projects/${payment.projectId}/payments/${payment.id}/receipt`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D9D9D9] px-2 text-xs font-medium text-[#121212] hover:bg-[#F5F5F5]"
                              >
                                <ReceiptText size={13} />
                                Recibo
                              </a>
                            )}
                            <Button type="button" size="sm" variant={payment.paidAt ? 'outline' : 'primary'} onClick={() => togglePayment(payment)}>
                              {payment.paidAt ? 'Reabrir' : 'Pago'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="no-print flex flex-col gap-3 border-t border-[#F0F0F0] px-5 py-3 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between">
                <span>Mostrando {firstItem}-{lastItem} de {pagination.total} lançamentos</span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    aria-label="Página anterior"
                    title="Página anterior"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#121212] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="min-w-16 text-center font-semibold text-[#121212]">{pagination.page} de {pagination.totalPages}</span>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    title="Próxima página"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#121212] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
