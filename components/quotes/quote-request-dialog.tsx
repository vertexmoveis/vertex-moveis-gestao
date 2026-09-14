'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClientSearchSelect } from '@/components/clients/client-search-select'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { REQUEST_LABELS, REQUEST_STATUSES } from '@/lib/quote-requests'
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

export function QuoteRequestDialog({ requestId, clientId = '', onClose, onSaved }: { requestId: string; clientId?: string; onClose: () => void; onSaved: () => void }) {
  const router = useRouter()
  const [data, setData] = useState<ResponseData>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const creating = requestId === 'new'
  const [chosenClient, setChosenClient] = useState(clientId)
  const [selected, setSelected] = useState<RequestItem | null>(null)
  const [quoting, setQuoting] = useState<RequestItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState('')
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ id: requestId === 'new' ? '' : requestId, clientId })
      const response = await fetch(`/api/quote-requests?${params}`, { signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as solicitações.')
      if (!signal?.aborted) { setData(result); if (requestId !== 'new') { const item = result.items[0]; if (!item) throw new Error('Solicitação não encontrada ou sem acesso.'); setSelected(item); setProgress(item.status) } }
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : 'Falha ao carregar.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [requestId, clientId])
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 250); return () => { clearTimeout(timer); controller.abort() } }, [load])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const elaborate = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'quote'
    setSaving(true); setFormError('')
    try {
      const response = await fetch(`/api/quote-requests${selected ? `?id=${selected.id}` : ''}`, {
        method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected ? { ...values, updatedAt: selected.updatedAt } : values),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.')
      onSaved()
      if (elaborate && selected) { const updated = { ...selected, ...values, updatedAt: result.updatedAt || selected.updatedAt } as RequestItem; setSelected(updated); setQuoting(updated) } else onClose()
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
  return <>
    {(loading || error) && <Modal open onClose={onClose} title="Solicitação"><p role={error ? 'alert' : 'status'}>{error || 'Carregando…'}</p>{error && <Button onClick={() => void load()}>Tentar novamente</Button>}</Modal>}
    <Modal open={!loading && !error && (creating || Boolean(selected)) && !quoting} onClose={() => { if (!saving) { onClose() } }} title={selected ? 'Atualizar solicitação' : 'Pedido recebido da Konekto'} size="lg">
      <form onSubmit={save} className="space-y-4" key={selected?.id || 'new'}>
        <fieldset disabled={!data.canWrite || saving} className="space-y-4">
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
          <input type="hidden" name="clientId" value={chosenClient}/><ClientSearchSelect value={chosenClient} onChange={setChosenClient} initialOptions={data.clients} />
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
        </fieldset>
        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => { onClose() }}>Cancelar</Button>{data.canWrite && <Button type="submit" loading={saving}>Salvar solicitação</Button>}</div>
        {data.canWrite && selected && !selected.quoteGroup && selected.status !== 'CANCELLED' && <Button type="submit" value="quote" variant="outline" disabled={saving}>Salvar e elaborar orçamento</Button>}
        {selected?.quoteGroup && <p className="text-sm text-[#666]">Este pedido já possui orçamento. Continue pelo registro vinculado na lista.</p>}
      </form>
    </Modal>
    <Modal open={Boolean(quoting)} onClose={() => setQuoting(null)} title="Elaborar orçamento da solicitação" size="xl">
      {quoting && <QuoteForm clients={[quoting.client]} defaults={{ clientId: quoting.clientId, title: quoting.title, notes: `${quoting.briefing.slice(0, 1000)}\n\nAmbientes: ${quoting.environments.slice(0, 300)}\nComercial: ${quoting.commercialOwner}\nBriefing completo e anexos na solicitação de origem.` }} onSubmit={createQuote} onCancel={() => setQuoting(null)} />}
    </Modal>
  </>
}
