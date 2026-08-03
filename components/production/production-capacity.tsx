import { AlertTriangle, CalendarRange, Gauge } from 'lucide-react'
import { formatDateOnly } from '@/lib/date-only'
import type { ProductionCapacityWeek } from '@/lib/production-capacity'

const stateStyles = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-800',
  OVERLOADED: 'border-red-200 bg-red-50 text-red-800',
} as const

const stateLabels = {
  AVAILABLE: 'Disponível',
  ATTENTION: 'Próximo do limite',
  OVERLOADED: 'Acima da capacidade',
} as const

export function ProductionCapacity({ weeks }: { weeks: ProductionCapacityWeek[] }) {
  const overloaded = weeks.filter((week) => week.state === 'OVERLOADED').length

  return (
    <section aria-labelledby="production-capacity-title" className="shrink-0 border border-[#E5E5E5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECECEC] px-4 py-3">
        <div>
          <h2 id="production-capacity-title" className="flex items-center gap-2 text-sm font-semibold text-[#121212]">
            <Gauge size={16} className="text-[#FF6B00]" /> Capacidade das próximas semanas
          </h2>
          <p className="mt-1 text-xs text-[#777]">Projetos agrupados pela previsão de entrega</p>
        </div>
        {overloaded > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={14} /> {overloaded} semana{overloaded !== 1 ? 's' : ''} sobrecarregada{overloaded !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {weeks.map((week) => (
          <div key={week.start} className={`border px-3 py-3 ${stateStyles[week.state]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold"><CalendarRange size={14} />{formatDateOnly(week.start)} a {formatDateOnly(week.end)}</span>
              <span className="text-[11px] font-semibold">{stateLabels[week.state]}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-2xl font-bold leading-none">{week.scheduled}<span className="ml-1 text-xs font-medium">de {week.capacity}</span></p>
              <span className="text-xs font-semibold">{week.usagePercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden bg-white/70">
              <div className="h-full bg-current" style={{ width: `${Math.min(week.usagePercent, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
