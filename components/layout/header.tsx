'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Plus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
  userName?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function Header({ title, subtitle, userName, action }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        router.push(`/dashboard/projects?q=${encodeURIComponent(query)}`)
        setSearchOpen(false)
        setQuery('')
      }
    },
    [query, router]
  )

  return (
    <header className="bg-white border-b border-[#E8E8E8] px-6 py-4 flex items-center gap-4 sticky top-0 z-30">
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-[#121212] truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[#9E9E9E] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className={cn('relative transition-all duration-200', searchOpen ? 'w-56' : 'w-9')}>
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar projetos..."
                className="w-full text-sm bg-[#F5F5F5] border border-[#D9D9D9] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              />
              <Search size={15} className="absolute left-3 text-[#9E9E9E]" />
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setQuery('') }}
                className="absolute right-2 text-[#9E9E9E] hover:text-[#121212]"
              >
                <X size={14} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors"
            >
              <Search size={18} />
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            aria-label="Abrir notificações"
            onClick={() => setNotificationsOpen((open) => !open)}
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors',
              notificationsOpen && 'bg-[#F5F5F5] text-[#121212]'
            )}
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[#E8E8E8] bg-white shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#121212]">Notificações</h2>
                <button
                  type="button"
                  aria-label="Fechar notificações"
                  onClick={() => setNotificationsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#9E9E9E] hover:text-[#121212] hover:bg-[#F5F5F5]"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="divide-y divide-[#F0F0F0]">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false)
                    router.push('/dashboard/production')
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-[#F7F7F7] transition-colors"
                >
                  <p className="text-sm font-medium text-[#121212]">Acompanhar produção</p>
                  <p className="text-xs text-[#777] mt-1">Veja os projetos em andamento e etapas pendentes.</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false)
                    router.push('/dashboard/calendar')
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-[#F7F7F7] transition-colors"
                >
                  <p className="text-sm font-medium text-[#121212]">Conferir agenda</p>
                  <p className="text-xs text-[#777] mt-1">Abra o calendário de entregas e compromissos.</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        {action && (
          <Button size="sm" onClick={action.onClick} className="gap-1.5">
            <Plus size={15} />
            {action.label}
          </Button>
        )}

        {/* Avatar */}
        {userName && (
          <div className="ml-1">
            <Avatar name={userName} size="sm" />
          </div>
        )}
      </div>
    </header>
  )
}
