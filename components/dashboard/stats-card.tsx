import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: LucideIcon
  color: 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'cyan'
  trend?: { value: number; label: string }
  delay?: number
}

const colorMap = {
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600' },
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-500', text: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-500', text: 'text-yellow-600' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-500', text: 'text-cyan-600' },
}

export function StatsCard({ title, value, subtitle, icon: Icon, color, trend, delay = 0 }: StatsCardProps) {
  const colors = colorMap[color]

  return (
    <div
      className="bg-white rounded-xl border border-[#E8E8E8] shadow-sm p-5 animate-fade-in hover:shadow-md transition-all duration-200"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-[#9E9E9E] uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 break-words text-2xl font-bold leading-tight text-[#121212] xl:text-3xl">{value}</p>
          {subtitle && (
            <p className="text-xs text-[#9E9E9E] mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-[#9E9E9E] font-normal">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', colors.bg)}>
          <Icon size={22} className={colors.text} />
        </div>
      </div>
    </div>
  )
}
