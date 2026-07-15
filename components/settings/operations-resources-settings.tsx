'use client'

import { Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'

type Resource = {
  id: string
  name: string
  type: 'TEAM' | 'VEHICLE'
  active: boolean
}

type ResourceDraft = { name: string; type: Resource['type']; active: boolean }

const emptyDraft = (): ResourceDraft => ({ name: '', type: 'TEAM', active: true })

export function OperationsResourcesSettings({ initialResources }: { initialResources: Resource[] }) {
  const [resources, setResources] = useState(initialResources)
  const [draft, setDraft] = useState<ResourceDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    const response = await fetch(editingId ? `/api/operations/resources/${editingId}` : '/api/operations/resources', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return setError(data?.error || 'Não foi possível salvar o recurso.')
    setResources((current) => editingId
      ? current.map((item) => item.id === data.id ? data : item)
      : [...current, data].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'pt-BR'))
    )
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const toggle = async (resource: Resource) => {
    const response = await fetch(`/api/operations/resources/${resource.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...resource, active: !resource.active }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar o recurso.')
    setResources((current) => current.map((item) => item.id === data.id ? data : item))
  }

  const remove = async (resource: Resource) => {
    if (!window.confirm(`Excluir ${resource.name}?`)) return
    const response = await fetch(`/api/operations/resources/${resource.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data?.error || 'Não foi possível excluir o recurso.')
    setResources((current) => current.filter((item) => item.id !== resource.id))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#121212]">Equipes e veículos</h2>
            <p className="mt-1 text-xs text-[#777]">Recursos usados para reservar instalações no calendário</p>
          </div>
          {editingId ? <Button type="button" size="sm" variant="outline" onClick={() => { setEditingId(null); setDraft(emptyDraft()) }}><X size={14} /> Cancelar</Button> : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
          <Input label="Nome" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Equipe 1" />
          <Select label="Tipo" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as Resource['type'] }))} options={[{ value: 'TEAM', label: 'Equipe' }, { value: 'VEHICLE', label: 'Veículo' }]} />
          <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm text-[#121212]"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-[#FF6B00]" /> Ativo</label>
          <Button type="button" onClick={() => void save()} loading={saving} className="self-end"><Plus size={14} />{editingId ? 'Salvar' : 'Adicionar'}</Button>
        </div>
        <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
          {resources.length === 0 ? <p className="px-4 py-5 text-center text-sm text-[#9E9E9E]">Cadastre uma equipe e um veículo para começar a reservar instalações.</p> : resources.map((resource) => (
            <div key={resource.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div><p className="font-semibold text-[#121212]">{resource.name}</p><p className="text-xs text-[#777]">{resource.type === 'TEAM' ? 'Equipe' : 'Veículo'}</p></div>
              <div className="flex items-center gap-3"><button type="button" title={resource.active ? 'Desativar recurso' : 'Ativar recurso'} onClick={() => void toggle(resource)} className={resource.active ? 'text-emerald-600' : 'text-[#9E9E9E]'}><Power size={16} /></button><button type="button" title="Editar recurso" onClick={() => { setEditingId(resource.id); setDraft(resource); setError('') }} className="text-[#555] hover:text-[#121212]"><Pencil size={16} /></button><button type="button" title="Excluir recurso" onClick={() => void remove(resource)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button></div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
