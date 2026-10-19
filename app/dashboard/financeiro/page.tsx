'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowDownToLine, Banknote, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, FileDown, Printer, Search, ShieldCheck, Wallet } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { dateOnlyKeyInTimeZone, formatDateOnly } from '@/lib/date-only'
import { paymentMethodLabel } from '@/lib/payment-methods'
import { ProfitabilityReport, type ProfitabilityData } from '@/components/finance/profitability-report'
import { SettlementDialog, type FinanceProject, type SettlementSelection } from '@/components/financeiro/settlement-dialog'
import { MonthlyReport, type MonthlyReportData } from '@/components/financeiro/monthly-report'

type FinanceData = {
  month: string
  summary: { received: number; receivedGross: number; fees: number; pending: number; boletoPending: number; cardPending: number; cashPending: number }
  projects: FinanceProject[]
}
type View = 'receipts' | 'report' | 'profitability'
type MethodFilter = 'ALL' | 'CARD' | 'BOLETO' | 'OTHER' | 'SETTLED'
const fieldClass = 'h-10 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]'

function currentMonthKey() {
  return dateOnlyKeyInTimeZone(new Date()).slice(0, 7)
}

function validMonth(value: string | null) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : currentMonthKey()
}

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
}

function plannedMethodLabel(method: string) {
  if (method === 'CARD' || method === 'CARTAO') return 'Cartão'
  if (method === 'BOLETO') return 'Boleto'
  if (method === 'PIX') return 'Pix'
  return method === 'DINHEIRO' ? 'Dinheiro' : 'A combinar'
}

function isCard(project: FinanceProject) {
  return project.paymentMethod === 'CARD' || project.paymentMethod === 'CARTAO'
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as informações. Tente novamente.')
  return payload as T
}

function FinanceScreen() {
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(() => validMonth(searchParams.get('month')))
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [view, setView] = useState<View>('receipts')
  const [filter, setFilter] = useState<MethodFilter>('ALL')
  const [data, setData] = useState<FinanceData | null>(null)
  const [report, setReport] = useState<MonthlyReportData | null>(null)
  const [profitability, setProfitability] = useState<ProfitabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [profitabilityLoading, setProfitabilityLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [profitabilityError, setProfitabilityError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [success, setSuccess] = useState('')
  const [selection, setSelection] = useState<SettlementSelection | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setErrors([])
      const params = new URLSearchParams({ month })
      if (query.trim()) params.set('q', query.trim())
      const results = await Promise.allSettled([
        fetchJson<FinanceData>(`/api/financeiro/settlements?${params}`, controller.signal),
        fetchJson<MonthlyReportData>(`/api/financeiro/report?${params}`, controller.signal),
      ])
      if (controller.signal.aborted) return
      const [financeResult, reportResult] = results
      setData(financeResult.status === 'fulfilled' ? financeResult.value : null)
      setReport(reportResult.status === 'fulfilled' ? reportResult.value : null)
      setErrors(results.flatMap((result, index) => result.status === 'rejected'
        ? [`${index === 0 ? 'Recebimentos' : 'Relatório de vendas'}: ${result.reason instanceof Error ? result.reason.message : 'Falha ao carregar.'}`]
        : []))
      setLoading(false)
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [month, query, refresh])

  useEffect(() => {
    if (view !== 'profitability') return
    const controller = new AbortController()
    async function loadProfitability() {
      setProfitabilityLoading(true)
      setProfitabilityError('')
      const params = new URLSearchParams({ month })
      if (query.trim()) params.set('q', query.trim())
      try {
        const response = await fetchJson<{ profitability: ProfitabilityData }>(`/api/financeiro?${params}`, controller.signal)
        if (!controller.signal.aborted) setProfitability(response.profitability)
      } catch (error) {
        if (!controller.signal.aborted) {
          setProfitability(null)
          setProfitabilityError(error instanceof Error ? error.message : 'Falha ao carregar a rentabilidade.')
        }
      } finally {
        if (!controller.signal.aborted) setProfitabilityLoading(false)
      }
    }
    void loadProfitability()
    return () => controller.abort()
  }, [month, query, refresh, view])

  function changeMonth(nextMonth: string) {
    if (nextMonth === month) return
    setLoading(true)
    setSuccess('')
    setMonth(nextMonth)
  }

  const finance = loading ? null : data
  const monthlyReport = loading ? null : report
  const projects = finance?.projects.filter((project) => {
    if (filter === 'SETTLED') return project.remaining <= 0
    if (project.archivedAt && filter !== 'ALL') return false
    if (filter === 'CARD') return isCard(project) && project.remaining > 0
    if (filter === 'BOLETO') return project.paymentMethod === 'BOLETO' && project.remaining > 0
    if (filter === 'OTHER') return !isCard(project) && project.paymentMethod !== 'BOLETO' && project.remaining > 0
    return true
  }) || []
  const exportParams = new URLSearchParams({ month })
  if (query.trim()) exportParams.set('q', query.trim())
  const hasLegacyReceipts = finance?.projects.some((project) => project.receipts.some((receipt) => receipt.source === 'LEGACY' && !receipt.reversedAt && receipt.receivedAt.slice(0, 7) === month))
  const money = (amount: number | undefined) => loading ? '…' : amount === undefined ? '—' : formatCurrency(amount)

  return (
    <div className="flex h-full flex-col">
      <Header title="Financeiro" subtitle="Recebimentos da empresa e resultado das vendas" />
      <div className="finance-print-area flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        <div className="no-print flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" aria-label="Mês anterior" onClick={() => changeMonth(moveMonth(month, -1))}><ChevronLeft size={16} /></Button>
            <label className="sr-only" htmlFor="finance-month">Mês do relatório</label>
            <input id="finance-month" type="month" value={month} onChange={(event) => changeMonth(validMonth(event.target.value))} className={cn(fieldClass, 'min-w-0 font-semibold')} />
            <Button type="button" variant="outline" aria-label="Próximo mês" onClick={() => changeMonth(moveMonth(month, 1))}><ChevronRight size={16} /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1 sm:flex-none"><span className="sr-only">Buscar cliente ou projeto</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" /><input value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value) }} placeholder="Cliente ou projeto" className={cn(fieldClass, 'w-full pl-9')} /></label>
            <Button type="button" variant="outline" onClick={() => window.print()}><Printer size={15} />Imprimir / PDF</Button>
            <a href={`/api/financeiro/settlements/export?${exportParams}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-medium hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"><FileDown size={15} />CSV de recebimentos</a>
            {view === 'report' ? <a href={`/api/financeiro/report?${exportParams}&format=csv`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-medium hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"><FileDown size={15} />CSV de vendas</a> : null}
          </div>
        </div>
        {errors.length > 0 ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.map((error) => <p key={error}>{error}</p>)}<Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</Button></div> : null}
        {success ? <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} />{success}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4" aria-busy={loading}>
          <StatsCard title="Entrou no mês" value={money(finance?.summary.received)} subtitle="Valor líquido recebido pela empresa" icon={Wallet} color="green" />
          <StatsCard title="Vendido no mês" value={money(monthlyReport?.sold.amount)} subtitle={monthlyReport ? `${monthlyReport.sold.count} venda(s) fechada(s)` : 'Vendas efetivamente fechadas'} icon={CheckCircle2} color="orange" />
          <StatsCard title="Em negociação" value={money(monthlyReport?.negotiating.amount)} subtitle={monthlyReport ? `${monthlyReport.negotiating.count} oportunidade(s) em aberto` : 'Vendas que ainda podem acontecer'} icon={Banknote} color="blue" />
          <StatsCard title="Perdido no mês" value={money(monthlyReport?.lost.amount)} subtitle={monthlyReport ? `${monthlyReport.lost.count} oportunidade(s) perdida(s)` : 'Orçamentos encerrados sem venda'} icon={ArrowDownToLine} color="red" />
        </div>
        <div className="no-print flex flex-wrap gap-2 border-b border-[#E5E5E5] pb-3" aria-label="Seções do financeiro">
          {([{ id: 'receipts', label: 'Recebimentos' }, { id: 'report', label: 'Relatório do mês' }, { id: 'profitability', label: 'Custos e rentabilidade' }] as const).map((tab) => <Button key={tab.id} type="button" variant={view === tab.id ? 'secondary' : 'ghost'} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}>{tab.label}</Button>)}
        </div>

        {view === 'receipts' ? <>
          <Card><CardHeader><h2 className="text-sm font-semibold">Caixa de <span className="capitalize">{monthLabel(month)}</span></h2></CardHeader><CardBody><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-[#666]">Recebimento bruto</p><p className="mt-1 text-xl font-bold">{money(finance?.summary.receivedGross)}</p></div><div><p className="text-xs text-[#666]">Taxas descontadas</p><p className="mt-1 text-xl font-bold text-[#666]">{money(finance?.summary.fees)}</p></div><div><p className="text-xs text-emerald-700">Líquido que entrou</p><p className="mt-1 text-xl font-bold text-emerald-700">{money(finance?.summary.received)}</p></div></div><p className="mt-4 text-xs leading-relaxed text-[#666]">O caixa considera a data em que a empresa recebeu o dinheiro. Vendas fechadas e negociações aparecem no relatório comercial.</p>{hasLegacyReceipts ? <p className="mt-2 text-[11px] leading-relaxed text-amber-800">Registros antigos mantêm os valores originais; taxas não informadas não foram estimadas.</p> : null}</CardBody></Card>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900"><CreditCard size={17} />Cartão: repasse integral</div><p className="text-xs leading-relaxed text-blue-900/80">Registre o repasse total uma única vez, com a taxa descontada. O parcelamento do cliente fica apenas como informação.</p><p className="mt-3 text-sm font-semibold text-blue-900">A registrar: {money(finance?.summary.cardPending)}</p></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldCheck size={17} />Boleto: limite e recebimento</div><p className="text-xs leading-relaxed text-amber-900/80">O limite do jurídico é compartilhado entre os projetos do cliente. Registre o pagamento do cliente ou a antecipação efetivamente recebida.</p><p className="mt-3 text-sm font-semibold text-amber-900">Saldo em boletos: {money(finance?.summary.boletoPending)}</p></div>
            <div className="rounded-xl border border-[#E8E8E8] bg-white p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Banknote size={17} />Dinheiro, Pix e transferência</div><p className="text-xs leading-relaxed text-[#666]">Receba de uma vez ou em partes. Informe o valor que entrou e o saldo restante é atualizado automaticamente.</p><p className="mt-3 text-sm font-semibold">Saldo a acertar: {money(finance?.summary.cashPending)}</p></div>
          </div>
          <Card>
            <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Recebimentos por cliente</h2><p className="mt-1 text-xs leading-relaxed text-[#666]">Saldos em aberto de todos os meses e recebimentos registrados no mês selecionado.</p></div><label className="no-print"><span className="sr-only">Filtrar recebimentos</span><select value={filter} onChange={(event) => setFilter(event.target.value as MethodFilter)} className={cn(fieldClass, 'w-full sm:w-auto')}><option value="ALL">Todos</option><option value="CARD">Cartões a registrar</option><option value="BOLETO">Boletos em aberto</option><option value="OTHER">Dinheiro, Pix e outros</option><option value="SETTLED">Quitados</option></select></label></div></CardHeader>
            <CardBody className="space-y-3">
              {loading ? <LoadingRows /> : !finance ? <p className="py-10 text-center text-sm text-[#666]">Os recebimentos não estão disponíveis. Tente carregar novamente.</p> : projects.length === 0 ? <div className="py-10 text-center"><CheckCircle2 size={30} className="mx-auto mb-2 text-emerald-600" /><p className="text-sm font-medium">Nenhum recebimento encontrado neste filtro.</p></div> : projects.map((project) => <article key={project.id} className="rounded-xl border border-[#E8E8E8] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{project.clientName}</h3><span className="rounded-md bg-[#F1F1F1] px-2 py-1 text-[11px] font-medium text-[#555]">{plannedMethodLabel(project.paymentMethod)}</span>{project.archivedAt ? <span className="rounded-md bg-[#F1F1F1] px-2 py-1 text-[11px] font-semibold text-[#555]">Arquivado</span> : project.remaining <= 0 ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Quitado</span> : null}</div><Link href={`/dashboard/projects/${project.id}`} className="mt-1 inline-block text-xs text-[#C65000] hover:underline">{project.name}</Link>{project.archivedAt ? <p className="mt-2 text-xs text-[#666]">Projeto arquivado. Histórico de recebimentos preservado.</p> : project.paymentMethod === 'BOLETO' ? <CreditStatus project={project} /> : null}</div>
                  <div className="grid grid-cols-3 gap-4 text-right lg:min-w-80"><div><p className="text-[11px] text-[#666]">Vendido</p><p className="mt-1 text-sm font-semibold">{formatCurrency(project.value)}</p></div><div><p className="text-[11px] text-[#666]">Recebido bruto</p><p className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(project.received)}</p></div><div><p className="text-[11px] text-[#666]">{project.archivedAt ? 'Saldo histórico' : 'Saldo'}</p><p className={cn('mt-1 text-sm font-bold', project.remaining > 0 ? 'text-[#121212]' : 'text-emerald-700')}>{formatCurrency(project.remaining)}</p></div></div>
                </div>
                {!project.archivedAt ? <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-2">{project.paymentMethod === 'BOLETO' ? <Button type="button" variant="outline" size="sm" onClick={() => { setSuccess(''); setSelection({ project, mode: 'CREDIT_REVIEW' }) }}><ShieldCheck size={14} />Análise do jurídico</Button> : null}{isCard(project) && project.payments.some((payment) => payment.type === 'DOWN_PAYMENT' && payment.remaining > 0) ? <Button type="button" variant="outline" size="sm" onClick={() => { setSuccess(''); setSelection({ project, mode: 'RECEIVE_ENTRY' }) }}>Registrar entrada por outro meio</Button> : null}{project.remaining > 0 ? <Button type="button" size="sm" onClick={() => { setSuccess(''); setSelection({ project, mode: 'RECEIVE' }) }}>{isCard(project) ? 'Registrar repasse integral' : project.paymentMethod === 'BOLETO' ? 'Receber / antecipar' : 'Registrar recebimento'}</Button> : null}</div> : null}
                {project.receipts.length > 0 || project.payments.length > 0 ? <details className="mt-3 border-t border-[#F0F0F0] pt-3"><summary className="cursor-pointer text-xs font-medium text-[#666] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]">Ver histórico e condições do cliente</summary><div className="mt-3 space-y-3">
                  {project.receipts.length > 0 ? <div><h4 className="mb-2 text-xs font-semibold">Dinheiro recebido pela empresa</h4><div className="divide-y divide-[#F0F0F0]">{project.receipts.map((receipt) => <div key={receipt.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-xs', receipt.reversedAt && 'opacity-60')}><div><p className="font-medium">{formatDateOnly(receipt.receivedAt)} · {receipt.source === 'BOLETO_ADVANCE' ? 'Antecipação de boleto' : receipt.source === 'CARD' ? 'Repasse do cartão' : paymentMethodLabel(receipt.method)}{receipt.reversedAt ? ' · Estornado' : ''}</p>{receipt.note ? <p className="mt-1 break-words text-[#666]">{receipt.note}</p> : null}</div><div className="text-right"><p className={cn('font-semibold', receipt.reversedAt ? 'line-through text-[#666]' : 'text-emerald-700')}>{formatCurrency(receipt.amount - receipt.fee)} líquido</p><p className="mt-1 text-[11px] text-[#666]">Bruto {formatCurrency(receipt.amount)} · taxa {formatCurrency(receipt.fee)}</p>{!project.archivedAt && !receipt.reversedAt && receipt.source !== 'LEGACY' ? <button type="button" onClick={() => setSelection({ project, mode: 'REVERSE', receipt })} className="no-print mt-2 rounded text-[11px] font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Estornar registro</button> : null}</div></div>)}</div></div> : null}
                  {project.payments.length > 0 ? <div><h4 className="mb-1 text-xs font-semibold">Condições combinadas com o cliente</h4>{isCard(project) ? <p className="mb-2 text-[11px] text-[#666]">As parcelas do cartão não geram novos recebimentos para a empresa após o repasse integral.</p> : null}<div className="flex flex-wrap gap-2">{project.payments.map((payment) => <div key={payment.id} className="rounded-lg bg-[#FAFAFA] px-3 py-2 text-[11px]"><p className="font-medium">{payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.installmentNumber}`}: {formatCurrency(payment.amount)}</p><p className="mt-1 text-[#666]">{formatDateOnly(payment.dueDate)}</p></div>)}</div></div> : null}
                </div></details> : null}
              </article>)}
            </CardBody>
          </Card>
        </> : null}
        {view === 'report' ? loading ? <LoadingRows /> : monthlyReport ? <MonthlyReport data={monthlyReport} monthLabel={monthLabel(month)} /> : <Card><CardBody><p className="py-10 text-center text-sm text-[#666]">O relatório não está disponível. Tente carregar novamente.</p></CardBody></Card> : null}
        {view === 'profitability' ? profitabilityLoading ? <LoadingRows /> : profitabilityError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{profitabilityError}</div> : profitability ? <ProfitabilityReport data={profitability} /> : null : null}
      </div>
      {selection ? <SettlementDialog key={`${selection.mode}-${selection.project.id}-${selection.receipt?.id || ''}`} {...selection} onClose={() => setSelection(null)} onSaved={(message) => { setSelection(null); setSuccess(message); setLoading(true); setRefresh((value) => value + 1) }} /> : null}
    </div>
  )
}

function CreditStatus({ project }: { project: FinanceProject }) {
  const label = project.creditStatus === 'APPROVED' ? 'Crédito aprovado' : project.creditStatus === 'REJECTED' ? 'Crédito não aprovado' : 'Aguardando análise do jurídico'
  return <p className={cn('mt-2 text-xs', project.creditStatus === 'APPROVED' ? 'text-emerald-700' : project.creditStatus === 'REJECTED' ? 'text-red-700' : 'text-amber-800')}>{label}{project.creditStatus === 'APPROVED' && project.creditLimit !== null ? ` · limite ${formatCurrency(project.creditLimit)} · disponível ${formatCurrency(project.creditAvailable ?? project.creditLimit)}` : ''}</p>
}

function LoadingRows() {
  return <div className="space-y-3" role="status" aria-label="Carregando informações financeiras">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-[#EDEDED]" />)}<span className="sr-only">Carregando...</span></div>
}

export default function FinanceiroPage() {
  return <Suspense fallback={<div className="p-6"><LoadingRows /></div>}><FinanceScreen /></Suspense>
}
