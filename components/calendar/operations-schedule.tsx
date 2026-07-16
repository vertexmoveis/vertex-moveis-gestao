'use client'

import { CalendarPlus, CheckCircle, Pencil, Trash2, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  INSTALLATION_SCHEDULE_STATUSES,
  INSTALLATION_SCHEDULE_STATUS_CLASSES,
  INSTALLATION_SCHEDULE_STATUS_LABELS,
  type InstallationScheduleStatus,
} from '@/lib/installation-schedule'
import { formatDate } from '@/lib/utils'

type ProjectOption = { id: string; name: string; client: { name: string } }
type Resource = { id: string; name: string; type: 'TEAM' | 'VEHICLE'; active: boolean }
type ScheduleStatus = InstallationScheduleStatus
type Schedule = {
  id: string
  projectId: string
  scheduledStart: string
  scheduledEnd: string
  teamId: string | null
  vehicleId: string | null
  status: ScheduleStatus
  notes: string | null
  departureAt: string | null
  arrivalAt: string | null
  completedAt: string | null
  clientConfirmation: string | null
  completionNotes: string | null
  project: ProjectOption
  team: { id: string; name: string } | null
  vehicle: { id: string; name: string } | null
}

type ScheduleDraft = {
  projectId: string
  scheduledStart: string
  scheduledEnd: string
  teamId: string
  vehicleId: string
  status: ScheduleStatus
  notes: string
  clientConfirmation: string
  completionNotes: string
}

const STATUS_OPTIONS = INSTALLATION_SCHEDULE_STATUSES.map((value) => ({ value, label: INSTALLATION_SCHEDULE_STATUS_LABELS[value] }))

function localDateTimeValue(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function draftForMonth(month: string): ScheduleDraft {
  const [year, monthNumber] = month.split('-').map(Number)
  const now = new Date()
  const date = new Date(year || now.getFullYear(), (monthNumber || now.getMonth() + 1) - 1, 1, 8, 0, 0, 0)
  if (date < now) date.setTime(now.getTime())
  date.setMinutes(0, 0, 0)
  const end = new Date(date)
  end.setHours(end.getHours() + 4)
  return {
    projectId: '',
    scheduledStart: localDateTimeValue(date),
    scheduledEnd: localDateTimeValue(end),
    teamId: '',
    vehicleId: '',
    status: 'SCHEDULED',
    notes: '',
    clientConfirmation: '',
    completionNotes: '',
  }
}

function scheduleToDraft(schedule: Schedule): ScheduleDraft {
  return {
    projectId: schedule.projectId,
    scheduledStart: localDateTimeValue(schedule.scheduledStart),
    scheduledEnd: localDateTimeValue(schedule.scheduledEnd),
    teamId: schedule.teamId || '',
    vehicleId: schedule.vehicleId || '',
    status: schedule.status,
    notes: schedule.notes || '',
    clientConfirmation: schedule.clientConfirmation || '',
    completionNotes: schedule.completionNotes || '',
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function nextStatusAction(status: ScheduleStatus) {
  if (status === 'SCHEDULED') return { status: 'CONFIRMED' as const, label: 'Confirmar' }
  if (status === 'CONFIRMED') return { status: 'ON_ROUTE' as const, label: 'Em rota' }
  if (status === 'ON_ROUTE') return { status: 'IN_PROGRESS' as const, label: 'Chegou' }
  if (status === 'IN_PROGRESS') return { status: 'COMPLETED' as const, label: 'Concluir' }
  return null
}

export function OperationsSchedule({ month }: { month: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftForMonth(month))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const [year, monthNumber] = month.split('-').map(Number)
    const from = new Date(year, monthNumber - 1, -7).toISOString()
    const to = new Date(year, monthNumber, 8).toISOString()
    fetch(`/api/operations/schedules?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (response) => response.ok ? response.json() : { schedules: [], projects: [], resources: [] })
      .then((data) => {
        if (!active) return
        setSchedules(Array.isArray(data.schedules) ? data.schedules : [])
        setProjects(Array.isArray(data.projects) ? data.projects : [])
        setResources(Array.isArray(data.resources) ? data.resources : [])
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('Não foi possível carregar a agenda operacional.')
        setLoading(false)
      })
    return () => { active = false }
  }, [month])

  const teams = useMemo(() => resources.filter((resource) => resource.type === 'TEAM'), [resources])
  const vehicles = useMemo(() => resources.filter((resource) => resource.type === 'VEHICLE'), [resources])

  const resetDraft = () => {
    setDraft(draftForMonth(month))
    setEditingId(null)
    setError('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.projectId) return setError('Selecione o projeto da instalação.')
    const scheduledStart = new Date(draft.scheduledStart)
    const scheduledEnd = new Date(draft.scheduledEnd)
    if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
      return setError('Informe início e fim válidos para a instalação.')
    }

    setSaving(true)
    const response = await fetch(editingId ? `/api/operations/schedules/${editingId}` : '/api/operations/schedules', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        teamId: draft.teamId || null,
        vehicleId: draft.vehicleId || null,
        notes: draft.notes.trim() || null,
        clientConfirmation: draft.clientConfirmation.trim() || null,
        completionNotes: draft.completionNotes.trim() || null,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return setError(data?.error || 'Não foi possível salvar o agendamento.')
    setSchedules((current) => editingId
      ? current.map((schedule) => schedule.id === data.id ? data : schedule)
      : [...current, data].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
    )
    resetDraft()
  }

  const updateScheduleStatus = async (schedule: Schedule, status: ScheduleStatus) => {
    setTransitioningId(schedule.id)
    setError('')
    const response = await fetch(`/api/operations/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: schedule.projectId,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        teamId: schedule.teamId,
        vehicleId: schedule.vehicleId,
        notes: schedule.notes,
        clientConfirmation: schedule.clientConfirmation,
        completionNotes: schedule.completionNotes,
        status,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setTransitioningId(null)
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar a instalação.')
    setSchedules((current) => current.map((item) => item.id === schedule.id ? data : item))
  }

  const deleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm(`Excluir o agendamento de ${schedule.project.name}?`)) return
    const response = await fetch(`/api/operations/schedules/${schedule.id}`, { method: 'DELETE' })
    if (!response.ok) return setError('Não foi possível excluir o agendamento.')
    setSchedules((current) => current.filter((item) => item.id !== schedule.id))
    if (editingId === schedule.id) resetDraft()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#121212]">Agenda de equipes e instalações</h2>
            <p className="mt-1 text-xs text-[#9E9E9E]">Reservas de equipe e veículo sem conflito de horário</p>
          </div>
          <span className="text-xs font-semibold text-[#6B7280]">{schedules.length} agendamento{ schedules.length !== 1 ? 's' : ''}</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Projeto" value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))} placeholder="Selecionar projeto" options={projects.map((project) => ({ value: project.id, label: `${project.name} - ${project.client.name}` }))} />
          <Input label="Início" type="datetime-local" value={draft.scheduledStart} onChange={(event) => setDraft((current) => ({ ...current, scheduledStart: event.target.value }))} />
          <Input label="Fim" type="datetime-local" value={draft.scheduledEnd} onChange={(event) => setDraft((current) => ({ ...current, scheduledEnd: event.target.value }))} />
          {editingId ? (
            <Select label="Status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ScheduleStatus }))} options={STATUS_OPTIONS} />
          ) : (
            <Input label="Status" value="Agendado" disabled />
          )}
          <Select label="Equipe" value={draft.teamId} onChange={(event) => setDraft((current) => ({ ...current, teamId: event.target.value }))} placeholder="Sem equipe" options={teams.map((team) => ({ value: team.id, label: team.name }))} />
          <Select label="Veículo" value={draft.vehicleId} onChange={(event) => setDraft((current) => ({ ...current, vehicleId: event.target.value }))} placeholder="Sem veículo" options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.name }))} />
          <Textarea label="Observação" rows={1} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="xl:col-span-1" />
          <Input label="Cliente que confirmou" value={draft.clientConfirmation} onChange={(event) => setDraft((current) => ({ ...current, clientConfirmation: event.target.value }))} />
          <Textarea label="Relato da instalação" rows={1} value={draft.completionNotes} onChange={(event) => setDraft((current) => ({ ...current, completionNotes: event.target.value }))} className="xl:col-span-2" />
          <div className="flex items-end gap-2">
            {editingId ? <Button type="button" variant="outline" onClick={resetDraft} title="Cancelar edição"><X size={15} /></Button> : null}
            <Button type="submit" loading={saving} className="flex-1"><CalendarPlus size={15} />{editingId ? 'Salvar' : 'Agendar'}</Button>
          </div>
        </form>

        {teams.length === 0 || vehicles.length === 0 ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Cadastre equipes e veículos em Configurações para reservar os recursos da instalação.</p> : null}

        {loading ? <div className="h-24 animate-pulse rounded-lg bg-[#F5F5F5]" /> : schedules.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#9E9E9E]">Nenhuma instalação reservada neste período.</p>
        ) : (
          <div className="divide-y divide-[#F0F0F0] rounded-lg border border-[#E8E8E8]">
            {schedules.map((schedule) => {
              const nextAction = nextStatusAction(schedule.status)
              const operationalDetails = [
                schedule.departureAt ? `Saiu ${formatTime(schedule.departureAt)}` : '',
                schedule.arrivalAt ? `Chegou ${formatTime(schedule.arrivalAt)}` : '',
                schedule.completedAt ? `Concluiu ${formatTime(schedule.completedAt)}` : '',
              ].filter(Boolean)
              return (
                <div key={schedule.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#121212]">{schedule.project.name}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${INSTALLATION_SCHEDULE_STATUS_CLASSES[schedule.status]}`}>{INSTALLATION_SCHEDULE_STATUS_LABELS[schedule.status]}</span>
                    </div>
                    <p className="text-xs text-[#777]">{schedule.project.client.name} · {formatDate(schedule.scheduledStart)} · {formatTime(schedule.scheduledStart)} - {formatTime(schedule.scheduledEnd)}</p>
                    <p className="mt-1 text-xs text-[#9E9E9E]">{[schedule.team?.name, schedule.vehicle?.name].filter(Boolean).join(' · ') || 'Sem recursos reservados'}</p>
                    {operationalDetails.length > 0 ? <p className="mt-1 text-xs font-medium text-[#555]">{operationalDetails.join(' · ')}</p> : null}
                    {schedule.clientConfirmation ? <p className="mt-1 text-xs text-emerald-700">Confirmação: {schedule.clientConfirmation}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                    {nextAction ? (
                      <Button type="button" size="sm" loading={transitioningId === schedule.id} onClick={() => void updateScheduleStatus(schedule, nextAction.status)}>
                        {nextAction.status === 'ON_ROUTE' ? <Truck size={13} /> : <CheckCircle size={13} />}
                        {nextAction.label}
                      </Button>
                    ) : null}
                    <button type="button" title="Editar agendamento" onClick={() => { setEditingId(schedule.id); setDraft(scheduleToDraft(schedule)); setError('') }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] text-[#555] hover:bg-[#F5F5F5] hover:text-[#121212]"><Pencil size={15} /></button>
                    <button type="button" title="Excluir agendamento" onClick={() => void deleteSchedule(schedule)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
