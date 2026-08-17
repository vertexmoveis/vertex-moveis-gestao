'use client'

import { Layers3, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import {
  PROJECT_MDF_APPLICATIONS,
  PROJECT_MDF_SIDES,
  PROJECT_MDF_SUGGESTIONS,
} from '@/lib/project-mdf-specifications'
import type { ProjectEnvironmentData, ProjectMdfSpecification } from '@/types'

function createSpecification(): ProjectMdfSpecification {
  return {
    id: globalThis.crypto?.randomUUID?.() || `mdf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    application: 'Portas',
    side: 'EXTERNAL',
    mdf: '',
    notes: null,
  }
}

export function ProjectMdfSpecifications({
  projectId,
  environments,
  onEnvironmentChange,
}: {
  projectId: string
  environments: ProjectEnvironmentData[]
  onEnvironmentChange: (environment: ProjectEnvironmentData) => void
}) {
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(environments[0]?.id || '')
  const selectedEnvironment = useMemo(
    () => environments.find((environment) => environment.id === selectedEnvironmentId) || environments[0],
    [environments, selectedEnvironmentId],
  )
  const [specifications, setSpecifications] = useState<ProjectMdfSpecification[]>(selectedEnvironment?.mdfSpecifications || [])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  if (environments.length === 0 || !selectedEnvironment) return null

  const updateSpecification = <K extends keyof ProjectMdfSpecification>(
    id: string,
    field: K,
    value: ProjectMdfSpecification[K],
  ) => {
    setSpecifications((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
    setMessage('')
  }

  const addSpecification = () => {
    if (specifications.length >= 30) return
    setSpecifications((current) => [...current, createSpecification()])
    setMessage('')
  }

  const save = async () => {
    const normalized = specifications.map((item) => ({
      ...item,
      application: item.application.trim(),
      mdf: item.mdf.trim(),
      notes: item.notes?.trim() || null,
    }))
    if (normalized.some((item) => !item.application || !item.mdf)) {
      setMessage('Preencha o uso e o MDF de todas as linhas antes de salvar.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/projects/${projectId}/environments/${selectedEnvironment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdfSpecifications: normalized }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error || 'Não foi possível salvar os MDFs deste ambiente.')
        return
      }
      setSpecifications(payload.mdfSpecifications || [])
      onEnvironmentChange(payload)
      setMessage('MDFs e acabamentos salvos.')
    } catch {
      setMessage('Não foi possível salvar. Verifique sua conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="mdf-acabamentos" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Layers3 size={17} className="mt-0.5 shrink-0 text-[#FF6B00]" />
            <div>
              <h3 className="text-sm font-semibold text-[#121212]">MDF e acabamentos</h3>
              <p className="mt-1 text-xs text-[#777]">Informe onde cada MDF será usado no ambiente.</p>
            </div>
          </div>
          {environments.length > 1 ? (
            <label className="flex min-w-[200px] flex-col gap-1 text-[11px] font-semibold text-[#555]">
              Ambiente
              <select
                value={selectedEnvironment.id}
                onChange={(event) => {
                  const nextEnvironment = environments.find((environment) => environment.id === event.target.value)
                  setSelectedEnvironmentId(event.target.value)
                  setSpecifications(nextEnvironment?.mdfSpecifications || [])
                  setMessage('')
                }}
                className="h-9 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm font-normal text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00]"
              >
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAFAFA] px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-[#121212]">{selectedEnvironment.name}</p>
            <p className="text-[11px] text-[#777]">
              {specifications.length === 0
                ? 'Nenhum MDF especificado.'
                : `${specifications.length} ${specifications.length === 1 ? 'especificação cadastrada' : 'especificações cadastradas'}`}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addSpecification} disabled={specifications.length >= 30}>
            <Plus size={14} /> Adicionar MDF
          </Button>
        </div>

        {specifications.length === 0 ? (
          <button
            type="button"
            onClick={addSpecification}
            className="flex min-h-24 w-full flex-col items-center justify-center border border-dashed border-[#D9D9D9] px-4 text-center transition-colors hover:border-[#FF6B00] hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
          >
            <Plus size={18} className="mb-2 text-[#FF6B00]" />
            <span className="text-sm font-semibold text-[#121212]">Cadastrar o MDF deste ambiente</span>
            <span className="mt-1 text-xs text-[#777]">Ex.: Portas · Externo · MDF Off White</span>
          </button>
        ) : (
          <div className="divide-y divide-[#ECECEC] border border-[#E4E4E4]">
            {specifications.map((item, index) => (
              <div key={item.id} className="grid gap-3 p-3 md:grid-cols-[minmax(150px,0.85fr)_120px_minmax(180px,1fr)_minmax(150px,1fr)_36px] md:items-end">
                <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#555]">
                  Uso no móvel
                  <input
                    list={`mdf-applications-${selectedEnvironment.id}`}
                    value={item.application}
                    maxLength={120}
                    onChange={(event) => updateSpecification(item.id, 'application', event.target.value)}
                    placeholder="Ex.: Portas"
                    className="h-10 min-w-0 rounded-lg border border-[#D9D9D9] px-3 text-sm font-normal text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#555]">
                  Lado
                  <select
                    value={item.side}
                    onChange={(event) => updateSpecification(item.id, 'side', event.target.value as ProjectMdfSpecification['side'])}
                    className="h-10 min-w-0 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm font-normal text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  >
                    {PROJECT_MDF_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#555]">
                  MDF / cor
                  <input
                    list={`mdf-suggestions-${selectedEnvironment.id}`}
                    value={item.mdf}
                    maxLength={160}
                    onChange={(event) => updateSpecification(item.id, 'mdf', event.target.value)}
                    placeholder="Ex.: MDF Off White"
                    className="h-10 min-w-0 rounded-lg border border-[#D9D9D9] px-3 text-sm font-normal text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#555]">
                  Observação
                  <input
                    value={item.notes || ''}
                    maxLength={240}
                    onChange={(event) => updateSpecification(item.id, 'notes', event.target.value || null)}
                    placeholder="Opcional"
                    className="h-10 min-w-0 rounded-lg border border-[#D9D9D9] px-3 text-sm font-normal text-[#121212] outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </label>
                <button
                  type="button"
                  title={`Excluir MDF ${index + 1}`}
                  aria-label={`Excluir MDF ${index + 1}`}
                  onClick={() => setSpecifications((current) => current.filter((candidate) => candidate.id !== item.id))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <datalist id={`mdf-applications-${selectedEnvironment.id}`}>
          {PROJECT_MDF_APPLICATIONS.map((application) => <option key={application} value={application} />)}
        </datalist>
        <datalist id={`mdf-suggestions-${selectedEnvironment.id}`}>
          {PROJECT_MDF_SUGGESTIONS.map((mdf) => <option key={mdf} value={mdf} />)}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] pt-3">
          <p className={`text-xs ${message === 'MDFs e acabamentos salvos.' ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p>
          <Button type="button" size="sm" onClick={() => void save()} loading={saving}>
            <Save size={14} /> Salvar MDFs
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
