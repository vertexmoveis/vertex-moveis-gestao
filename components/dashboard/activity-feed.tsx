import { Avatar } from '@/components/ui/avatar'
import { formatDateRelative } from '@/lib/utils'
import { Activity } from 'lucide-react'

interface ActivityItem {
  id: string
  action: string
  details: string | null
  createdAt: string
  user: { name: string } | null
  project: { name: string; client: { name: string } } | null
}

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[#9E9E9E]">
        <Activity size={32} className="mb-2 opacity-30" />
        <p className="text-sm">Nenhuma atividade recente</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          {activity.user ? (
            <Avatar name={activity.user.name} size="sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
              <Activity size={14} className="text-[#9E9E9E]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#121212] font-medium">{activity.action}</p>
            {activity.details && (
              <p className="text-xs text-[#9E9E9E] mt-0.5 truncate">{activity.details}</p>
            )}
            {activity.project && (
              <p className="text-xs text-[#FF6B00] mt-0.5 truncate">
                {activity.project.name} • {activity.project.client.name}
              </p>
            )}
          </div>
          <span className="text-[10px] text-[#9E9E9E] flex-shrink-0">
            {formatDateRelative(activity.createdAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
