'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useJsonResource } from '@/components/use-json-resource'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { QuoteRequestDialog } from '@/components/quotes/quote-request-dialog'
import { ORDER_STATUS_LABELS, type CommercialResult } from '@/lib/commercial-order-types'
import { cn, formatCurrency } from '@/lib/utils'
import type { QuotePayload } from '@/components/quotes/quote-form'

const QuoteForm = dynamic(() => import('@/components/quotes/quote-form').then(m => m.QuoteForm), { loading: () => <p>Carregando formulário…</p> })
const emptyClients: { id: string; name: string }[] = []
const empty: CommercialResult & { canWrite?: boolean } = { items: [], total: 0, owners: [], counts: { all: 0, active: 0, closed: 0 } }
const dateLabel = (value: string) => value.slice(0,10).split('-').reverse().join('/')

export function CommercialOrders({ clientId = '' }: { clientId?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const embedded = Boolean(clientId)
  const [localParams, setLocalParams] = useState(() => new URLSearchParams('view=all'))
  const filters = embedded ? localParams : params
  const view = filters.get('view') || 'active'
  const page = Math.max(1, Number.parseInt(filters.get('page') || '1') || 1)
  const [revision, setRevision] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [creating, setCreating] = useState<'choose' | 'quote' | null>(params.get('new') === '1' && !embedded ? 'choose' : null)
  const [requestId, setRequestId] = useState<string | null>(!embedded ? params.get('requestId') : null)
  const chosenClient = clientId || params.get('clientId') || ''
  const filterString = filters.toString()
  const queryText = filters.get('q') || ''

  const linkedRequest = !embedded ? params.get('requestId') : null
  const linkedNew = !embedded && params.get('new') === '1'
  const [previousLinks, setPreviousLinks] = useState({ linkedRequest, linkedNew })
  if (previousLinks.linkedRequest !== linkedRequest || previousLinks.linkedNew !== linkedNew) {
    setPreviousLinks({ linkedRequest, linkedNew }); setRequestId(linkedRequest); setCreating(linkedNew ? 'choose' : null)
  }
  function closeDialogs() {
    setCreating(null); setRequestId(null)
    if (!embedded && (params.has('requestId') || params.has('new'))) {
      const next = new URLSearchParams(params.toString()); next.delete('requestId'); next.delete('new')
      router.replace(`/dashboard/quotes?${next}`, { scroll: false })
    }
  }

  function change(key: string, value: string) {
    const next = new URLSearchParams(filterString)
    next.delete('page')
    if (value) next.set(key,value); else next.delete(key)
    if (embedded) setLocalParams(next)
    else router.replace(`/dashboard/quotes?${next}`, { scroll: false })
  }

  const query = new URLSearchParams(filterString)
  if (clientId) query.set('clientId',clientId)
  const { data, loading, error } = useJsonResource(`/api/commercial-orders?${query}`, empty, revision)
  const { data: clients, loading: clientsLoading, error: clientError } = useJsonResource(creating === 'quote' ? `/api/clients?options=1&selectedId=${encodeURIComponent(chosenClient)}` : null, emptyClients, revision)

  async function createQuote(payload: QuotePayload) {
    const response = await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Não foi possível criar o orçamento.')
    router.push(`/dashboard/quotes/${result.id}`)
  }
  const activeFilters = ['status','ownerId','attention','archived'].some(key=>filters.get(key))
  return <div className={embedded ? 'space-y-3' : 'flex min-h-full flex-col'}>
    {!embedded && <Header title="Orçamentos" subtitle="Da solicitação à proposta, em um só lugar" action={data.canWrite ? {label:'Novo orçamento',onClick:()=>setCreating('choose')} : undefined} />}
    <div className={embedded ? 'space-y-3' : 'flex-1 space-y-4 bg-[#F8F9FA] p-4 md:p-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5]">
        <div className="flex flex-wrap" role="group" aria-label="Visão dos pedidos">
          {([['all','Geral'],['active','Em andamento'],['closed','Encerrados']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={view===value} onClick={()=>change('view',value)} className={cn('border-b-2 px-3 py-3 text-sm font-medium',view===value?'border-orange-500 text-orange-700':'border-transparent text-[#666]')}>{label} <span className="ml-1 text-xs">{data.counts[value]}</span></button>)}
        </div>
        {embedded && data.canWrite && <Link className="text-sm text-orange-700" href={`/dashboard/quotes?new=1&clientId=${encodeURIComponent(clientId)}`}>Novo orçamento</Link>}
      </div>
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={event=>{event.preventDefault();change('q',String(new FormData(event.currentTarget).get('q') || '').trim())}}>
          <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-[#888]" size={16}/><input aria-label="Buscar cliente, pedido ou número" placeholder="Buscar cliente, pedido ou número" name="q" key={queryText} defaultValue={queryText} className="h-10 w-full rounded-md border border-[#DDD] bg-white pl-9 pr-3 text-sm"/></label>
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
        <Button variant="outline" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15}/> Filtros{activeFilters?' •':''}</Button>
      </div>
      {filtersOpen && <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
        <label className="text-xs text-[#666]">Situação<select aria-label="Situação" className="mt-1 block h-10 rounded-md border border-[#DDD] px-2 text-sm" value={filters.get('status')||''} onChange={e=>change('status',e.target.value)}><option value="">Todas</option>{Object.entries(ORDER_STATUS_LABELS).filter(([key])=>key!=='IN_PROGRESS').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-[#666]">Responsável<select aria-label="Responsável" className="mt-1 block h-10 rounded-md border border-[#DDD] px-2 text-sm" value={filters.get('ownerId')||''} onChange={e=>change('ownerId',e.target.value)}><option value="">Todos</option>{data.owners.map(owner=><option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
        <label className="text-xs text-[#666]">Atenção<select aria-label="Atenção" className="mt-1 block h-10 rounded-md border border-[#DDD] px-2 text-sm" value={filters.get('attention')||''} onChange={e=>change('attention',e.target.value)}><option value="">Todas</option><option value="late">Prazo vencido</option><option value="expired">Validade vencida</option><option value="missing">Falta informação</option><option value="ready">Pronto para enviar</option></select></label>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={filters.get('archived')==='1'} onChange={e=>change('archived',e.target.checked?'1':'')}/> Arquivados</label>
      </div>}
      {error ? <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} <Button variant="outline" onClick={()=>setRevision(n=>n+1)}>Tentar novamente</Button></div> : loading ? <p role="status" className="p-5 text-sm text-[#777]">Carregando pedidos…</p> : data.items.length===0 ? <div className="rounded-lg border border-dashed border-[#DDD] bg-white p-10 text-center"><p className="font-medium">Nenhum pedido nesta visão</p><p className="mt-2 text-sm text-[#777]">Ajuste os filtros ou comece um novo orçamento.</p></div> : <div className="divide-y divide-[#EEE] rounded-lg border border-[#E5E5E5] bg-white">
        {data.items.map(item=><article key={item.id} className="grid gap-3 p-4 xl:grid-cols-[minmax(180px,2fr)_1fr_1fr_auto] xl:items-center">
          <div className="min-w-0"><p className="font-semibold text-[#222]">{item.title}</p><Link className="text-sm text-[#666] hover:text-orange-700" href={`/dashboard/clients/${item.clientId}`}>{item.clientName}</Link><p className="mt-1 text-xs text-[#888]">{item.ownerName}{item.variantCount>1?` · ${item.variantCount} opções`:''}</p></div>
          <div><span className={cn('rounded-full px-2 py-1 text-xs font-medium',['APPROVED','SOLD'].includes(item.status)?'bg-emerald-50 text-emerald-800':['CANCELLED','LOST'].includes(item.status)?'bg-slate-100 text-slate-600':'bg-orange-50 text-orange-800')}>{ORDER_STATUS_LABELS[item.status]||item.status}</span>{item.flag&&<p className="mt-2 text-xs text-amber-800">{item.flag}</p>}{item.restricted&&<p className="mt-2 text-xs text-[#777]">Orçamento vinculado · acesso restrito</p>}</div>
          <div className="text-sm"><p className="font-medium">{item.amount===null?'A calcular':formatCurrency(item.amount)}</p><p className="mt-1 text-xs text-[#777]">{item.deadline?`${item.deadlineKind}: ${dateLabel(item.deadline)}`:'Sem prazo informado'}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {item.quoteId ? <Link href={item.projectId?`/dashboard/projects/${item.projectId}`:item.status==='APPROVED'?`/dashboard/sales?quoteId=${item.quoteId}`:`/dashboard/quotes/${item.quoteId}`} className="rounded-md border border-[#DDD] px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50">{item.projectId?'Ver projeto':item.status==='APPROVED'?'Continuar fechamento':item.status==='DRAFT'?'Continuar orçamento':'Abrir proposta'}</Link> : null}
            {item.requestId&&<button type="button" onClick={()=>setRequestId(item.requestId)} className="rounded-md border border-[#DDD] px-3 py-2 text-xs font-medium hover:bg-[#FAFAFA]">{item.quoteId?'Briefing':'Abrir solicitação'}</button>}
          </div>
        </article>)}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#777]"><span>{data.total} pedido{data.total===1?'':'s'} · página {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page<=1||loading} onClick={()=>change('page',String(page-1))}>Anterior</Button><Button variant="outline" disabled={page*20>=data.total||loading} onClick={()=>change('page',String(page+1))}>Próxima</Button></div></div>
    </div>
    <Modal open={creating==='choose'} onClose={closeDialogs} title="Novo orçamento"><div className="space-y-3"><Button className="w-full" onClick={()=>{setCreating(null);setRequestId('new')}}>Registrar solicitação / briefing</Button><p className="text-sm text-[#777]">Anote o pedido, o responsável e a data de retorno.</p><Button className="w-full" variant="outline" onClick={()=>setCreating('quote')}>Elaborar orçamento agora</Button><p className="text-sm text-[#777]">Já tenho as informações para calcular e preparar a proposta.</p></div></Modal>
    <Modal open={creating==='quote'} onClose={closeDialogs} title="Novo orçamento" size="xl">{clientsLoading?<p>Carregando clientes…</p>:clientError?<div role="alert">{clientError}<Button onClick={()=>setRevision(n=>n+1)}>Tentar novamente</Button></div>:<QuoteForm clients={clients} defaults={{clientId:chosenClient,title:'',notes:''}} onSubmit={createQuote} onCancel={closeDialogs}/>}</Modal>
    {requestId&&<QuoteRequestDialog key={requestId} requestId={requestId} clientId={chosenClient} onClose={closeDialogs} onSaved={()=>setRevision(n=>n+1)}/>}
  </div>
}
