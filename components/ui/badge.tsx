import { cn } from '@/lib/utils'
import { type ProjectStatus, PROJECT_STATUS_LABELS, PROJECT_STATUS_BG } from '@/types'

interface BadgeProps {
  status: ProjectStatus
  className?: string
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        PROJECT_STATUS_BG[status],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  )
}

interface GenericBadgeProps {
  children: React.ReactNode
  color?: 'gray' | 'orange' | 'green' | 'red' | 'blue' | 'purple' | 'yellow'
  className?: string
}

export function Badge({ children, color = 'gray', className }: GenericBadgeProps) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  )
}
