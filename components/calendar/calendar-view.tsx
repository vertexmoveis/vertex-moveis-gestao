'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Hammer,
  Truck,
} from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { businessDaysBetween } from '@/lib/business-days'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { formatDateOnly } from '@/lib/date-only'
import type { ProjectStatus } from '@/types'

export type CalendarEventType = 'production' | 'delivery' | 'installation' | 'finance'

export interface CalendarEvent {
  id: string
  projectId: string
  projectName: string
  clientName: string
  date: string
  type: CalendarEventType
  status: ProjectStatus
  stage: string
  amount?: number | null
}

interface CalendarViewProps {
  events: CalendarEvent[]
  initialMonth: string
  limited?: boolean
}

type CalendarFilter = 'all' | CalendarEventType | 'overdue'
type CalendarMode = 'month' | 'week' | 'today'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const CALENDAR_VISIBLE_EVENT_LIMIT = 600

const TYPE_CONFIG: Record<CalendarEventType, {
  label: string
  shortLabel: string
  icon: typeof Calendar
  dot: string
  badge: 'orange' | 'green' | 'blue' | 'purple'
  border: string
}> = {
  production: {
    label: 'Começar produção',
    shortLabel: 'Produção',
    icon: Hammer,
    dot: 'bg-[#FF6B00]',
    badge: 'orange',
    border: 'border-l-[#FF6B00]',
  },
  delivery: {
    label: 'Entrega',
    shortLabel: 'Entrega',
    icon: CalendarCheck,
    dot: 'bg-green-500',
    badge: 'green',
    border: 'border-l-green-500',
  },
  installation: {
    label: 'Instalação',
    shortLabel: 'Instalação',
    icon: Truck,
    dot: 'bg-blue-500',
    badge: 'blue',
    border: 'border-l-blue-500',
  },
  finance: {
    label: 'Parcela a receber',
    shortLabel: 'Financeiro',
    icon: CircleDollarSign,
    dot: 'bg-purple-500',
    badge: 'purple',
    border: 'border-l-purple-500',
  },
}

const FILTERS: { key: CalendarFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'production', label: 'Produção' },
  { key: 'delivery', label: 'Entregas' },
  { key: 'installation', label: 'Instalação' },
  { key: 'finance', label: 'Financeiro' },
  { key: 'overdue', label: 'Atrasados' },
]

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)

  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthFromKey(value: string, fallback: Date) {
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), 1)

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return new Date(fallback.getFullYear(), fallback.getMonth(), 1)
  return new Date(year, month, 1)
}

function initialSelectedDateKey(initialMonth: string, today: Date) {
  const month = monthFromKey(initialMonth, today)
  if (monthKey(month) === monthKey(today)) return dateKey(today)
  return dateKey(new Date(month.getFullYear(), month.getMonth(), 1, 12, 0, 0, 0))
}

function startOfWeek(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay())
  return date
}

function getRelativeLabel(date: Date, today: Date) {
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays < 0) return `${Math.abs(diffDays)}d atrasado`
  return `${diffDays}d`
}

function EventTypeBadge({ event, today }: { event: CalendarEvent; today: Date }) {
  const config = TYPE_CONFIG[event.type]
  const eventDate = parseDateOnly(event.date)
  const isOverdue = eventDate < today && event.status !== 'COMPLETED'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge color={isOverdue ? 'red' : config.badge}>{isOverdue ? 'Atrasado' : config.label}</Badge>
      {event.amount ? <Badge color="purple">{formatCurrency(event.amount)}</Badge> : null}
    </div>
  )
}

function EventCard({ event, today }: { event: CalendarEvent; today: Date }) {
  const config = TYPE_CONFIG[event.type]
  const Icon = config.icon
  const eventDate = parseDateOnly(event.date)
  const businessDays = businessDaysBetween(today, eventDate)
  const isOverdue = eventDate < today && event.status !== 'COMPLETED'

  return (
    <Link
      href={`/dashboard/projects/${event.projectId}`}
      className={cn(
        'block rounded-lg border border-l-4 bg-white p-3 transition-all hover:border-[#FF6B00]/40 hover:bg-orange-50/30',
        isOverdue ? 'border-l-red-500' : config.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', isOverdue ? 'bg-red-500' : config.dot)}>
              <Icon size={14} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#121212]">{event.projectName}</p>
              <p className="truncate text-xs text-[#9E9E9E]">{event.clientName}</p>
            </div>
          </div>
          <EventTypeBadge event={event} today={today} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={event.status} />
          <span className={cn('text-[11px] font-medium', isOverdue ? 'text-red-600' : 'text-[#6B7280]')}>
            {businessDays === null ? getRelativeLabel(eventDate, today) : `${businessDays} úteis`}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function CalendarView({ events, initialMonth, limited = false }: CalendarViewProps) {
  const router = useRouter()
  const [todayOnly] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)
  })
  const [currentDate, setCurrentDate] = useState(() => monthFromKey(initialMonth, todayOnly))
  const [selectedDateKey, setSelectedDateKey] = useState(() => initialSelectedDateKey(initialMonth, todayOnly))
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>('all')
  const [mode, setMode] = useState<CalendarMode>('month')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = parseDateOnly(event.date)
      const isOverdue = eventDate < todayOnly && event.status !== 'COMPLETED'

      if (activeFilter === 'all') return true
      if (activeFilter === 'overdue') return isOverdue
      return event.type === activeFilter
    })
  }, [activeFilter, events, todayOnly])

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    for (const event of filteredEvents) {
      const key = dateKey(parseDateOnly(event.date))
      grouped.set(key, [...(grouped.get(key) || []), event])
    }

    for (const items of grouped.values()) {
      items.sort((a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime())
    }

    return grouped
  }, [filteredEvents])

  const selectedEvents = eventsByDay.get(selectedDateKey) || []
  const selectedDate = (() => {
    const [selectedYear, selectedMonth, selectedDay] = selectedDateKey.split('-').map(Number)
    return new Date(selectedYear, selectedMonth, selectedDay, 12, 0, 0, 0)
  })()

  const upcomingEvents = filteredEvents
    .filter((event) => parseDateOnly(event.date) >= todayOnly)
    .sort((a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime())
    .slice(0, 8)

  const overdueCount = events.filter((event) => parseDateOnly(event.date) < todayOnly && event.status !== 'COMPLETED').length
  const todayCount = eventsByDay.get(dateKey(todayOnly))?.length || 0

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weekStart = startOfWeek(selectedDate)
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })

  const setVisibleMonth = (date: Date) => {
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    setCurrentDate(nextMonth)
    const nextKey = monthKey(nextMonth)
    if (nextKey !== initialMonth) {
      router.replace(`/dashboard/calendar?month=${nextKey}`, { scroll: false })
    }
  }

  const prevPeriod = () => {
    if (mode === 'week') {
      const next = new Date(selectedDate)
      next.setDate(selectedDate.getDate() - 7)
      setSelectedDateKey(dateKey(next))
      setVisibleMonth(next)
      return
    }
    setVisibleMonth(new Date(year, month - 1, 1))
  }

  const nextPeriod = () => {
    if (mode === 'week') {
      const next = new Date(selectedDate)
      next.setDate(selectedDate.getDate() + 7)
      setSelectedDateKey(dateKey(next))
      setVisibleMonth(next)
      return
    }
    setVisibleMonth(new Date(year, month + 1, 1))
  }

  const goToday = () => {
    setVisibleMonth(todayOnly)
    setSelectedDateKey(dateKey(todayOnly))
    setMode('today')
  }

  const selectDate = (date: Date) => {
    setSelectedDateKey(dateKey(date))
    setVisibleMonth(date)
  }

  const renderDayButton = (date: Date, muted = false) => {
    const key = dateKey(date)
    const dayEvents = eventsByDay.get(key) || []
    const isSelected = key === selectedDateKey
    const isToday = key === dateKey(todayOnly)
    const hasOverdue = dayEvents.some((event) => parseDateOnly(event.date) < todayOnly && event.status !== 'COMPLETED')

    return (
      <button
        key={key}
        type="button"
        onClick={() => selectDate(date)}
        className={cn(
          'relative flex min-h-[58px] flex-col rounded-lg p-2 text-left text-sm transition-all',
          isSelected ? 'bg-[#FF6B00] text-white shadow-sm' : 'hover:bg-[#F5F5F5]',
          isToday && !isSelected ? 'font-bold text-[#FF6B00]' : '',
          muted && !isSelected ? 'text-[#BDBDBD]' : 'text-[#121212]'
        )}
      >
        <span>{date.getDate()}</span>
        {dayEvents.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1">
            {dayEvents.slice(0, 4).map((event) => (
              <span
                key={event.id}
                className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white/80' : hasOverdue ? 'bg-red-500' : TYPE_CONFIG[event.type].dot)}
              />
            ))}
            {dayEvents.length > 4 ? <span className={cn('text-[9px]', isSelected ? 'text-white' : 'text-[#9E9E9E]')}>+{dayEvents.length - 4}</span> : null}
          </div>
        ) : null}
      </button>
    )
  }

  const visibleDetailEvents = mode === 'today' ? eventsByDay.get(dateKey(todayOnly)) || [] : selectedEvents

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        {limited ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Há muitos eventos neste período. Estão sendo exibidos os primeiros {CALENDAR_VISIBLE_EVENT_LIMIT} de cada grupo.
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-[#9E9E9E]">Eventos filtrados</p>
            <p className="mt-1 text-2xl font-bold text-[#121212]">{filteredEvents.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#9E9E9E]">Hoje</p>
            <p className="mt-1 text-2xl font-bold text-[#121212]">{todayCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[#9E9E9E]">Atrasados</p>
            <p className={cn('mt-1 text-2xl font-bold', overdueCount > 0 ? 'text-red-600' : 'text-[#121212]')}>{overdueCount}</p>
          </Card>
        </div>

        <Card>
          <div className="space-y-4 p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#121212]">
                  {mode === 'week' ? `Semana de ${formatDate(weekStart)}` : mode === 'today' ? 'Hoje' : `${MONTHS[month]} ${year}`}
                </h2>
            <p className="text-xs text-[#9E9E9E]">Prazos, produção e recebimentos em uma agenda única</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['month', 'week', 'today'] as CalendarMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => item === 'today' ? goToday() : setMode(item)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      mode === item ? 'bg-[#121212] text-white' : 'bg-[#F5F5F5] text-[#6B7280] hover:text-[#121212]'
                    )}
                  >
                    {item === 'month' ? 'Mês' : item === 'week' ? 'Semana' : 'Hoje'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                      activeFilter === filter.key
                        ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]'
                        : 'border-[#E8E8E8] bg-white text-[#6B7280] hover:text-[#121212]'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevPeriod}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9E9E9E] transition-colors hover:bg-[#F5F5F5] hover:text-[#121212]"
                  aria-label="Período anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#FF6B00] transition-colors hover:bg-orange-50"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={nextPeriod}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9E9E9E] transition-colors hover:bg-[#F5F5F5] hover:text-[#121212]"
                  aria-label="Próximo período"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {mode === 'week' ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {weekDays.map((date) => {
                  const key = dateKey(date)
                  const dayEvents = eventsByDay.get(key) || []
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectDate(date)}
                      className={cn(
                        'min-h-[160px] rounded-lg border p-3 text-left transition-all hover:border-[#FF6B00]/40 hover:bg-orange-50/20',
                        selectedDateKey === key ? 'border-[#FF6B00] bg-orange-50' : 'border-[#E8E8E8] bg-white'
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase text-[#9E9E9E]">{WEEKDAYS[date.getDay()]}</p>
                      <p className="text-lg font-bold text-[#121212]">{date.getDate()}</p>
                      <div className="mt-3 space-y-1.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span key={event.id} className={cn('block truncate rounded px-2 py-1 text-[10px] font-medium', parseDateOnly(event.date) < todayOnly && event.status !== 'COMPLETED' ? 'bg-red-50 text-red-600' : 'bg-[#F5F5F5] text-[#6B7280]')}>
                            {TYPE_CONFIG[event.type].shortLabel}
                          </span>
                        ))}
                        {dayEvents.length > 3 ? <span className="text-[10px] text-[#9E9E9E]">+{dayEvents.length - 3} eventos</span> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : mode === 'today' ? (
              <div className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#121212]">
                  <Clock size={16} className="text-[#FF6B00]" />
                  Agenda de hoje
                </div>
                <p className="mt-1 text-xs text-[#9E9E9E]">{formatDate(todayOnly)}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="py-1 text-center text-[10px] font-semibold uppercase text-[#9E9E9E]">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, index) => {
                    if (!day) return <div key={index} />
                    return renderDayButton(new Date(year, month, day, 12, 0, 0, 0))
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#121212]">
                  {mode === 'today' ? 'Eventos de hoje' : `${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]}`}
                </h3>
                <p className="text-xs text-[#9E9E9E]">
                  {visibleDetailEvents.length} evento{visibleDetailEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {visibleDetailEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#9E9E9E]">
                <Calendar size={28} className="mb-2 opacity-20" />
                <p className="text-sm">Nenhum evento neste dia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleDetailEvents.map((event) => (
                  <EventCard key={event.id} event={event} today={todayOnly} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-[#121212]">Legenda</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveFilter(type as CalendarEventType)}
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-[#F5F5F5]"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-[#121212]">
                    <span className={cn('h-2.5 w-2.5 rounded-full', config.dot)} />
                    {config.label}
                  </span>
                  <span className="text-[10px] text-[#9E9E9E]">
                    {events.filter((event) => event.type === type).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-[#121212]">Próximos eventos</h3>
            {upcomingEvents.length === 0 ? (
              <div className="py-8 text-center text-[#9E9E9E]">
                <Calendar size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum evento futuro</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingEvents.map((event) => {
                  const config = TYPE_CONFIG[event.type]
                  const eventDate = parseDateOnly(event.date)
                  return (
                    <Link
                      key={event.id}
                      href={`/dashboard/projects/${event.projectId}`}
                      className="block rounded-lg border border-[#E8E8E8] p-3 transition-all hover:border-[#FF6B00]/30 hover:bg-orange-50/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#121212]">{event.projectName}</p>
                          <p className="mt-0.5 truncate text-[10px] text-[#9E9E9E]">{event.clientName}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                          {getRelativeLabel(eventDate, todayOnly)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge color={config.badge}>{config.shortLabel}</Badge>
                        <span className="text-[10px] text-[#BDBDBD]">{formatDateOnly(event.date)}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
