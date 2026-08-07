'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Calendar,
  Calculator,
  FolderOpen,
  HeartHandshake,
  FileSignature,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

type SidebarNavItem = {
  href: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

const SIDEBAR_STORAGE_KEY = 'vertex:sidebar-collapsed'
const SIDEBAR_CHANGE_EVENT = 'vertex:sidebar-change'

const navSections: Array<{ label: string; items: SidebarNavItem[] }> = [
  {
    label: 'Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/dashboard/clients', label: 'Clientes', icon: Users },
      { href: '/dashboard/quotes', label: 'Orçamentos', icon: Calculator },
      { href: '/dashboard/sales', label: 'Vendas', icon: TrendingUp },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/dashboard/projects', label: 'Projetos', icon: FolderOpen },
      { href: '/dashboard/production', label: 'Produção', icon: Kanban },
      { href: '/dashboard/installation', label: 'Instalação', icon: Truck },
      { href: '/dashboard/calendar', label: 'Calendário', icon: Calendar },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet, adminOnly: true },
      { href: '/dashboard/purchases', label: 'Compras', icon: ShoppingCart, adminOnly: true },
      { href: '/dashboard/contracts', label: 'Contratos', icon: FileSignature },
      { href: '/dashboard/post-sale', label: 'Pós-venda', icon: HeartHandshake },
    ],
  },
]

const bottomItems = [
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

function subscribeToSidebarPreference(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STORAGE_KEY) onStoreChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange)
  }
}

function getSidebarPreference() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

interface SidebarProps {
  userName?: string
  userEmail?: string
  userRole?: string
}

export function Sidebar({ userName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarPreference, () => false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const expanded = !collapsed || mobileOpen
  const initials = (userName || userEmail || 'VM')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const closeMobileMenu = () => setMobileOpen(false)
  const toggleCollapsed = () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed))
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT))
  }

  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={mobileOpen}
        aria-controls="main-navigation"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-4 z-[60] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#121212] shadow-sm transition-colors hover:bg-[#F5F5F5] lg:hidden"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="main-navigation"
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full min-h-0 w-[280px] max-w-[85vw] shrink-0 -translate-x-full flex-col border-r border-white/10 bg-[#121212] shadow-2xl transition-[transform,width] duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none',
          mobileOpen && 'translate-x-0',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60'
        )}
      >
        <div className={cn(
          'flex shrink-0 border-b border-white/10',
          expanded ? 'h-20 items-center gap-2 px-3' : 'h-24 flex-col items-center justify-center gap-2 px-2',
        )}>
          <div className={cn('flex min-w-0 items-center', expanded ? 'flex-1 gap-2.5' : 'justify-center')}>
            <div className={cn('flex shrink-0 items-center justify-center', expanded ? 'h-10 w-12' : 'h-8 w-10')}>
              <Image
                src="/vertex-symbol.png"
                alt="Vertex Móveis"
                width={64}
                height={44}
                className={cn('h-auto drop-shadow-sm', expanded ? 'w-10' : 'w-8')}
                priority
              />
            </div>
            {expanded && (
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-white">Vertex Móveis</span>
                <span className="block truncate text-[11px] font-medium text-[#FF8A38]">Gestão de marcenaria</span>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={toggleCollapsed}
            className={cn(
              'hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] lg:flex',
              expanded ? 'ml-auto' : 'ml-0',
            )}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMobileMenu}
          className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X size={18} />
        </button>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none">
          {navSections.map((section, sectionIndex) => {
            const visibleItems = section.items.filter((item) => !item.adminOnly || userRole === 'ADMIN')
            if (!visibleItems.length) return null

            return (
              <div key={section.label} className={cn(sectionIndex > 0 && (expanded ? 'mt-4' : 'mt-2 border-t border-white/10 pt-2'))}>
                {expanded && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase text-white/35">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={!expanded ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={closeMobileMenu}
                        className={cn(
                          'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]',
                          !expanded && 'mx-auto h-10 w-10 justify-center px-0',
                          isActive
                            ? 'bg-[#FF6B00] text-white shadow-[0_6px_18px_rgba(255,107,0,0.18)]'
                            : 'text-white/65 hover:bg-white/8 hover:text-white'
                        )}
                      >
                        <Icon size={18} strokeWidth={1.8} className="shrink-0" />
                        {expanded && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-white/10 bg-black/10 px-2 py-3">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={closeMobileMenu}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]',
                  !expanded && 'mx-auto h-10 w-10 justify-center px-0',
                  isActive ? 'bg-[#FF6B00] text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'
                )}
              >
                <Icon size={18} strokeWidth={1.8} className="shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}

          <div className={cn(
            'border-t border-white/10 pt-3',
            expanded ? '' : 'flex flex-col items-center gap-2',
          )}>
            <div className={cn(
              'flex items-center',
              expanded ? 'gap-2 rounded-lg bg-white/[0.04] p-2' : 'flex-col gap-2',
            )}>
              <div
                title={!expanded ? userName || userEmail : undefined}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6B00] text-[11px] font-bold text-white"
              >
                {initials}
              </div>
              {expanded && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{userName}</p>
                  <p className="truncate text-[10px] text-white/40">{userEmail}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sair"
                aria-label="Sair"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <LogOut size={17} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
