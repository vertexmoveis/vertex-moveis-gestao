'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Plus, X, FolderOpen, UserRound, Calculator } from 'lucide-react'
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

type HeaderNotification = {
  id: string
  title: string
  body: string
  href: string
  tone?: 'danger' | 'warning' | 'info'
}

type GlobalSearchResult = {
  id: string
  type: 'client' | 'project' | 'quote'
  title: string
  subtitle: string
  href: string
}

const NOTIFICATION_CACHE_MS = 60_000
let notificationCache: HeaderNotification[] | null = null
let notificationCacheTime = 0
let notificationRequest: Promise<HeaderNotification[]> | null = null

function loadNotifications() {
  if (notificationCache && Date.now() - notificationCacheTime < NOTIFICATION_CACHE_MS) {
    return Promise.resolve(notificationCache)
  }
  if (notificationRequest) return notificationRequest

  notificationRequest = fetch('/api/notifications')
    .then((response) => (response.ok ? response.json() : []))
    .then((items: HeaderNotification[]) => {
      notificationCache = Array.isArray(items) ? items : []
      notificationCacheTime = Date.now()
      return notificationCache
    })
    .catch(() => [])
    .finally(() => {
      notificationRequest = null
    })

  return notificationRequest
}

const searchTypeConfig = {
  client: { label: 'Cliente', icon: UserRound, color: 'bg-blue-50 text-blue-600' },
  project: { label: 'Projeto', icon: FolderOpen, color: 'bg-orange-50 text-[#FF6B00]' },
  quote: { label: 'Orçamento', icon: Calculator, color: 'bg-emerald-50 text-emerald-600' },
}

export function Header({ title, subtitle, userName, action }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const refreshNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    const items = await loadNotifications()
    setNotifications(items)
    setNotificationsLoaded(true)
    setNotificationsLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      loadNotifications().then((items) => {
        if (!active) return
        setNotifications(items)
        setNotificationsLoaded(true)
      })
    }, 1200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const cleanQuery = query.trim()

    if (!searchOpen || cleanQuery.length < 2) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((payload: { results?: GlobalSearchResult[] }) => {
          setSearchResults(Array.isArray(payload.results) ? payload.results : [])
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') setSearchResults([])
        })
        .finally(() => setSearchLoading(false))
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchOpen])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const cleanQuery = query.trim()
      if (cleanQuery) {
        const firstResult = searchResults[0]
        router.push(firstResult?.href || `/dashboard/projects?q=${encodeURIComponent(cleanQuery)}`)
        setSearchOpen(false)
        setQuery('')
      }
    },
    [query, router, searchResults]
  )

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
    setSearchResults([])
    setSearchLoading(false)
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#E8E8E8] bg-white py-4 pl-14 pr-4 sm:gap-4 sm:pr-6 lg:px-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-[#121212] truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[#9E9E9E] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className={cn('relative transition-all duration-200', searchOpen ? 'w-72 sm:w-96' : 'w-9')}>
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  const value = e.target.value
                  setQuery(value)
                  if (value.trim().length < 2) {
                    setSearchResults([])
                    setSearchLoading(false)
                  }
                }}
                placeholder="Buscar cliente, projeto ou orçamento..."
                className="w-full text-sm bg-[#F5F5F5] border border-[#D9D9D9] rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              />
              <Search size={15} className="absolute left-3 text-[#9E9E9E]" />
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={closeSearch}
                className="absolute right-2 text-[#9E9E9E] hover:text-[#121212]"
              >
                <X size={14} />
              </button>
              {query.trim().length >= 2 && (
                <div className="absolute right-0 top-11 z-50 w-full overflow-hidden rounded-lg border border-[#E8E8E8] bg-white shadow-xl">
                  <div className="border-b border-[#F0F0F0] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9E9E9E]">
                    Busca geral
                  </div>
                  {searchLoading ? (
                    <div className="space-y-2 p-3">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="h-10 animate-pulse rounded-lg bg-[#F5F5F5]" />
                      ))}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-sm font-medium text-[#121212]">Nada encontrado</p>
                      <p className="mt-1 text-xs text-[#777]">Tente buscar pelo nome do cliente, projeto ou orçamento.</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto p-1">
                      {searchResults.map((item) => {
                        const config = searchTypeConfig[item.type]
                        const Icon = config.icon

                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            onClick={() => {
                              closeSearch()
                              router.push(item.href)
                            }}
                            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#FAFAFA]"
                          >
                            <span className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', config.color)}>
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[#121212]">{item.title}</span>
                                <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-semibold text-[#777]">{config.label}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-[#777]">{item.subtitle}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </form>
          ) : (
            <button
              type="button"
              aria-label="Abrir busca"
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
            onClick={() => {
              const nextOpen = !notificationsOpen
              setNotificationsOpen(nextOpen)
              if (nextOpen && !notificationsLoaded && !notificationsLoading) void refreshNotifications()
            }}
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] text-[#9E9E9E] hover:text-[#121212] transition-colors',
              notificationsOpen && 'bg-[#F5F5F5] text-[#121212]'
            )}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B00] px-1 text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
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
                {notificationsLoading && !notificationsLoaded ? (
                  <div className="space-y-2 p-4">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="h-12 animate-pulse rounded-lg bg-[#F5F5F5]" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-sm font-medium text-[#121212]">Tudo em dia</p>
                    <p className="mt-1 text-xs text-[#777]">Nenhum alerta importante agora.</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false)
                        router.push(item.href)
                      }}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-[#F7F7F7]"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                            item.tone === 'danger' ? 'bg-red-500' : item.tone === 'warning' ? 'bg-amber-500' : 'bg-[#FF6B00]'
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium text-[#121212]">{item.title}</p>
                          <p className="mt-1 text-xs text-[#777]">{item.body}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        {action && (
          <Button size="sm" aria-label={action.label} onClick={action.onClick} className="gap-1.5">
            <Plus size={15} />
            <span className="hidden sm:inline">{action.label}</span>
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
