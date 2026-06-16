import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  color?: string
}

const COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-yellow-500',
]

function getColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }

  const color = getColorFromName(name)

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
        sizeClasses[size],
        color,
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
