'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { ProjectStatus } from '@/types'

interface CalendarEvent {
  id: string
  projectName: string
  clientName: string
  estimatedEndDate: string | null
  startDate: string | null
  status: string
  stage: string
}

interface CalendarViewProps {
  events: CalendarEvent[]
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function CalendarView({ events }: CalendarViewProps) {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const date = e.estimatedEndDate || e.startDate
      if (!date) return false
      const d = new Date(date)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  const upcomingEvents = events
    .filter((e) => {
      const date = e.estimatedEndDate || e.startDate
      return date && new Date(date) >= today
    })
    .sort((a, b) => {
      const da = new Date(a.estimatedEndDate || a.startDate || 0).getTime()
      const db = new Date(b.estimatedEndDate || b.startDate || 0).getTime()
      return da - db
    })
    .slice(0, 8)

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Calendar grid */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <div className="p-5">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#121212]">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today.getDate()) }}
                  className="px-3 py-1.5 text-xs font-medium text-[#FF6B00] hover:bg-orange-50 rounded-lg transition-colors"
                >
                  Hoje
                </button>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-[#9E9E9E] uppercase tracking-wide py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />

                const dayEvents = getEventsForDay(day)
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isSelected = day === selectedDay
                const hasEvents = dayEvents.length > 0
                const hasDelayed = dayEvents.some((e) => e.status === 'DELAYED')

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      relative p-1.5 rounded-lg text-sm transition-all duration-150 min-h-[44px] flex flex-col items-center
                      ${isSelected ? 'bg-[#FF6B00] text-white' : 'hover:bg-[#F5F5F5]'}
                      ${isToday && !isSelected ? 'font-bold text-[#FF6B00]' : ''}
                      ${!isSelected && !isToday ? 'text-[#121212]' : ''}
                    `}
                  >
                    <span>{day}</span>
                    {hasEvents && (
                      <div className="flex gap-0.5 mt-1">
                        {dayEvents.slice(0, 3).map((e, j) => (
                          <span
                            key={j}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : hasDelayed ? 'bg-red-400' : 'bg-[#FF6B00]'}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Selected day events */}
        {selectedDay && (
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-[#121212] mb-4">
                {selectedDay} de {MONTHS[month]}
                {selectedDayEvents.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-[#9E9E9E]">
                    {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h3>

              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
                  <Calendar size={28} className="mb-2 opacity-20" />
                  <p className="text-sm">Nenhum evento neste dia</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/dashboard/projects/${event.id}`}
                      className="flex items-center justify-between p-3 bg-[#F5F5F5] rounded-xl hover:bg-orange-50 hover:border-orange-200 border border-transparent transition-all"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#121212]">{event.projectName}</p>
                        <p className="text-xs text-[#9E9E9E] mt-0.5">{event.clientName}</p>
                      </div>
                      <StatusBadge status={event.status as ProjectStatus} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Sidebar: upcoming */}
      <div>
        <Card>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-[#121212] mb-4">Próximas Entregas</h3>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-[#9E9E9E]">
                <Calendar size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma entrega futura</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const date = event.estimatedEndDate || event.startDate
                  const daysLeft = date
                    ? Math.ceil((new Date(date).getTime() - today.getTime()) / 86400000)
                    : null

                  return (
                    <Link
                      key={event.id}
                      href={`/dashboard/projects/${event.id}`}
                      className="block p-3 rounded-xl border border-[#E8E8E8] hover:border-[#FF6B00]/30 hover:bg-orange-50/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#121212] truncate">{event.projectName}</p>
                          <p className="text-[10px] text-[#9E9E9E] truncate mt-0.5">{event.clientName}</p>
                        </div>
                        {daysLeft !== null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                            daysLeft === 0 ? 'bg-red-100 text-red-600' :
                            daysLeft <= 3 ? 'bg-orange-100 text-orange-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {daysLeft === 0 ? 'Hoje!' : daysLeft === 1 ? 'Amanhã' : `${daysLeft}d`}
                          </span>
                        )}
                      </div>
                      {date && (
                        <p className="text-[10px] text-[#BDBDBD] mt-1.5">{formatDate(date)}</p>
                      )}
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
