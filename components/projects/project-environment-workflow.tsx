'use client'

import { useState } from 'react'
import { PRODUCTION_STAGE_DESCRIPTIONS, PRODUCTION_STAGE_FLOW, PRODUCTION_STAGE_LABELS, type ProductionStage, type ProjectEnvironmentData } from '@/types'
import { environmentWorkflowLabel, environmentWorkflowTone, getEnvironmentWorkflowStage } from '@/lib/environment-workflow'

export function ProjectEnvironmentWorkflow({ projectId, environments, canWrite, onUpdated }: {
  projectId: string; environments: ProjectEnvironmentData[]; canWrite: boolean; onUpdated: (environment: ProjectEnvironmentData) => void
}) {
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  async function add() {
    if (!canWrite || adding || !newName.trim()) return
    setAdding(true); setAddError('')
    try {
      const response = await fetch(`/api/projects/${projectId}/environments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível adicionar o ambiente.')
      onUpdated(data); setNewName('')
    } catch (error) { setAddError(error instanceof Error ? error.message : 'Não foi possível adicionar o ambiente.') }
    finally { setAdding(false) }
  }
  async function update(environment: ProjectEnvironmentData, dataToSave: { workflowStage?: ProductionStage; name?: string }) {
    if (!canWrite || pending.has(environment.id) || (dataToSave.workflowStage && getEnvironmentWorkflowStage(environment) === dataToSave.workflowStage)) return
    setPending(current => new Set(current).add(environment.id))
    setErrors(current => ({ ...current, [environment.id]: '' }))
    try {
      const response = await fetch(`/api/projects/${projectId}/environments/${environment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.id !== environment.id) throw new Error(data?.error || 'Não foi possível atualizar este ambiente.')
      onUpdated(data)
      if (dataToSave.name !== undefined) setEditingName(null)
    } catch (error) { setErrors(current => ({ ...current, [environment.id]: error instanceof Error ? error.message : 'Não foi possível atualizar este ambiente.' })) }
    finally { setPending(current => { const next = new Set(current); next.delete(environment.id); return next }) }
  }
  return <section id="ambientes" aria-label="Etapas dos ambientes" className="scroll-mt-28 space-y-4 rounded-lg border border-[#E3E3E3] bg-white p-4 sm:p-5">
    <div><h2 className="text-base font-semibold">Etapas dos ambientes</h2><p className="mt-1 text-xs leading-5 text-[#777]">Atualize cada ambiente separadamente: a cozinha pode estar nas cotas enquanto o quarto ainda está sendo projetado. A etapa geral do pedido é ajustada no quadro do projeto.</p></div>
    {canWrite ? <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void add() }}><label className="text-xs text-[#666]">Novo ambiente<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={120} placeholder="Ex.: Cozinha" disabled={adding} className="mt-1 block h-10 rounded-md border border-[#DDD] px-3 text-sm" /></label><button type="submit" disabled={adding || !newName.trim()} className="min-h-10 rounded-md bg-[#FF6B00] px-3 text-xs font-semibold text-white disabled:opacity-50">{adding ? 'Adicionando…' : 'Adicionar ambiente'}</button></form> : null}
    {addError ? <p role="alert" className="text-xs text-red-600">{addError}</p> : null}
    {environments.length === 0 ? <p className="text-sm text-[#777]">Nenhum ambiente cadastrado para acompanhamento.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{environments.map(environment => {
      const stage = getEnvironmentWorkflowStage(environment)
      return <article key={environment.id} aria-label={`Ambiente ${environment.name}`} aria-busy={pending.has(environment.id)} className="min-w-0 space-y-3 rounded-lg border border-[#E8E8E8] p-3">
        <h3 className="text-sm font-semibold">{environment.name}</h3>
        {canWrite && editingName !== environment.id ? <button type="button" aria-label={`Renomear ${environment.name}`} onClick={() => { setEditingName(environment.id); setDraftName(environment.name) }} className="text-xs font-semibold text-[#FF6B00]">Renomear</button> : null}
        {editingName === environment.id ? <form className="space-y-2" onSubmit={event => { event.preventDefault(); void update(environment, { name: draftName.trim() }) }}><label className="block text-xs">Nome do ambiente<input value={draftName} onChange={event => setDraftName(event.target.value)} maxLength={120} className="mt-1 h-10 w-full rounded-md border px-2 text-sm" /></label><div className="flex gap-2"><button type="submit" disabled={!draftName.trim() || pending.has(environment.id)} className="text-xs font-semibold text-orange-700">Salvar nome</button><button type="button" onClick={() => setEditingName(null)} className="text-xs">Cancelar</button></div></form> : null}
        <span className={`inline-block max-w-full rounded-md px-2 py-1 text-xs font-semibold ${environmentWorkflowTone(environment)}`}>{environmentWorkflowLabel(environment)}</span>
        {canWrite ? <label className="block text-xs text-[#666]">Etapa de {environment.name}<select aria-label={`Etapa de ${environment.name}`} value={stage || ''} disabled={pending.has(environment.id)} onChange={event => void update(environment, { workflowStage: event.target.value as ProductionStage })} className="mt-1 block h-10 w-full rounded-md border border-[#DDD] bg-white px-2 text-sm">
          <option value="" disabled>Escolha a etapa deste ambiente</option>
          {PRODUCTION_STAGE_FLOW.map(value => <option key={value} value={value}>{PRODUCTION_STAGE_LABELS[value]}</option>)}
        </select></label> : null}
        {stage ? <p className="text-xs leading-5 text-[#777]">{PRODUCTION_STAGE_DESCRIPTIONS[stage]}</p> : null}
        {pending.has(environment.id) ? <p role="status" className="text-xs text-orange-700">Salvando etapa…</p> : null}
        {errors[environment.id] ? <p role="alert" className="text-xs text-red-600">{errors[environment.id]}</p> : null}
      </article>
    })}</div>}
  </section>
}
