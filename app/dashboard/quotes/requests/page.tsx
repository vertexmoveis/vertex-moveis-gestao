'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { REQUEST_LABELS, REQUEST_STATUSES } from '@/lib/quote-requests'
import { formatDate } from '@/lib/utils'
import { dateOnlyKeyInTimeZone } from '@/lib/date-only'
import type { QuotePayload } from '@/components/quotes/quote-form'

const QuoteForm = dynamic(() => import('@/components/quotes/quote-form').then(m => m.QuoteForm), { loading: () => <p className="p-6">Carregando orçamento…</p> })
type Option = { id: string; name: string }
type RequestItem = {
  id: string; clientId: string; title: string; briefing: string; environments: string; commercialOwner: string;
  opportunityUrl: string | null; referenceUrl: string | null; externalOpportunityId: string | null;
  desiredDeliveryDate: string | null; dueDate: string; status: typeof REQUEST_STATUSES[number];
  missingInformation: string | null; nextAction: string | null; receivedAt: string | null; updatedAt: string;
  client: Option; assignedTo: Option; quoteGroup: { quotes: { id: string }[] } | null;
}
type ResponseData = { items: RequestItem[]; total: number; clients: Option[]; users: Option[]; canWrite: boolean }
const empty = { items: [], total: 0, clients: [], users: [], canWrite: false } satisfies ResponseData

export default function QuoteRequestsPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [data, setData] = useState<ResponseData>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')
  const [overdue, setOverdue] = useState(params.get('overdue') === '1')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<RequestItem | null>(null)
  const [quoting, setQuoting] = useState<RequestItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState('')
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), q: search, status, overdue: overdue ? '1' : '0' })
      const response = await fetch(`/api/quote-requests?${params}`, { signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as solicitações.')
      if (!signal?.aborted) setData(result)
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao carregar.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [page, search, status, overdue])
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 250); return () => { clearTimeout(timer); controller.abort() } }, [load])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setSaving(true); setFormError('')
    try {
      const response = await fetch(`/api/quote-requests${selected ? `?id=${selected.id}` : ''}`, {
        method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected ? { ...values, updatedAt: selected.updatedAt } : values),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.')
      setCreating(false); setSelected(null); await load()
    } catch (failure) { setFormError(failure instanceof Error ? failure.message : 'Falha ao salvar.') }
    finally { setSaving(false) }
  }
  async function createQuote(payload: QuotePayload) {
    if (!quoting) return
    const response = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId: quoting.id }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Não foi possível criar o orçamento.')
    router.push(`/dashboard/quotes/${result.id}`)
  }
  return <div className="flex h-full flex-col">
    <Header title="Solicitações de orçamento" subtitle="Da reunião na Konekto à proposta na Vertex" action={data.canWrite ? { label: 'Nova solicitação', onClick: () => { setFormError(''); setCreating(true) } } : undefined} />
    <div className="space-y-5 p-4 md:p-6">
      <nav aria-label="Orçamentos" className="flex flex-wrap gap-3 text-sm font-semibold">
        <span className="rounded-lg bg-orange-100 px-4 py-2 text-orange-900" aria-current="page">Solicitações</span>
        <Link className="rounded-lg border bg-white px-4 py-2" href="/dashboard/quotes">Propostas</Link>
        <Link className="rounded-lg border bg-white px-4 py-2" href="/dashboard/sales">Fechamentos</Link>
      </nav>
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">Registre o resumo da reunião, quem vai preparar o orçamento e a data de retorno. As conversas e negociações continuam na Konekto.</div>
      <div className="grid items-end gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <Input label="Buscar cliente ou solicitação" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <Select label="Situação" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} options={[{ value: '', label: 'Todas' }, ...REQUEST_STATUSES.map(value => ({ value, label: REQUEST_LABELS[value] }))]} />
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={overdue} onChange={e => { setOverdue(e.target.checked); setPage(1) }} /> Somente atrasadas</label>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}
      {loading ? <p role="status">Carregando solicitações…</p> : !error && data.items.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center"><p className="font-semibold">Nenhuma solicitação nesta visão</p><p className="mt-2 text-sm text-[#666]">Cadastre um pedido de orçamento ou ajuste os filtros.</p><Link href="/dashboard/clients" className="mt-4 inline-block text-orange-700 underline">Cadastrar ou localizar cliente</Link></div> : !error && <div className="grid gap-4 xl:grid-cols-2">
        {data.items.map(item => {
          const late = item.dueDate.slice(0, 10) < dateOnlyKeyInTimeZone(new Date()) && !['READY', 'CANCELLED'].includes(item.status)
          const quoteId = item.quoteGroup?.quotes[0]?.id
          return <article key={item.id} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold">{item.title}</h2><Link href={`/dashboard/clients/${item.client.id}`} className="text-sm text-orange-700">{item.client.name}</Link></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${late ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{REQUEST_LABELS[item.status]}{late ? ' · atrasada' : ''}</span></div>
            <p className="whitespace-pre-wrap text-sm text-[#555]">{item.briefing}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-[#777]">Ambientes</dt><dd>{item.environments}</dd></div><div><dt className="text-[#777]">Responsável pelo orçamento</dt><dd>{item.assignedTo.name}</dd></div><div><dt className="text-[#777]">Retorno do orçamento</dt><dd className={late ? 'font-bold text-red-700' : ''}>{formatDate(item.dueDate)}</dd></div><div><dt className="text-[#777]">Comercial</dt><dd>{item.commercialOwner}</dd></div>{item.desiredDeliveryDate && <div><dt className="text-[#777]">Entrega desejada pelo cliente</dt><dd>{formatDate(item.desiredDeliveryDate)} · a confirmar</dd></div>}</dl>
            {!item.receivedAt && <p className="text-xs text-amber-800">Aguardando confirmação de recebimento pelo responsável.</p>}
            {item.missingInformation && item.status === 'MISSING_INFO' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Falta informação: {item.missingInformation}</p>}
            {item.nextAction && <p className="text-sm"><strong>Próxima ação:</strong> {item.nextAction}</p>}
            <div className="flex flex-wrap gap-3 text-sm">{item.opportunityUrl && <a href={item.opportunityUrl} target="_blank" rel="noopener noreferrer" className="text-orange-700 underline">Abrir oportunidade na Konekto</a>}{item.referenceUrl && <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-700 underline">Referências e anexos</a>}</div>
            <div className="flex flex-wrap gap-2 border-t pt-3">{data.canWrite && <Button variant="outline" onClick={() => { setSelected(item); setProgress(item.status); setFormError('') }}>Atualizar andamento</Button>}{quoteId ? <Link className="rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white" href={`/dashboard/quotes/${quoteId}`}>Abrir orçamento</Link> : data.canWrite && item.status !== 'CANCELLED' && <Button onClick={() => setQuoting(item)}>Elaborar orçamento</Button>}</div>
          </article>
        })}
      </div>}
      <div className="flex items-center justify-between gap-2 text-sm"><span>{data.total} solicitações · página {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={page * 20 >= data.total || loading} onClick={() => setPage(page + 1)}>Próxima</Button></div></div>
    </div>
    <Modal open={creating || Boolean(selected)} onClose={() => { if (!saving) { setCreating(false); setSelected(null) } }} title={selected ? 'Atualizar solicitação' : 'Pedido recebido da Konekto'} size="lg">
      <form onSubmit={save} className="space-y-4" key={selected?.id || 'new'}>
        {selected ? <>
          <Input name="title" label="Título do pedido" required minLength={3} maxLength={160} defaultValue={selected.title} />
          <Textarea name="briefing" label="Resumo da reunião e necessidades" required minLength={10} maxLength={6000} defaultValue={selected.briefing} />
          <Input name="environments" label="Ambientes pretendidos" required maxLength={1000} defaultValue={selected.environments} />
          <Input name="commercialOwner" label="Responsável comercial na Konekto" required maxLength={160} defaultValue={selected.commercialOwner} />
          <Input name="opportunityUrl" label="Link da oportunidade na Konekto" type="url" defaultValue={selected.opportunityUrl || ''} />
          <Input name="referenceUrl" label="Link com referências e anexos" type="url" defaultValue={selected.referenceUrl || ''} />
          {selected.quoteGroup && <p className="text-xs text-[#666]">As alterações deste briefing não modificam o orçamento já elaborado. Revise a proposta quando o escopo mudar.</p>}
          <Select name="status" label="Situação" value={progress} onChange={e => setProgress(e.target.value)} options={REQUEST_STATUSES.map(value => ({ value, label: REQUEST_LABELS[value] }))} />
          <Textarea name="missingInformation" label="Informações que faltam" required={progress === 'MISSING_INFO'} defaultValue={selected.missingInformation || ''} maxLength={2000} />
          <Textarea name="nextAction" label={progress === 'CANCELLED' ? 'Motivo do cancelamento' : 'Próxima ação'} required={progress === 'CANCELLED'} defaultValue={selected.nextAction || ''} maxLength={1000} />
          <Input name="dueDate" label="Retorno do orçamento" type="date" required defaultValue={selected.dueDate.slice(0, 10)} />
          <p className="text-xs text-[#666]">Salvar também confirma o recebimento desta solicitação.</p>
        </> : <>
          <Select name="clientId" label="Cliente" required options={[{ value: '', label: 'Selecione' }, ...data.clients.map(x => ({ value: x.id, label: x.name }))]} />
          <Link href="/dashboard/clients" className="inline-block text-sm text-orange-700 underline">Preciso cadastrar o cliente</Link>
          <Input name="title" label="Título do pedido" placeholder="Cozinha e lavanderia — apartamento" required maxLength={160} />
          <div className="grid gap-4 sm:grid-cols-2"><Input name="commercialOwner" label="Responsável comercial na Konekto" required maxLength={160} /><Select name="assignedToId" label="Responsável pelo orçamento" required options={[{ value: '', label: 'Selecione' }, ...data.users.map(x => ({ value: x.id, label: x.name }))]} /></div>
          <Textarea name="briefing" label="Resumo da reunião e necessidades" placeholder="O que o cliente procura? Há medidas estimadas, referências ou restrições da obra?" required minLength={10} maxLength={6000} />
          <Input name="environments" label="Ambientes pretendidos" required maxLength={1000} />
          <div className="grid gap-4 sm:grid-cols-2"><Input name="dueDate" label="Retorno do orçamento" type="date" required /><Input name="desiredDeliveryDate" label="Entrega desejada (a confirmar)" type="date" /></div>
          <Input name="opportunityUrl" label="Link da oportunidade na Konekto" type="url" placeholder="https://…" />
          <Input name="externalOpportunityId" label="Identificador da oportunidade (se disponível)" maxLength={160} />
          <Input name="referenceUrl" label="Link com referências e anexos (opcional)" type="url" placeholder="https://…" />
          <Textarea name="nextAction" label="Próxima ação" maxLength={1000} />
        </>}
        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => { setCreating(false); setSelected(null) }}>Cancelar</Button><Button type="submit" loading={saving}>Salvar solicitação</Button></div>
      </form>
    </Modal>
    <Modal open={Boolean(quoting)} onClose={() => setQuoting(null)} title="Elaborar orçamento da solicitação" size="xl">
      {quoting && <QuoteForm clients={[quoting.client]} defaults={{ clientId: quoting.clientId, title: quoting.title, notes: `${quoting.briefing.slice(0, 1000)}\n\nAmbientes: ${quoting.environments.slice(0, 300)}\nComercial: ${quoting.commercialOwner}\nBriefing completo e anexos na solicitação de origem.` }} onSubmit={createQuote} onCancel={() => setQuoting(null)} />}
    </Modal>
  </div>
}
