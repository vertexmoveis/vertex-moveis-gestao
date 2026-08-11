import { AlertTriangle, CalendarRange, Gauge } from 'lucide-react'
import { formatDateOnly } from '@/lib/date-only'
import type { ProductionCapacityWeek } from '@/lib/production-capacity'

const stateStyles = {
  AVAILABLE: 'text-[#6B6B6B]',
  ATTENTION: 'text-amber-700',
  OVERLOADED: 'text-red-700',
} as const

const stateLabels = {
  AVAILABLE: 'Disponível',
  ATTENTION: 'Próximo do limite',
  OVERLOADED: 'Acima da capacidade',
} as const

export function ProductionCapacity({ weeks }: { weeks: ProductionCapacityWeek[] }) {
  const overloaded = weeks.filter((week) => week.state === 'OVERLOADED').length

  return (
    <section aria-labelledby="production-capacity-title" className="shrink-0 overflow-hidden rounded-lg border border-[#E7E7E7] bg-white">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[#EFEFEF] px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <h2 id="production-capacity-title" className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-[#121212]">
            <Gauge size={15} className="text-[#FF6B00]" /> Capacidade das próximas semanas
          </h2>
          <span className="hidden truncate text-[11px] text-[#777] md:inline">Entregas previstas nas próximas 4 semanas</span>
        </div>
        {overloaded > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
            <AlertTriangle size={13} /> {overloaded} semana{overloaded !== 1 ? 's' : ''} sobrecarregada{overloaded !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#EFEFEF] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        {weeks.map((week) => (
          <div key={week.start} className="min-w-0 px-4 py-2.5 sm:border-b sm:border-[#EFEFEF] xl:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium text-[#444]">
                <CalendarRange size={13} className="shrink-0 text-[#777]" />
                {formatDateOnly(week.start)} a {formatDateOnly(week.end)}
              </span>
              <span className={`shrink-0 text-[10px] font-semibold ${stateStyles[week.state]}`}>{stateLabels[week.state]}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2 text-[#121212]">
              <p className="text-lg font-bold leading-none">
                {week.scheduled.toLocaleString('pt-BR')}
                <span className="ml-1 text-[10px] font-medium text-[#777]">de {week.capacity} pontos</span>
              </p>
              <span className={`text-[11px] font-semibold ${stateStyles[week.state]}`}>{week.usagePercent}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#E9E9E9]">
              <div
                className={`h-full ${week.state === 'OVERLOADED' ? 'bg-red-500' : week.state === 'ATTENTION' ? 'bg-amber-500' : 'bg-[#777]'}`}
                style={{ width: `${Math.min(week.usagePercent, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
