'use client'

import Link from 'next/link'
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Truck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import {
  INSTALLATION_SCHEDULE_STATUS_CLASSES,
  INSTALLATION_SCHEDULE_STATUS_LABELS,
  type InstallationScheduleStatus,
} from '@/lib/installation-schedule'

type Schedule = {
  id: string
  projectId: string
  scheduledStart: string
  scheduledEnd: string
  teamId: string | null
  vehicleId: string | null
  status: InstallationScheduleStatus
  notes: string | null
  clientConfirmation: string | null
  completionNotes: string | null
  project: {
    id: string
    name: string
    room: string | null
    client: { name: string; phone: string | null; address: string | null }
  }
  team: { id: string; name: string } | null
  vehicle: { id: string; name: string } | null
}

type UnscheduledProject = { id: string; name: string; client: { name: string } }

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  }).format(new Date(value)).replace('.', '')
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function whatsappLink(phone: string | null, clientName: string, projectName: string) {
  const digits = phone?.replace(/\D/g, '') || ''
  if (!digits) return null
  const number = digits.startsWith('55') ? digits : `55${digits}`
  const message = `Olá, ${clientName}! Aqui é da Vertex Móveis. Estamos entrando em contato sobre a instalação do projeto ${projectName}.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

function mapsLink(address: string | null) {
  return address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null
}

function nextAction(status: InstallationScheduleStatus) {
  if (status === 'SCHEDULED') return { status: 'CONFIRMED' as const, label: 'Confirmar instalação', icon: CheckCircle2 }
  if (status === 'CONFIRMED') return { status: 'ON_ROUTE' as const, label: 'Iniciar rota', icon: Navigation }
  if (status === 'ON_ROUTE') return { status: 'IN_PROGRESS' as const, label: 'Cheguei ao cliente', icon: Truck }
  if (status === 'IN_PROGRESS') return { status: 'COMPLETED' as const, label: 'Finalizar instalação', icon: PackageCheck }
  return null
}

export function InstallationMobile({
  schedules: initialSchedules,
  unscheduledProjects,
}: {
  schedules: Schedule[]
  unscheduledProjects: UnscheduledProject[]
}) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [finishing, setFinishing] = useState<Schedule | null>(null)
  const [confirmationName, setConfirmationName] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [clientApproved, setClientApproved] = useState(false)
  const [error, setError] = useState('')

  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, Schedule[]>()
    schedules.forEach((schedule) => {
      const scheduledDate = new Date(schedule.scheduledStart)
      const key = [
        scheduledDate.getFullYear(),
        String(scheduledDate.getMonth() + 1).padStart(2, '0'),
        String(scheduledDate.getDate()).padStart(2, '0'),
      ].join('-')
      groups.set(key, [...(groups.get(key) || []), schedule])
    })
    return [...groups.entries()]
  }, [schedules])

  const updateStatus = async (
    schedule: Schedule,
    status: InstallationScheduleStatus,
    completion?: { clientConfirmation: string; completionNotes: string },
  ) => {
    setUpdatingId(schedule.id)
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
        status,
        notes: schedule.notes,
        clientConfirmation: completion?.clientConfirmation || schedule.clientConfirmation,
        completionNotes: completion?.completionNotes || schedule.completionNotes,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setUpdatingId(null)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível atualizar a instalação.')
      return false
    }
    if (status === 'COMPLETED') {
      setSchedules((current) => current.filter((item) => item.id !== schedule.id))
    } else {
      setSchedules((current) => current.map((item) => item.id === schedule.id
        ? { ...item, ...data, project: item.project }
        : item))
    }
    return true
  }

  const completeInstallation = async () => {
    if (!finishing) return
    if (!clientApproved || !confirmationName.trim()) {
      setError('Confirme a conferência e informe o nome do cliente ou responsável.')
      return
    }
    const completed = await updateStatus(finishing, 'COMPLETED', {
      clientConfirmation: confirmationName.trim(),
      completionNotes: completionNotes.trim(),
    })
    if (completed) {
      setFinishing(null)
      setConfirmationName('')
      setCompletionNotes('')
      setClientApproved(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
      {error ? (
        <div role="alert" className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 shrink-0" size={17} /><span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="border border-[#E5E5E5] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#777]">Próximas instalações</p>
          <p className="mt-1 text-2xl font-bold text-[#121212]">{schedules.length}</p>
        </div>
        <div className="border border-[#E5E5E5] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#777]">Sem agendamento</p>
          <p className="mt-1 text-2xl font-bold text-[#FF6B00]">{unscheduledProjects.length}</p>
        </div>
        <Link href="/dashboard/calendar" className="col-span-2 flex min-h-20 items-center justify-between border border-[#E5E5E5] bg-white p-4 text-sm font-semibold text-[#121212] shadow-sm sm:col-span-1">
          <span className="flex items-center gap-2"><CalendarClock size={19} className="text-[#FF6B00]" />Abrir agenda</span><ChevronRight size={18} />
        </Link>
      </div>

      {groupedSchedules.length === 0 ? (
        <div className="border border-[#E5E5E5] bg-white px-5 py-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-500" size={30} />
          <p className="mt-3 font-semibold text-[#121212]">Nenhuma instalação pendente</p>
          <p className="mt-1 text-sm text-[#777]">A agenda dos próximos 30 dias está livre.</p>
        </div>
      ) : groupedSchedules.map(([date, daySchedules]) => (
        <section key={date} aria-labelledby={`installation-day-${date}`}>
          <h2 id={`installation-day-${date}`} className="mb-2 text-sm font-bold capitalize text-[#121212]">{dateLabel(daySchedules[0].scheduledStart)}</h2>
          <div className="space-y-3">
            {daySchedules.map((schedule) => {
              const action = nextAction(schedule.status)
              const ActionIcon = action?.icon
              const routeUrl = mapsLink(schedule.project.client.address)
              const whatsappUrl = whatsappLink(schedule.project.client.phone, schedule.project.client.name, schedule.project.name)
              return (
                <article key={schedule.id} className="border border-[#E5E5E5] bg-white shadow-sm">
                  <div className="border-b border-[#EFEFEF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[#121212]">{schedule.project.name}</p>
                        <p className="mt-0.5 text-sm text-[#555]">{schedule.project.client.name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${INSTALLATION_SCHEDULE_STATUS_CLASSES[schedule.status]}`}>{INSTALLATION_SCHEDULE_STATUS_LABELS[schedule.status]}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#777]">
                      <span>{timeLabel(schedule.scheduledStart)} - {timeLabel(schedule.scheduledEnd)}</span>
                      {schedule.team ? <span>{schedule.team.name}</span> : null}
                      {schedule.vehicle ? <span>{schedule.vehicle.name}</span> : null}
                    </div>
                    {schedule.project.client.address ? <p className="mt-3 flex items-start gap-2 text-sm text-[#555]"><MapPin className="mt-0.5 shrink-0 text-[#FF6B00]" size={16} />{schedule.project.client.address}</p> : null}
                    {schedule.notes ? <p className="mt-3 border-l-2 border-[#FF6B00] pl-3 text-sm text-[#555]">{schedule.notes}</p> : null}
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-[#EFEFEF] border-b border-[#EFEFEF]">
                    <a href={routeUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!routeUrl} className={`flex min-h-14 items-center justify-center gap-2 text-sm font-semibold ${routeUrl ? 'text-[#121212]' : 'pointer-events-none text-[#BBB]'}`}><Navigation size={17} />Rota</a>
                    <a href={whatsappUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!whatsappUrl} className={`flex min-h-14 items-center justify-center gap-2 text-sm font-semibold ${whatsappUrl ? 'text-[#121212]' : 'pointer-events-none text-[#BBB]'}`}><MessageCircle size={17} />WhatsApp</a>
                    <Link href={`/dashboard/projects/${schedule.projectId}#arquivos`} className="flex min-h-14 items-center justify-center gap-2 text-sm font-semibold text-[#121212]"><Camera size={17} />Fotos</Link>
                  </div>

                  {action && ActionIcon ? (
                    <div className="p-3">
                      <Button type="button" size="lg" loading={updatingId === schedule.id} onClick={() => {
                        if (action.status === 'COMPLETED') {
                          setError('')
                          setFinishing(schedule)
                        } else {
                          void updateStatus(schedule, action.status)
                        }
                      }} className="h-12 w-full text-base">
                        <ActionIcon size={19} />{action.label}
                      </Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {unscheduledProjects.length > 0 ? (
        <section className="border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-900"><CircleAlert size={17} />Prontos para agendar</div>
          <div className="mt-3 divide-y divide-amber-200">
            {unscheduledProjects.map((project) => (
              <Link key={project.id} href="/dashboard/calendar" className="flex min-h-12 items-center justify-between py-2 text-sm text-amber-950">
                <span><strong>{project.name}</strong><br /><span className="text-xs">{project.client.name}</span></span><ChevronRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {finishing ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="finish-installation-title">
          <div className="max-h-[90dvh] w-full overflow-y-auto bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="finish-installation-title" className="text-lg font-bold text-[#121212]">Finalizar instalação</h2><p className="mt-1 text-sm text-[#777]">{finishing.project.name} - {finishing.project.client.name}</p></div>
              <button type="button" aria-label="Fechar" onClick={() => setFinishing(null)} className="flex h-9 w-9 items-center justify-center text-[#777]"><X size={20} /></button>
            </div>
            <div className="mt-5 space-y-4">
              {error ? <div role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
              <label className="flex items-start gap-3 border border-[#D9D9D9] bg-[#FAFAFA] p-4 text-sm font-medium text-[#121212]">
                <input type="checkbox" checked={clientApproved} onChange={(event) => setClientApproved(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#FF6B00]" />
                <span>O cliente ou responsável conferiu a instalação e confirmou a entrega.</span>
              </label>
              <Input label="Nome de quem conferiu" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder="Nome completo" />
              <Textarea label="Observações da instalação" rows={4} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Ajustes realizados, pendências ou observações..." />
              <p className="text-xs text-[#777]">Antes de finalizar, use o botão Fotos para registrar a entrega no projeto.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setFinishing(null)}>Cancelar</Button>
              <Button type="button" size="lg" loading={updatingId === finishing.id} onClick={() => void completeInstallation()}><PackageCheck size={17} />Concluir</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
